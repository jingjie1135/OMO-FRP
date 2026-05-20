import type { RuntimeExecutor } from "../management-api/runtime-executor"
import type { FrpStatus } from "../management-api/types"
import type { LogLine } from "../management-api/types"
import type { ToolDetection } from "../management-api/types"
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
}

export function createServerRuntimeExecutor(options: ServerRuntimeExecutorOptions = {}): RuntimeExecutor {
  const opencodeUrl = options.opencodeUrl ?? process.env.OPENCODE_INTERNAL_URL ?? "http://opencode:4096"
  const frpPanelUrl = options.frpPanelUrl ?? process.env.FRP_PANEL_INTERNAL_API_URL ?? `http://frp-panel:${process.env.FRP_PANEL_API_PORT ?? "9000"}`
  const frpPanelClient = options.frpPanelClient ?? createFrpPanelClient({ baseUrl: frpPanelUrl })
  const opencodeContainerControlEnabled = options.opencodeContainerControlEnabled ?? process.env.OPENCODE_CONTAINER_CONTROL_ENABLED === "true"
  const opencodeContainerController = options.opencodeContainerController ?? createDockerContainerController()

  return {
    async detectTools(): Promise<ToolDetection[]> {
      return [{
        kind: "opencode",
        displayName: "OpenCode",
        detected: await isHttpReachable(opencodeUrl),
        binaryPath: "opencode",
        configDirectory: process.env.OPENCODE_CONFIG_DIR ?? "/config",
      }]
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
        return []
      }
      return getOpenCodeContainerLogs(opencodeContainerControlEnabled, opencodeContainerController)
    },
    async getFrpStatus() { return getServerFrpStatus(await frpPanelClient.health()) },
    async saveFrpConfig() {},
    async startFrp() { return { jobId: "start-frp:server", status: "failed", message: "FRP server execution is not connected yet." } },
    async stopFrp() { return { jobId: "stop-frp:server", status: "failed", message: "FRP server execution is not connected yet." } },
    async getCloudflareTunnelStatus() { return { mode: "unavailable", running: false, message: "Cloudflare runtime is not connected yet." } },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() { throw new Error("Cloudflare plan integration is not connected yet") },
    async startCloudflareTunnel() { return { jobId: "start-cloudflare:server", status: "failed", message: "Cloudflare execution is not connected yet." } },
    async stopCloudflareTunnel() { return { jobId: "stop-cloudflare:server", status: "failed", message: "Cloudflare execution is not connected yet." } },
    async retryCloudflareTunnelStep(stepId) {
      return { jobId: `retry-cloudflare:${stepId}`, status: "failed", message: "Cloudflare retry is not connected yet." }
    },
  }
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
