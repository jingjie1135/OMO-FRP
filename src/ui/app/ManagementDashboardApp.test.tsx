import { afterEach, describe, expect, it } from "bun:test"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../management-api/client"
import type { Diagnostics, FrpStatus, JobResult, RuntimeInfo } from "../../management-api/types"
import type { DashboardViewModel } from "../features/dashboard/dashboard-view-model"
import { ManagementDashboardApp } from "./ManagementDashboardApp"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

function createDashboard(message: string): DashboardViewModel {
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
    logs: [{ timestamp: "2026-05-14T10:00:00.000Z", level: "info", message: "OpenCode started" }],
  }
}

function createClient(results: Array<DashboardViewModel | Error>): ManagementClient {
  let callIndex = 0
  const successJob: JobResult = { jobId: "settings", status: "succeeded", message: "ok" }

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

  return {
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
    async readConfig() {
      return { target: { toolInstanceId: "opencode-server", kind: "opencode" }, content: "" }
    },
    async validateConfig() {
      return { valid: true, fieldErrors: [] }
    },
    async saveConfig() {},
    async listPresets() {
      return []
    },
    async applyPreset() {},
    async listBackups() {
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
    async getCloudflareTunnelStatus() {
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

    expect(container.textContent).toContain("OpenCode Remote")
    expect(container.textContent).toContain("主控台")
    expect(container.textContent).toContain("工具管理")
    expect(container.textContent).toContain("公网入口")
    expect(container.textContent).toContain("Cloudflare Tunnel")
    expect(container.textContent).toContain("服务器模式")
    expect(container.textContent).toContain("FRP server is running.")
    expect(container.textContent).toContain("OpenCode started")
  })

  it("shows an initial load failure with retry affordance", async () => {
    const container = await renderApp(createClient([new Error("api unavailable")]))

    expect(container.textContent).toContain("api unavailable")
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
})
