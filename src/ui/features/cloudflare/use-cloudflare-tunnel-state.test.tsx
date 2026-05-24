import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../../management-api/client"
import type {
  CloudflareTunnelConfigRequest,
  CloudflareTunnelPlan,
  CloudflareTunnelStatus,
  CloudflareTunnelStepId,
  ConfigBackup,
  ConfigDocument,
  ConfigPreset,
  ConfigTarget,
  FrpConfigRequest,
  FrpStatus,
  InstallToolRequest,
  JobResult,
  LogLine,
  PublicEndpoint,
  RuntimeInfo,
  ToolDetection,
  ToolInstance,
} from "../../../management-api/types"
import { ActionRunner } from "../../app/action-runner"
import {
  createDefaultCloudflareTunnelConfig,
  getCloudflareFailureGuidance,
  redactCloudflareTunnelText,
  useCloudflareTunnelState,
  validateCloudflareTunnelConfig,
  type CloudflareTunnelState,
} from "./use-cloudflare-tunnel-state"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

const successJob: JobResult = { jobId: "cloudflare-job", status: "succeeded", message: "ok" }

const cloudflareEndpoint: PublicEndpoint = {
  id: "cloudflare-route",
  name: "Cloudflare Route",
  domain: "opencode.example.com",
  protocol: "https",
  targetType: "cloudflare",
  targetToolInstanceId: "opencode-desktop",
  authMode: "opencode-password",
  status: "disabled",
}

const opencodeTool: ToolInstance = {
  id: "opencode-desktop",
  kind: "opencode",
  displayName: "OpenCode",
  hostType: "desktop",
  installState: "configured",
  defaultPort: 4096,
  currentPort: 4096,
  status: "running",
}

const cloudflaredTool: ToolInstance = {
  id: "cloudflared-desktop",
  kind: "cloudflared",
  displayName: "cloudflared",
  hostType: "desktop",
  installState: "installed",
  binaryPath: "cloudflared",
  defaultPort: 0,
  status: "stopped",
}

const runtimeInfo: RuntimeInfo = {
  capabilities: {
    mode: "desktop",
    canManageFrpServer: false,
    canManageFrpClient: true,
    canInstallServerServices: false,
    canAccessLocalFilesystem: true,
    canManageSystemd: false,
    canManageLocalProcesses: true,
  },
  config: {
    mode: "desktop",
    toolInstances: [opencodeTool, cloudflaredTool],
    pluginConfigs: [],
    publicEndpoints: [cloudflareEndpoint],
    frpClients: [],
  },
}

const quickConfig: CloudflareTunnelConfigRequest = {
  mode: "quick",
  localHost: "127.0.0.1",
  localPort: 4096,
}

const namedConfig: CloudflareTunnelConfigRequest = {
  mode: "named",
  localHost: "127.0.0.1",
  localPort: 4096,
  tunnelName: "local-opencode",
  hostname: "opencode.example.com",
  dnsRoute: "opencode.example.com",
}

const quickPlan: CloudflareTunnelPlan = {
  mode: "quick",
  localUrl: "http://127.0.0.1:4096",
  publicUrl: "https://blue-river.trycloudflare.com",
  commandSummary: ["cloudflared tunnel --url http://127.0.0.1:4096"],
  cloudflaredDetected: true,
  diagnostics: [],
  securityNotes: ["Never expose OpenCode without a strong password."],
  steps: [],
}

const namedPlan: CloudflareTunnelPlan = {
  mode: "named",
  tunnelName: "local-opencode",
  hostname: "opencode.example.com",
  dnsRoute: "opencode.example.com",
  localUrl: "http://127.0.0.1:4096",
  publicUrl: "https://opencode.example.com",
  commandSummary: [
    "cloudflared tunnel login",
    "cloudflared tunnel create local-opencode",
    "cloudflared tunnel route dns local-opencode opencode.example.com",
    "cloudflared tunnel run local-opencode",
  ],
  cloudflaredDetected: true,
  diagnostics: [],
  securityNotes: ["Named tunnels require a Cloudflare-managed hostname."],
  steps: [
    { id: "login", label: "Login", status: "succeeded", retryable: true },
    { id: "create_tunnel", label: "Create tunnel", status: "succeeded", retryable: true },
    { id: "configure_dns", label: "Configure DNS", status: "failed", message: "DNS record failed", retryable: true },
    { id: "write_config", label: "Write config", status: "idle", retryable: true },
    { id: "start_tunnel", label: "Start tunnel", status: "idle", retryable: true },
    { id: "verify_public_access", label: "Verify public access", status: "idle", retryable: true },
  ],
}

const quickStatus: CloudflareTunnelStatus = {
  mode: "quick",
  running: false,
  message: "Quick tunnel is stopped.",
  publicUrl: quickPlan.publicUrl,
  currentStep: "start_tunnel",
  failureReason: "cloudflared_missing",
  suggestion: "Install cloudflared before starting the tunnel.",
}

interface FakeClientControls {
  client: ManagementClient
  calls: {
    getRuntimeInfo: number
    getCloudflareTunnelStatus: number
    saveCloudflareTunnelConfig: CloudflareTunnelConfigRequest[]
    createCloudflareTunnelPlan: CloudflareTunnelConfigRequest[]
    startCloudflareTunnel: CloudflareTunnelConfigRequest[]
    stopCloudflareTunnel: number
    retryCloudflareTunnelStep: CloudflareTunnelStepId[]
  }
  setRuntimeInfo(info: RuntimeInfo): void
  setStatus(status: CloudflareTunnelStatus): void
  setPlan(plan: CloudflareTunnelPlan): void
  setStartHandler(handler: () => Promise<JobResult>): void
}

function createFakeClient(initialStatus: CloudflareTunnelStatus = quickStatus, initialPlan: CloudflareTunnelPlan = quickPlan): FakeClientControls {
  let info = runtimeInfo
  let status = initialStatus
  let plan = initialPlan
  let startHandler = async () => successJob
  const calls: FakeClientControls["calls"] = {
    getRuntimeInfo: 0,
    getCloudflareTunnelStatus: 0,
    saveCloudflareTunnelConfig: [],
    createCloudflareTunnelPlan: [],
    startCloudflareTunnel: [],
    stopCloudflareTunnel: 0,
    retryCloudflareTunnelStep: [],
  }

  const client: ManagementClient = {
    async getRuntimeInfo() {
      calls.getRuntimeInfo += 1
      return info
    },
    async detectTools(): Promise<ToolDetection[]> {
      return []
    },
    async listToolInstances(): Promise<ToolInstance[]> {
      return info.config.toolInstances
    },
    async installTool(_request: InstallToolRequest) {
      return successJob
    },
    async startTool(_instanceId: string) {
      return successJob
    },
    async stopTool(_instanceId: string) {
      return successJob
    },
    async restartTool(_instanceId: string) {
      return successJob
    },
    async getToolLogs(_instanceId: string): Promise<LogLine[]> {
      return []
    },
    async readConfig(target: ConfigTarget): Promise<ConfigDocument> {
      return { target, content: "{}" }
    },
    async validateConfig() {
      return { valid: true, fieldErrors: [] }
    },
    async saveConfig() {},
    async listPresets(): Promise<ConfigPreset[]> {
      return []
    },
    async applyPreset() {},
    async listBackups(): Promise<ConfigBackup[]> {
      return []
    },
    async restoreBackup() {},
    async listEndpoints() {
      return info.config.publicEndpoints
    },
    async saveEndpoint() {},
    async enableEndpoint() {
      return successJob
    },
    async disableEndpoint() {
      return successJob
    },
    async getFrpStatus(): Promise<FrpStatus> {
      return { mode: "client", running: false, message: "frpc stopped" }
    },
    async saveFrpConfig(_config: FrpConfigRequest) {},
    async startFrp() {
      return successJob
    },
    async stopFrp() {
      return successJob
    },
    async getCloudflareTunnelStatus() {
      calls.getCloudflareTunnelStatus += 1
      return status
    },
    async saveCloudflareTunnelConfig(config: CloudflareTunnelConfigRequest) {
      calls.saveCloudflareTunnelConfig.push(config)
    },
    async createCloudflareTunnelPlan(config: CloudflareTunnelConfigRequest) {
      calls.createCloudflareTunnelPlan.push(config)
      return plan
    },
    async startCloudflareTunnel(config: CloudflareTunnelConfigRequest) {
      calls.startCloudflareTunnel.push(config)
      return startHandler()
    },
    async stopCloudflareTunnel() {
      calls.stopCloudflareTunnel += 1
      return successJob
    },
    async retryCloudflareTunnelStep(stepId: CloudflareTunnelStepId) {
      calls.retryCloudflareTunnelStep.push(stepId)
      return { jobId: "retry-cloudflare", status: "succeeded", message: "ok" }
    },
    async getSecurityChecks() { return [] },
    async getBackupSummary() { return { count: 0, backupDirectory: "", failureRecords: [], canManualBackup: false, canCleanup: false } },
    async runManualBackup() { return successJob },
    async cleanupOldBackups() { return successJob },
    async getDiagnostics() { return { runtime: info, tools: [], endpoints: [], frp: { mode: "client", running: false, message: "frpc stopped" }, jobs: [], redactedLogs: [] } },
  }

  return {
    client,
    calls,
    setRuntimeInfo(nextInfo) {
      info = nextInfo
    },
    setStatus(nextStatus) {
      status = nextStatus
    },
    setPlan(nextPlan) {
      plan = nextPlan
    },
    setStartHandler(handler) {
      startHandler = handler
    },
  }
}

async function renderCloudflareState(client: ManagementClient): Promise<{ current(): CloudflareTunnelState }> {
  const runner = new ActionRunner()
  let latestState: CloudflareTunnelState | undefined

  function Probe() {
    latestState = useCloudflareTunnelState(client, runner)
    return null
  }

  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => root.render(<Probe />))
  await act(async () => {})

  return {
    current() {
      if (!latestState) throw new Error("Cloudflare state probe did not render.")
      return latestState
    },
  }
}

describe("Cloudflare tunnel state validation", () => {
  it("builds safe defaults and validates quick plus named tunnel drafts", () => {
    expect(createDefaultCloudflareTunnelConfig(runtimeInfo, cloudflareEndpoint)).toEqual(quickConfig)

    const quickResult = validateCloudflareTunnelConfig({ ...quickConfig, localPort: 70000 })
    expect(quickResult.ok).toBe(false)
    expect(quickResult.issues.join(" ")).toContain("Local port must be between 1 and 65535")

    const namedResult = validateCloudflareTunnelConfig({ mode: "named", localHost: "127.0.0.1", localPort: 4096, hostname: "not a host", tunnelName: "bad name!" })
    expect(namedResult.ok).toBe(false)
    expect(namedResult.issues.join(" ")).toContain("Named tunnels require a valid hostname")
    expect(namedResult.issues.join(" ")).toContain("Tunnel name can contain only letters, numbers, dots, underscores, and hyphens")
    expect(namedResult.issues.join(" ")).toContain("DNS route is required")
  })

  it("redacts tokens, authorization headers, password assignments, and secret query strings", () => {
    const raw = "cloudflared tunnel run --token super-secret-token Authorization: Bearer api-token OPENCODE_SERVER_PASSWORD=hunter2 https://example.com/callback?token=abc&safe=1"

    const redacted = redactCloudflareTunnelText(raw)

    expect(redacted).not.toContain("super-secret-token")
    expect(redacted).not.toContain("api-token")
    expect(redacted).not.toContain("hunter2")
    expect(redacted).not.toContain("token=abc")
    expect(redacted).toContain("--token <redacted>")
    expect(redacted).toContain("Authorization: Bearer <redacted>")
    expect(redacted).toContain("OPENCODE_SERVER_PASSWORD=<redacted>")
    expect(redacted).toContain("token=<redacted>")
  })
})

describe("useCloudflareTunnelState", () => {
  it("initializes runtime info, status, default quick config, and generated plan", async () => {
    const fake = createFakeClient()
    const probe = await renderCloudflareState(fake.client)

    expect(probe.current().loading).toBe(false)
    expect(probe.current().runtimeInfo).toEqual(runtimeInfo)
    expect(probe.current().status?.mode).toBe("quick")
    expect(probe.current().config).toEqual(quickConfig)
    expect(probe.current().plan).toEqual(quickPlan)
    expect(fake.calls.getRuntimeInfo).toBe(1)
    expect(fake.calls.getCloudflareTunnelStatus).toBe(1)
    expect(fake.calls.createCloudflareTunnelPlan).toEqual([quickConfig])
  })

  it("saves named tunnel draft, regenerates the plan, and starts through ManagementClient", async () => {
    const fake = createFakeClient(quickStatus, namedPlan)
    const probe = await renderCloudflareState(fake.client)

    await act(async () => {
      await probe.current().saveConfig(namedConfig)
    })

    expect(fake.calls.saveCloudflareTunnelConfig).toEqual([namedConfig])
    expect(fake.calls.createCloudflareTunnelPlan.at(-1)).toEqual(namedConfig)
    expect(probe.current().config).toEqual(namedConfig)
    expect(probe.current().plan?.mode).toBe("named")

    fake.setStatus({ mode: "named", running: true, message: "Named tunnel is running.", publicUrl: "https://opencode.example.com" })
    await act(async () => {
      await probe.current().startTunnel()
    })

    expect(fake.calls.startCloudflareTunnel).toEqual([namedConfig])
    expect(probe.current().status?.running).toBe(true)
  })

  it("blocks start when cloudflared or OpenCode prerequisites are missing", async () => {
    const fake = createFakeClient()
    fake.setRuntimeInfo({
      ...runtimeInfo,
      config: {
        ...runtimeInfo.config,
        toolInstances: [
          { ...opencodeTool, status: "stopped" },
          { ...cloudflaredTool, installState: "missing", binaryPath: undefined },
        ],
      },
    })
    const probe = await renderCloudflareState(fake.client)

    let message = ""
    await act(async () => {
      await probe.current().startTunnel().catch((error: unknown) => {
        message = error instanceof Error ? error.message : String(error)
      })
    })

    expect(message).toContain("OpenCode must be running")
    expect(message).toContain("cloudflared binary must be installed")
    expect(fake.calls.startCloudflareTunnel).toEqual([])
  })

  it("blocks start when no Cloudflare endpoint reports OpenCode password protection", async () => {
    const fake = createFakeClient()
    fake.setRuntimeInfo({
      ...runtimeInfo,
      config: {
        ...runtimeInfo.config,
        publicEndpoints: [
          {
            ...cloudflareEndpoint,
            authMode: "basic-auth",
          },
        ],
      },
    })
    const probe = await renderCloudflareState(fake.client)

    let message = ""
    await act(async () => {
      await probe.current().startTunnel().catch((error: unknown) => {
        message = error instanceof Error ? error.message : String(error)
      })
    })

    expect(message).toContain("OpenCode password protection must be configured")
    expect(fake.calls.startCloudflareTunnel).toEqual([])
  })

  it("retries a failed named tunnel step and preserves actionable guidance", async () => {
    const fake = createFakeClient({ ...quickStatus, mode: "named", failureReason: "dns_route_failed", suggestion: "Check Cloudflare DNS permissions." }, namedPlan)
    const probe = await renderCloudflareState(fake.client)

    await act(async () => {
      await probe.current().saveConfig(namedConfig)
    })
    await act(async () => {
      await probe.current().retryStep("configure_dns")
    })

    expect(fake.calls.retryCloudflareTunnelStep).toEqual(["configure_dns"])
    expect(getCloudflareFailureGuidance("dns_route_failed")).toContain("DNS")
    expect(probe.current().getActionStatus("cloudflare:retry:configure_dns")).toBe("succeeded")
  })
})
