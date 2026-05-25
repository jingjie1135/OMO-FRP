import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../../management-api/client"
import type { ConfigBackup, ConfigDocument, ConfigPreset, ConfigTarget, FrpConfigRequest, FrpStatus, InstallToolRequest, JobResult, LogLine, PublicEndpoint, RuntimeInfo, ToolDetection, ToolInstance } from "../../../management-api/types"
import type { FrpClientConfig, FrpServerConfig } from "../../../core/app-config/types"
import { ActionRunner } from "../../app/action-runner"
import {
  buildGeneratedFrpcConfig,
  getFrpFailureGuidance,
  maskFrpTokenRef,
  useFrpState,
  validateFrpClientConfig,
  validateFrpClientStartConfig,
  validateFrpServerConfig,
  type FrpState,
} from "./use-frp-state"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

const successJob: JobResult = { jobId: "frp-job", status: "succeeded", message: "ok" }

const serverConfig: FrpServerConfig = {
  enabled: true,
  panelUrl: "https://frp.example.com",
  rpcUrl: "https://frp.example.com/rpc",
  serverAddr: "frp.example.com",
  bindPort: 7000,
  authTokenRef: "FRP_TOKEN",
  dashboardEnabled: true,
}

const clientConfig: FrpClientConfig = {
  endpointId: "desktop-route",
  serverAddr: "frp.example.com",
  serverPort: 7000,
  authTokenRef: "FRP_TOKEN",
  localHost: "127.0.0.1",
  localPort: 4096,
  proxyName: "desktop-opencode",
  subdomain: "desktop",
  transport: "tcp",
}

const endpoint: PublicEndpoint = {
  id: "desktop-route",
  name: "Desktop Route",
  domain: "desktop.example.com",
  protocol: "https",
  targetType: "desktop-frp",
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

const frpcTool: ToolInstance = {
  id: "frpc-desktop",
  kind: "frpc",
  displayName: "frpc",
  hostType: "desktop",
  installState: "installed",
  binaryPath: "frpc",
  defaultPort: 7000,
  status: "stopped",
}

const serverInfo: RuntimeInfo = {
  capabilities: {
    mode: "server",
    canManageFrpServer: true,
    canManageFrpClient: false,
    canInstallServerServices: true,
    canAccessLocalFilesystem: true,
    canManageSystemd: true,
    canManageLocalProcesses: true,
  },
  config: {
    mode: "server",
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [endpoint],
    frpServer: serverConfig,
    frpClients: [],
  },
}

const desktopInfo: RuntimeInfo = {
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
    toolInstances: [opencodeTool, frpcTool],
    pluginConfigs: [],
    publicEndpoints: [endpoint],
    frpClients: [clientConfig],
  },
}

interface FakeClientControls {
  client: ManagementClient
  calls: {
    getRuntimeInfo: number
    getFrpStatus: number
    listEndpoints: number
    saveFrpConfig: FrpConfigRequest[]
    startFrp: number
    stopFrp: number
  }
  setRuntimeInfo(info: RuntimeInfo): void
  setStatus(status: FrpStatus): void
  setStartHandler(handler: () => Promise<JobResult>): void
}

function createFakeClient(initialInfo: RuntimeInfo, initialStatus: FrpStatus): FakeClientControls {
  let info = initialInfo
  let status = initialStatus
  let startHandler = async () => successJob
  const calls: FakeClientControls["calls"] = {
    getRuntimeInfo: 0,
    getFrpStatus: 0,
    listEndpoints: 0,
    saveFrpConfig: [],
    startFrp: 0,
    stopFrp: 0,
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
      calls.listEndpoints += 1
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
      calls.getFrpStatus += 1
      return status
    },
    async saveFrpConfig(config: FrpConfigRequest) {
      calls.saveFrpConfig.push(config)
    },
    async startFrp() {
      calls.startFrp += 1
      return startHandler()
    },
    async stopFrp() {
      calls.stopFrp += 1
      return successJob
    },
    async listDesktopTunnelDevices() { return [] },
    async provisionDesktopTunnel() { throw new Error("Desktop tunnel provisioning is not configured for this test client") },
    async sendDesktopTunnelHeartbeat() { throw new Error("Desktop tunnel heartbeat is not configured for this test client") },
    async deleteDesktopTunnelDevice() {},    async getCloudflareTunnelStatus() {
      return { mode: "quick", running: false, message: "Cloudflare Tunnel stopped" }
    },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() {
      return { mode: "quick", localUrl: "http://127.0.0.1:4096", commandSummary: [], cloudflaredDetected: false, diagnostics: [], securityNotes: [], steps: [] }
    },
    async startCloudflareTunnel() {
      return successJob
    },
    async stopCloudflareTunnel() {
      return successJob
    },
    async retryCloudflareTunnelStep() {
      return { jobId: "retry-cloudflare", status: "succeeded", message: "ok" }
    },
    async getSecurityChecks() { return [] },
    async getBackupSummary() { return { count: 0, backupDirectory: "", failureRecords: [], canManualBackup: false, canCleanup: false } },
    async runManualBackup() { return successJob },
    async cleanupOldBackups() { return successJob },
    async getDiagnostics() { return { runtime: info, tools: [], endpoints: [], frp: { mode: "server", running: false, message: "FRP server stopped." }, jobs: [], redactedLogs: [] } },
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
    setStartHandler(handler) {
      startHandler = handler
    },
  }
}

async function renderFrpState(client: ManagementClient): Promise<{ current(): FrpState }> {
  const runner = new ActionRunner()
  let latestState: FrpState | undefined

  function Probe() {
    latestState = useFrpState(client, runner)
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
      if (!latestState) throw new Error("FRP state probe did not render.")
      return latestState
    },
  }
}

describe("FRP state validation", () => {
  it("validates server config and rejects masked token placeholders before save", () => {
    const result = validateFrpServerConfig({ ...serverConfig, panelUrl: "not-a-url", rpcUrl: "", serverAddr: "", bindPort: 70000, authTokenRef: "••••••" })

    expect(result.ok).toBe(false)
    expect(result.issues.join(" ")).toContain("Panel 地址必须是有效 URL")
    expect(result.issues.join(" ")).toContain("RPC 地址不能为空")
    expect(result.issues.join(" ")).toContain("服务端地址不能为空")
    expect(result.issues.join(" ")).toContain("绑定端口必须在 1 到 65535 之间")
    expect(result.issues.join(" ")).toContain("保存前请替换被遮罩的 FRP 令牌占位值")
  })

  it("validates desktop client prerequisites before start", () => {
    const result = validateFrpClientStartConfig(
      { ...clientConfig, serverAddr: "", authTokenRef: "", proxyName: "bad name!" },
      {
        ...desktopInfo,
        config: {
          ...desktopInfo.config,
          toolInstances: [
            { ...opencodeTool, status: "stopped" },
            { ...frpcTool, installState: "missing", binaryPath: undefined },
          ],
        },
      },
    )

    expect(result.ok).toBe(false)
    expect(result.issues.join(" ")).toContain("启动 frpc 前必须先启动 OpenCode")
    expect(result.issues.join(" ")).toContain("启动前必须先安装 frpc 二进制")
    expect(result.issues.join(" ")).toContain("服务端地址不能为空")
    expect(result.issues.join(" ")).toContain("令牌引用不能为空")
    expect(result.issues.join(" ")).toContain("代理名称只能包含字母、数字、点、下划线和连字符")
  })

  it("masks token references, maps failure guidance, and generates frpc config without raw secrets", () => {
    expect(maskFrpTokenRef("FRP_TOKEN")).toBe("FRP_TOKEN (masked)")
    expect(maskFrpTokenRef("••••••")).toBe("占位值已遮罩")
    expect(maskFrpTokenRef("super-secret-token")).toBe("已配置密钥（已遮罩）")
    expect(getFrpFailureGuidance("auth_failed")).toContain("令牌引用")
    expect(getFrpFailureGuidance("proxy_not_ready")).toContain("代理")

    const generated = buildGeneratedFrpcConfig(clientConfig)
    expect(generated).toContain("serverAddr = \"frp.example.com\"")
    expect(generated).toContain("serverPort = 7000")
    expect(generated).toContain("token = \"${FRP_TOKEN}\"")
    expect(generated).not.toContain("super-secret")

    const generatedFromRawToken = buildGeneratedFrpcConfig({ ...clientConfig, authTokenRef: "super-secret-token" })
    expect(generatedFromRawToken).toContain("token = \"${FRP_TOKEN}\"")
    expect(generatedFromRawToken).not.toContain("super-secret-token")
    expect(validateFrpClientConfig({ ...clientConfig, authTokenRef: "super-secret-token" }).issues.join(" ")).toContain("类似 FRP_TOKEN 的环境变量名称")
  })
})

describe("useFrpState", () => {
  it("initializes runtime info, status, endpoints, and default configs", async () => {
    const fake = createFakeClient(desktopInfo, { mode: "client", running: false, message: "frpc stopped" })
    const probe = await renderFrpState(fake.client)

    expect(probe.current().loading).toBe(false)
    expect(probe.current().runtimeInfo).toEqual(desktopInfo)
    expect(probe.current().status?.mode).toBe("client")
    expect(probe.current().endpoints).toEqual([endpoint])
    expect(probe.current().clientConfig).toEqual(clientConfig)
  })

  it("saves server config through ManagementClient and refreshes FRP data", async () => {
    const fake = createFakeClient(serverInfo, { mode: "server", running: false, message: "stopped" })
    const probe = await renderFrpState(fake.client)
    fake.calls.getFrpStatus = 0
    fake.calls.listEndpoints = 0

    await act(async () => {
      await probe.current().saveServerConfig(serverConfig)
    })

    expect(fake.calls.saveFrpConfig).toEqual([serverConfig])
    expect(fake.calls.getFrpStatus).toBe(1)
    expect(fake.calls.listEndpoints).toBe(1)
  })

  it("blocks desktop start when safety checks fail and preserves previous status", async () => {
    const unsafeInfo: RuntimeInfo = {
      ...desktopInfo,
      config: {
        ...desktopInfo.config,
        toolInstances: [{ ...opencodeTool, status: "stopped" as const }, { ...frpcTool, installState: "missing" as const, binaryPath: undefined }],
      },
    }
    const fake = createFakeClient(unsafeInfo, { mode: "client", running: false, message: "stopped" })
    const probe = await renderFrpState(fake.client)

    let message = ""
    await act(async () => {
      await probe.current().startFrp().catch((error: unknown) => {
        message = error instanceof Error ? error.message : String(error)
      })
    })

    expect(message).toContain("启动 frpc 前必须先启动 OpenCode")
    expect(fake.calls.startFrp).toBe(0)
    expect(probe.current().status?.running).toBe(false)
  })

  it("saves desktop client config even when start-only runtime prerequisites are not ready", async () => {
    const draftOnlyInfo: RuntimeInfo = {
      ...desktopInfo,
      config: {
        ...desktopInfo.config,
        toolInstances: [{ ...opencodeTool, status: "stopped" as const }, { ...frpcTool, installState: "missing" as const, binaryPath: undefined }],
      },
    }
    const fake = createFakeClient(draftOnlyInfo, { mode: "client", running: false, message: "stopped" })
    const probe = await renderFrpState(fake.client)

    await act(async () => {
      await probe.current().saveClientConfig(clientConfig)
    })

    expect(fake.calls.saveFrpConfig).toEqual([clientConfig])
    expect(fake.calls.startFrp).toBe(0)
  })

  it("starts and stops FRP through ManagementClient and refreshes status plus endpoints", async () => {
    const fake = createFakeClient(desktopInfo, { mode: "client", running: false, message: "stopped" })
    const probe = await renderFrpState(fake.client)
    fake.setStatus({ mode: "client", running: true, message: "frpc running" })
    fake.calls.getFrpStatus = 0
    fake.calls.listEndpoints = 0

    await act(async () => {
      await probe.current().startFrp()
    })

    expect(fake.calls.startFrp).toBe(1)
    expect(fake.calls.getFrpStatus).toBe(1)
    expect(fake.calls.listEndpoints).toBe(1)
    expect(probe.current().status?.running).toBe(true)

    fake.setStatus({ mode: "client", running: false, message: "frpc stopped" })
    await act(async () => {
      await probe.current().stopFrp()
    })

    expect(fake.calls.stopFrp).toBe(1)
    expect(probe.current().status?.running).toBe(false)
  })

  it("treats failed start jobs as actionable FRP errors", async () => {
    const fake = createFakeClient(desktopInfo, { mode: "client", running: false, message: "stopped", failureReason: "auth_failed" })
    fake.setStartHandler(async () => ({ jobId: "start-frp", status: "failed", message: "authentication failed" }))
    const probe = await renderFrpState(fake.client)

    let message = ""
    await act(async () => {
      await probe.current().startFrp().catch((error: unknown) => {
        message = error instanceof Error ? error.message : String(error)
      })
    })

    expect(message).toContain("authentication failed")
    expect(message).toContain("令牌引用")
  })
})
