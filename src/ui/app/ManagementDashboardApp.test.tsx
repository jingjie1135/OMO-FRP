import { afterEach, describe, expect, it } from "bun:test"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../management-api/client"
import type { ConfigTarget, DesktopTunnelDevice, Diagnostics, FrpStatus, JobResult, RuntimeInfo } from "../../management-api/types"
import type { DashboardViewModel } from "../features/dashboard/dashboard-view-model"
import { ManagementDashboardApp } from "./ManagementDashboardApp"

const mountedRoots: Root[] = []
type TestManagementClient = ManagementClient & { configTargets: ConfigTarget[] }

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

function createDashboard(message: string, logMessage = "OpenCode started"): DashboardViewModel {
  return {
    runtimeInfo: {
      capabilities: {
        mode: "server",
        canManageFrpServer: true,
        canManageFrpClient: false,
        canManageCloudflareTunnel: true,
        canInstallServerServices: true,
        canAccessLocalFilesystem: true,
        canManageSystemd: true,
        canManageLocalProcesses: true,
      },
      config: {
        mode: "server",
        toolInstances: [
          {
            id: "opencode-server",
            kind: "opencode",
            displayName: "OpenCode",
            hostType: "server",
            installState: "configured",
            defaultPort: 4096,
            status: "running",
          },
        ],
        pluginConfigs: [],
        publicEndpoints: [],
        frpClients: [],
      },
    },
    frpStatus: { mode: "server", running: true, message },
    logs: [{ timestamp: "2026-05-14T10:00:00.000Z", level: "info", message: logMessage }],
  }
}

function createClient(results: Array<DashboardViewModel | Error>, desktopDevices: DesktopTunnelDevice[] = []): TestManagementClient {
  let callIndex = 0
  const successJob: JobResult = { jobId: "settings", status: "succeeded", message: "ok" }
  const configTargets: ConfigTarget[] = []

  const getCurrentRuntimeInfo = (): RuntimeInfo => {
    const result = results[Math.min(callIndex, results.length - 1)]
    if (result instanceof Error) {
      return createDashboard("fallback").runtimeInfo
    }
    return result.runtimeInfo
  }

  const getCurrentFrpStatus = (): FrpStatus => {
    const result = results[Math.min(callIndex, results.length - 1)]
    if (result instanceof Error) {
      return { mode: "server", running: false, message: "FRP server stopped." }
    }
    return result.frpStatus
  }

  const getCurrentDiagnostics = (): Diagnostics => ({ runtime: getCurrentRuntimeInfo(), tools: [], endpoints: [], frp: getCurrentFrpStatus(), jobs: [], redactedLogs: [] })

  const client: ManagementClient = {
    async getRuntimeInfo() {
      const result = results[Math.min(callIndex, results.length - 1)]
      if (result instanceof Error) throw result
      return result.runtimeInfo
    },
    async getFrpStatus() {
      const result = results[Math.min(callIndex, results.length - 1)]
      if (result instanceof Error) throw result
      return result.frpStatus
    },
    async getToolLogs() {
      const result = results[Math.min(callIndex, results.length - 1)]
      callIndex += 1
      if (result instanceof Error) throw result
      return result.logs
    },
    async detectTools() {
      return []
    },
    async listToolInstances() {
      return []
    },
    async installTool() {
      return { jobId: "install", status: "succeeded", message: "installed" }
    },
    async startTool() {
      return { jobId: "start", status: "succeeded", message: "started" }
    },
    async stopTool() {
      return { jobId: "stop", status: "succeeded", message: "stopped" }
    },
    async restartTool() {
      return { jobId: "restart", status: "succeeded", message: "restarted" }
    },
    async readConfig(target) {
      configTargets.push(target)
      return { target, content: `content for ${target.toolInstanceId}:${target.kind}` }
    },
    async validateConfig() {
      return { valid: true, fieldErrors: [] }
    },
    async saveConfig() {},
    async listPresets(target) {
      configTargets.push(target)
      return []
    },
    async applyPreset() {},
    async listBackups(target) {
      configTargets.push(target)
      return []
    },
    async restoreBackup() {},
    async listEndpoints() {
      return []
    },
    async saveEndpoint() {},
    async enableEndpoint() {
      return { jobId: "enable", status: "succeeded", message: "enabled" }
    },
    async disableEndpoint() {
      return { jobId: "disable", status: "succeeded", message: "disabled" }
    },
    async saveFrpConfig() {},
    async startFrp() {
      return { jobId: "start-frp", status: "succeeded", message: "started" }
    },
    async stopFrp() {
      return { jobId: "stop-frp", status: "succeeded", message: "stopped" }
    },
    async listDesktopTunnelDevices() { return desktopDevices },
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
      return { jobId: "start-cloudflare", status: "succeeded", message: "started" }
    },
    async stopCloudflareTunnel() {
      return { jobId: "stop-cloudflare", status: "succeeded", message: "stopped" }
    },
    async retryCloudflareTunnelStep() {
      return { jobId: "retry-cloudflare", status: "succeeded", message: "ok" }
    },
    async getSecurityChecks() { return [] },
    async getBackupSummary() { return { count: 0, backupDirectory: "", failureRecords: [], canManualBackup: false, canCleanup: false } },
    async runManualBackup() { return successJob },
    async cleanupOldBackups() { return successJob },
    async getDiagnostics() { return getCurrentDiagnostics() },
  }

  return Object.assign(client, { configTargets })
}

async function renderApp(client: ManagementClient) {

  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  await act(async () => root.render(<ManagementDashboardApp client={client} />))
  await act(async () => {})

  return container
}

describe("ManagementDashboardApp", () => {
  it("renders loading state before dashboard data resolves", async () => {
    let resolveRuntimeInfo: (() => void) | undefined
    const dashboard = createDashboard("FRP server is running.")
    const client = createClient([dashboard])
    const originalGetRuntimeInfo = client.getRuntimeInfo
    client.getRuntimeInfo = async () => {
      await new Promise<void>((resolve) => {
        resolveRuntimeInfo = resolve
      })
      return originalGetRuntimeInfo()
    }

    const container = document.createElement("div")
    document.body.append(container)
    const root = createRoot(container)
    mountedRoots.push(root)

    await act(async () => root.render(<ManagementDashboardApp client={client} />))

    expect(container.textContent).toContain("正在加载主控台数据")

    await act(async () => resolveRuntimeInfo?.())
  })

  it("renders the shell navigation, runtime badge, and dashboard content", async () => {
    const container = await renderApp(createClient([createDashboard("FRP server is running.")]))

    expect(container.textContent).toContain("FOMO")
    expect(container.querySelector('[title="FRP-Oh-My-OpenCode"]')?.textContent).toContain("FOMO")
    expect(container.textContent).toContain("v1.2.0-beta")
    expect(container.textContent).toContain("主控台")
    expect(container.textContent).toContain("工具管理")
    expect(container.textContent).toContain("公网入口")
    expect(container.textContent).toContain("Cloudflare 隧道")
    expect(container.textContent).toContain("远程设备")
    expect(container.textContent).toContain("服务器模式")
    expect(container.textContent).toContain("系统在线")
    expect(container.textContent).toContain("FRP server is running.")
    expect(container.textContent).toContain("OpenCode started")
  })

  it("switches sidebar tabs to render the selected management page", async () => {
    const container = await renderApp(createClient([createDashboard("FRP server is running.")]))
    const toolsTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("工具管理"))

    expect(toolsTab).toBeDefined()
    await act(async () => toolsTab?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    expect(container.textContent).toContain("工具管理")
    expect(container.textContent).toContain("工具检测结果")
    expect(container.textContent).not.toContain("FRP server is running.")
  })

  it("renders localized management page titles when switching tabs", async () => {
    const container = await renderApp(createClient([createDashboard("FRP server is running.")]))

    const clickTab = async (label: string) => {
      const tab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes(label))
      expect(tab).toBeDefined()
      await act(async () => tab?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
      await act(async () => {})
    }

    await clickTab("工具管理")
    expect(container.textContent).toContain("工具管理")
    expect(container.textContent).not.toContain("Tools Management")

    await clickTab("公网入口")
    expect(container.textContent).toContain("公网入口")
    expect(container.textContent).not.toContain("Endpoints")

    await clickTab("配置与备份")
    expect(container.textContent).toContain("配置与备份")
    expect(container.textContent).not.toContain("Configuration Editor")

    await clickTab("日志")
    expect(container.textContent).toContain("系统日志")
    expect(container.textContent).toContain("清空日志")
    expect(container.textContent).toContain("导出日志")
    expect(container.textContent).toContain("/var/log/opencode/system.log")
  })

  it("switches to the remote desktop devices page and renders tunnel status", async () => {
    const container = await renderApp(createClient([createDashboard("FRP server is running.")], [
      { id: "desktop-alice", name: "Alice Laptop", status: "online", opencodeStatus: "running", tunnelStatus: "connected", frpcStatus: "running", publicUrl: "https://alice.frp.example.com", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", subdomain: "alice", lastSeenAt: "2026-05-25T00:00:00.000Z" },
    ]))
    const devicesTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("远程设备"))

    expect(devicesTab).toBeDefined()
    await act(async () => devicesTab?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    expect(container.textContent).toContain("远程设备")
    expect(container.textContent).toContain("Alice Laptop")
    expect(container.textContent).toContain("https://alice.frp.example.com")
    expect(container.textContent).toContain("打开 OpenCode")
  })
  it("loads config page data from a real tool instance when opened in the dashboard shell", async () => {
    const client = createClient([createDashboard("FRP server is running.")]) as ManagementClient & { configTargets: ConfigTarget[] }
    const container = await renderApp(client)
    const configTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("配置与备份"))

    expect(configTab).toBeDefined()
    await act(async () => configTab?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    expect(container.textContent).toContain("content for opencode-server:opencode")
    expect(client.configTargets.map((target) => `${target.toolInstanceId}:${target.kind}`)).toContain("opencode-server:opencode")
    expect(client.configTargets.map((target) => target.toolInstanceId)).not.toContain("unknown")
  })

  it("redacts sensitive values in the logs page", async () => {
    const client = createClient([createDashboard("FRP server is running.", "Authorization: Bearer raw-log-token token=client-secret password=Strong-password-123!")])
    const container = await renderApp(client)
    const logsTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("日志"))

    expect(logsTab).toBeDefined()
    await act(async () => logsTab?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    expect(container.textContent).toContain("Authorization: Bearer [REDACTED]")
    expect(container.textContent).toContain("token=[REDACTED]")
    expect(container.textContent).toContain("password=[REDACTED]")
    expect(container.textContent).not.toContain("raw-log-token")
    expect(container.textContent).not.toContain("client-secret")
    expect(container.textContent).not.toContain("Strong-password-123")
  })

  it("uses fomo quick actions to switch from the dashboard into feature pages", async () => {
    const container = await renderApp(createClient([createDashboard("FRP server is running.")]))

    const openFrp = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("更新 FRP 隧道"))
    expect(openFrp).toBeDefined()

    await act(async () => openFrp?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    expect(container.textContent).toContain("FRP 穿透")
    expect(container.textContent).toContain("断开连接")

    const dashboardTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("主控台"))
    expect(dashboardTab).toBeDefined()
    await act(async () => dashboardTab?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    const openSecurity = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("查看入口安全"))
    expect(openSecurity).toBeDefined()

    await act(async () => openSecurity?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    expect(container.textContent).toContain("公网入口")
    expect(container.textContent).toContain("入口校验")
  })

  it("shows an initial load failure with retry affordance", async () => {
    const container = await renderApp(createClient([new Error("api unavailable Authorization: Token raw-dashboard-token")]))

    expect(container.textContent).toContain("api unavailable")
    expect(container.textContent).toContain("Authorization: Token [REDACTED]")
    expect(container.textContent).not.toContain("raw-dashboard-token")
    expect(container.textContent).toContain("重试")
  })

  it("keeps dashboard content visible when refresh fails", async () => {
    const container = await renderApp(createClient([createDashboard("ready"), new Error("refresh failed")]))
    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("刷新"))

    expect(refreshButton).toBeDefined()
    await act(async () => refreshButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })))

    expect(container.textContent).toContain("ready")
    expect(container.textContent).toContain("refresh failed")
  })

  it("leaves a stale Cloudflare page when tunnel capability is removed on refresh", async () => {
    const enabledDashboard = createDashboard("Cloudflare enabled")
    const disabledDashboard = createDashboard("Cloudflare disabled")
    disabledDashboard.runtimeInfo.capabilities.canManageCloudflareTunnel = false
    const client = createClient([enabledDashboard, disabledDashboard])
    const container = await renderApp(client)

    const cloudflareTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Cloudflare 隧道"))
    expect(cloudflareTab).toBeDefined()
    await act(async () => cloudflareTab?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    expect(container.textContent).toContain("Cloudflare Tunnel")

    const refreshButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("刷新"))
    expect(refreshButton).toBeDefined()
    await act(async () => refreshButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })))
    await act(async () => {})

    expect(container.textContent).not.toContain("Cloudflare Tunnel")
    expect(container.textContent).not.toContain("Cloudflare 隧道")
    expect(container.textContent).toContain("主控台")
    expect(container.textContent).toContain("Cloudflare disabled")
  })
})
