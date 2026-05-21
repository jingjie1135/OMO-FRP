import type { RuntimeExecutor } from "../management-api/runtime-executor"
import type { CloudflareTunnelConfigRequest, CloudflareTunnelPlan } from "../management-api/types"
import type { FrpStatus } from "../management-api/types"
import type { LogLine } from "../management-api/types"
import type { ToolDetection } from "../management-api/types"
import { createCloudflaredProcessController } from "./cloudflared-process"
import type { CloudflaredProcessController } from "./cloudflared-process"
import { runCommand } from "./command-runner"
import { createDockerContainerController } from "./docker-container-control"
import type { DockerContainerActionResult, DockerContainerController } from "./docker-container-control"
import { createFrpPanelClient } from "./frp-panel-client"
import type { FrpPanelHealth } from "./frp-panel-client"

interface FrpPanelHealthClient {
  health(): Promise<FrpPanelHealth>
}

export interface ServerRuntimeExecutorOptions {
  opencodeUrl?: string
  frpPanelUrl?: string
  frpPanelClient?: FrpPanelHealthClient
  opencodeContainerControlEnabled?: boolean
  opencodeContainerController?: DockerContainerController
  frpContainerController?: DockerContainerController
  cloudflaredDetected?: boolean
  cloudflaredProcessController?: CloudflaredProcessController
}

export function createServerRuntimeExecutor(options: ServerRuntimeExecutorOptions = {}): RuntimeExecutor {
  const opencodeUrl = options.opencodeUrl ?? process.env.OPENCODE_INTERNAL_URL ?? "http://opencode:4096"
  const frpPanelUrl = options.frpPanelUrl ?? process.env.FRP_PANEL_INTERNAL_API_URL ?? `http://frp-panel:${process.env.FRP_PANEL_API_PORT ?? "9000"}`
  const frpPanelClient = options.frpPanelClient ?? createFrpPanelClient({ baseUrl: frpPanelUrl })
  const opencodeContainerControlEnabled = options.opencodeContainerControlEnabled ?? process.env.OPENCODE_CONTAINER_CONTROL_ENABLED === "true"
  const opencodeContainerController = options.opencodeContainerController ?? createDockerContainerController()
  const frpContainerController = options.frpContainerController ?? createDockerContainerController({
    composeProject: process.env.FRP_PANEL_COMPOSE_PROJECT ?? process.env.OPENCODE_COMPOSE_PROJECT,
    composeService: process.env.FRP_PANEL_COMPOSE_SERVICE ?? "frp-panel",
    containerName: process.env.FRP_PANEL_CONTAINER_NAME ?? "frp-panel",
    displayName: "FRP",
  })
  const cloudflaredDetectedOverride = options.cloudflaredDetected
  const cloudflaredBinary = process.env.CLOUDFLARED_BINARY ?? "cloudflared"
  const cloudflaredProcessController = options.cloudflaredProcessController ?? createCloudflaredProcessController()
  let cloudflareConfig: CloudflareTunnelConfigRequest = { mode: "quick", localHost: "127.0.0.1", localPort: 4096 }

  return {
    async detectTools(): Promise<ToolDetection[]> {
      const [opencodeDetected, cloudflaredDetected] = await Promise.all([
        isHttpReachable(opencodeUrl),
        detectCloudflared(cloudflaredBinary, cloudflaredDetectedOverride),
      ])
      return [
        {
          kind: "opencode",
          displayName: "OpenCode",
          detected: opencodeDetected,
          binaryPath: "opencode",
          configDirectory: process.env.OPENCODE_CONFIG_DIR ?? "/config",
        },
        {
          kind: "cloudflared",
          displayName: "cloudflared",
          detected: cloudflaredDetected,
          binaryPath: cloudflaredBinary,
        },
      ]
    },
    async installTool(request) {
      return { jobId: `install:${request.kind}`, status: "failed", message: "Server runtime installs tools through Docker images." }
    },
    async startTool(instanceId) {
      return controlOpenCodeContainer("start", instanceId, opencodeContainerControlEnabled, () => opencodeContainerController.start())
    },
    async stopTool(instanceId) {
      return controlOpenCodeContainer("stop", instanceId, opencodeContainerControlEnabled, () => opencodeContainerController.stop())
    },
    async restartTool(instanceId) {
      return controlOpenCodeContainer("restart", instanceId, opencodeContainerControlEnabled, () => opencodeContainerController.restart())
    },
    async getToolLogs(instanceId) {
      if (!instanceId.startsWith("opencode")) {
        if (instanceId.startsWith("cloudflared")) {
          return cloudflaredProcessController.logs()
        }
        return []
      }
      return getOpenCodeContainerLogs(opencodeContainerControlEnabled, opencodeContainerController)
    },
    async getFrpStatus() { return getServerFrpStatus(await frpPanelClient.health()) },
    async saveFrpConfig() {},
    async startFrp() { return controlFrpContainer("start", opencodeContainerControlEnabled, () => frpContainerController.start()) },
    async stopFrp() { return controlFrpContainer("stop", opencodeContainerControlEnabled, () => frpContainerController.stop()) },
    async getCloudflareTunnelStatus() {
      const status = cloudflaredProcessController.status()
      if (status.running) {
        return {
          mode: "quick" as const,
          running: true,
          publicUrl: status.publicUrl,
          currentStep: "verify_public_access" as const,
          message: status.publicUrl ? `Cloudflare quick tunnel is running at ${status.publicUrl}.` : "Cloudflare quick tunnel is starting.",
        }
      }
      return { mode: cloudflareConfig.mode, running: false, currentStep: "start_tunnel" as const, message: "Cloudflare quick tunnel is configured but stopped." }
    },
    async saveCloudflareTunnelConfig(config) { cloudflareConfig = config },
    async createCloudflareTunnelPlan(config) { return createServerCloudflareTunnelPlan(config, await detectCloudflared(cloudflaredBinary, cloudflaredDetectedOverride)) },
    async startCloudflareTunnel(config) {
      if (config.mode !== "quick") {
        return { jobId: "start-cloudflare:server", status: "failed", message: "Server runtime currently supports managed execution for Cloudflare quick tunnels only." }
      }
      if (!await detectCloudflared(cloudflaredBinary, cloudflaredDetectedOverride)) {
        return { jobId: "start-cloudflare:server", status: "failed", message: "cloudflared binary must be installed before start." }
      }
      cloudflareConfig = config
      const result = await cloudflaredProcessController.startQuickTunnel(buildCloudflareLocalUrl(config))
      return { jobId: "start-cloudflare:server", status: result.ok ? "succeeded" as const : "failed" as const, message: result.message }
    },
    async stopCloudflareTunnel() {
      const result = await cloudflaredProcessController.stop()
      return { jobId: "stop-cloudflare:server", status: result.ok ? "succeeded" as const : "failed" as const, message: result.message }
    },
    async retryCloudflareTunnelStep(stepId) {
      return { jobId: `retry-cloudflare:${stepId}`, status: "failed", message: `Cloudflare step retry is only available for named tunnel workflows. Step ${stepId} cannot be retried by the quick tunnel runtime.` }
    },
  }
}

async function detectCloudflared(command: string, override: boolean | undefined): Promise<boolean> {
  if (override !== undefined) {
    return override
  }

  try {
    const result = await runCommand({
      command,
      args: ["--version"],
      timeoutMs: 2_000,
      maxOutputBytes: 2_000,
      env: { PATH: process.env.PATH ?? "" },
    })
    return !result.timedOut && result.exitCode === 0
  } catch {
    return false
  }
}

function createServerCloudflareTunnelPlan(config: CloudflareTunnelConfigRequest, cloudflaredDetected: boolean): CloudflareTunnelPlan {
  const localUrl = buildCloudflareLocalUrl(config)
  return {
    mode: config.mode,
    localUrl,
    publicUrl: config.mode === "named" && config.hostname ? `https://${config.hostname}` : "https://<generated>.trycloudflare.com",
    tunnelName: config.mode === "named" ? config.tunnelName : undefined,
    hostname: config.mode === "named" ? config.hostname : undefined,
    dnsRoute: config.mode === "named" ? config.dnsRoute : undefined,
    commandSummary: config.mode === "quick"
      ? [`cloudflared tunnel --url ${localUrl}`]
      : [
          "cloudflared tunnel login",
          `cloudflared tunnel create ${config.tunnelName ?? "opencode-local"}`,
          `cloudflared tunnel route dns ${config.tunnelName ?? "opencode-local"} ${config.dnsRoute ?? config.hostname ?? "opencode.example.com"}`,
          `cloudflared tunnel run --url ${localUrl} ${config.tunnelName ?? "opencode-local"}`,
        ],
    cloudflaredDetected,
    diagnostics: cloudflaredDetected ? [] : [{
      code: "cloudflared-missing",
      severity: "error",
      message: "cloudflared was not found on PATH.",
      fix: "Install cloudflared before starting a Cloudflare Tunnel.",
    }],
    securityNotes: [
      "Never expose OpenCode without a strong OPENCODE_SERVER_PASSWORD.",
      config.mode === "quick" ? "Quick tunnels are temporary; named tunnels should use a Cloudflare-managed hostname." : "Named tunnels should use a Cloudflare-managed hostname.",
    ],
    steps: config.mode === "named" ? [
      { id: "login", label: "Login", status: "idle", retryable: true },
      { id: "create_tunnel", label: "Create tunnel", status: "idle", retryable: true },
      { id: "configure_dns", label: "Configure DNS", status: "idle", retryable: true },
      { id: "write_config", label: "Write config", status: "idle", retryable: true },
      { id: "start_tunnel", label: "Start tunnel", status: "idle", retryable: true },
      { id: "verify_public_access", label: "Verify public access", status: "idle", retryable: true },
    ] : [],
  }
}

function buildCloudflareLocalUrl(config: CloudflareTunnelConfigRequest): string {
  return `http://${config.localHost}:${config.localPort}`
}

async function controlFrpContainer(
  action: "start" | "stop",
  enabled: boolean,
  operation: () => Promise<DockerContainerActionResult>,
) {
  const jobId = `${action}-frp:server`
  if (!enabled) {
    return {
      jobId,
      status: "failed" as const,
      message: "FRP container control is disabled. Set OPENCODE_CONTAINER_CONTROL_ENABLED=true and mount the Docker socket to enable it.",
    }
  }

  let result: DockerContainerActionResult
  try {
    result = await operation()
  } catch (error) {
    return { jobId, status: "failed" as const, message: `Docker container control failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  return { jobId, status: result.ok ? "succeeded" as const : "failed" as const, message: result.message }
}

async function getOpenCodeContainerLogs(enabled: boolean, controller: DockerContainerController): Promise<LogLine[]> {
  if (!enabled) {
    return []
  }

  try {
    const result = await controller.logs()
    return result.ok ? result.logs : []
  } catch {
    return []
  }
}

async function controlOpenCodeContainer(
  action: "start" | "stop" | "restart",
  instanceId: string,
  enabled: boolean,
  operation: () => Promise<DockerContainerActionResult>,
) {
  const jobId = `${action}:${instanceId}`
  if (!instanceId.startsWith("opencode")) {
    return { jobId, status: "failed" as const, message: `Server runtime can only ${action} OpenCode tool instances.` }
  }
  if (!enabled) {
    return {
      jobId,
      status: "failed" as const,
      message: "OpenCode container control is disabled. Set OPENCODE_CONTAINER_CONTROL_ENABLED=true and mount the Docker socket to enable it.",
    }
  }

  let result: DockerContainerActionResult
  try {
    result = await operation()
  } catch (error) {
    return { jobId, status: "failed" as const, message: `Docker container control failed: ${error instanceof Error ? error.message : String(error)}` }
  }
  return { jobId, status: result.ok ? "succeeded" as const : "failed" as const, message: result.message }
}

function getServerFrpStatus(health: FrpPanelHealth): FrpStatus {
  if (health.reachable && health.status !== undefined && health.status < 500) {
    return {
      mode: "server",
      running: true,
      status: "ready",
      message: `frp-panel is reachable at HTTP ${health.status}.`,
    }
  }

  if (health.reachable) {
    return {
      mode: "server",
      running: false,
      status: "error",
      failureReason: "api_unreachable",
      message: `frp-panel API returned HTTP ${health.status}.`,
      suggestion: "Verify the frp-panel API URL and that the API endpoint is reachable from the management-ui container.",
    }
  }

  return {
    mode: "server",
    running: false,
    status: "error",
    failureReason: "api_unreachable",
    message: `frp-panel API is unreachable${health.message ? `: ${health.message}` : "."}`,
    suggestion: "Verify the frp-panel API URL and that the API endpoint is reachable from the management-ui container.",
  }
}

async function isHttpReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET" })
    return response.ok || response.status === 401 || response.status === 403
  } catch {
    return false
  }
}
