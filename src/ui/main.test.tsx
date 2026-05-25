import { afterEach, describe, expect, it } from "bun:test"
import { act } from "react"
import type { ManagementClient } from "../management-api/client"
import type { Diagnostics, FrpStatus, JobResult, RuntimeInfo } from "../management-api/types"
import { bootManagementUi } from "./main"

afterEach(() => {
  document.body.innerHTML = ""
})

describe("bootManagementUi", () => {
  it("starts the desktop auto tunnel when the Tauri client exposes the startup command", async () => {
    const root = document.createElement("div")
    root.id = "root"
    document.body.append(root)
    let startCalls = 0
    const client = {
      ...createNoopClient(),
      async startDesktopAutoTunnel() {
        startCalls++
        return { deviceId: "desktop-alice", deviceName: "Alice Laptop", opencodeStatus: "running" as const, tunnelStatus: "connected" as const, frpcStatus: "running" as const, publicUrl: "https://alice.frp.example.com", localPort: 4096 }
      },
    }

    await act(async () => {
      bootManagementUi({ createClient: () => client })
    })
    await act(async () => {})

    expect(startCalls).toBe(1)
  })

  it("renders the real app entry with a redacted ManagementClient failure", async () => {
    const root = document.createElement("div")
    root.id = "root"
    document.body.append(root)

    await act(async () => {
      bootManagementUi({
        createClient: () => createFailingClient(new Error("Authorization: Basic raw-basic token=raw-token authToken=raw-camel")),
      })
    })
    await act(async () => {})

    expect(root.textContent).toContain("Management backend is unavailable")
    expect(root.textContent).toContain("Authorization: Basic [REDACTED]")
    expect(root.textContent).toContain("token=[REDACTED]")
    expect(root.textContent).toContain("authToken=[REDACTED]")
    expect(root.textContent).not.toContain("raw-basic")
    expect(root.textContent).not.toContain("raw-token")
    expect(root.textContent).not.toContain("raw-camel")
  })
})

function createFailingClient(error: Error): ManagementClient {
  const base = createNoopClient()
  return {
    ...base,
    async getRuntimeInfo() {
      throw error
    },
  }
}

function createNoopClient(): ManagementClient {
  const runtimeInfo: RuntimeInfo = {
    capabilities: {
      mode: "server",
      canManageFrpServer: true,
      canManageFrpClient: false,
      canInstallServerServices: true,
      canAccessLocalFilesystem: true,
      canManageSystemd: true,
      canManageLocalProcesses: true,
    },
    config: { mode: "server", toolInstances: [], pluginConfigs: [], publicEndpoints: [], frpClients: [] },
  }
  const frpStatus: FrpStatus = { mode: "server", running: false, message: "FRP server stopped." }
  const job: JobResult = { jobId: "noop", status: "succeeded", message: "ok" }
  const diagnostics: Diagnostics = { runtime: runtimeInfo, tools: [], endpoints: [], frp: frpStatus, jobs: [], redactedLogs: [] }

  return {
    async getRuntimeInfo() { return runtimeInfo },
    async detectTools() { return [] },
    async listToolInstances() { return [] },
    async installTool() { return job },
    async startTool() { return job },
    async stopTool() { return job },
    async restartTool() { return job },
    async getToolLogs() { return [] },
    async readConfig(target) { return { target, content: "" } },
    async validateConfig() { return { valid: true, fieldErrors: [] } },
    async saveConfig() {},
    async listPresets() { return [] },
    async applyPreset() {},
    async listBackups() { return [] },
    async restoreBackup() {},
    async listEndpoints() { return [] },
    async saveEndpoint() {},
    async enableEndpoint() { return job },
    async disableEndpoint() { return job },
    async getFrpStatus() { return frpStatus },
    async saveFrpConfig() {},
    async startFrp() { return job },
    async stopFrp() { return job },
    async listDesktopTunnelDevices() { return [] },
    async provisionDesktopTunnel() { throw new Error("Desktop tunnel provisioning is not configured for this test client") },
    async sendDesktopTunnelHeartbeat() { throw new Error("Desktop tunnel heartbeat is not configured for this test client") },
    async deleteDesktopTunnelDevice() {},    async getCloudflareTunnelStatus() { return { mode: "quick", running: false, message: "Cloudflare Tunnel stopped" } },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() { return { mode: "quick", localUrl: "http://127.0.0.1:4096", commandSummary: [], cloudflaredDetected: false, diagnostics: [], securityNotes: [], steps: [] } },
    async startCloudflareTunnel() { return job },
    async stopCloudflareTunnel() { return job },
    async retryCloudflareTunnelStep() { return job },
    async getSecurityChecks() { return [] },
    async getBackupSummary() { return { count: 0, backupDirectory: "", failureRecords: [], canManualBackup: false, canCleanup: false } },
    async runManualBackup() { return job },
    async cleanupOldBackups() { return job },
    async getDiagnostics() { return diagnostics },
  }
}
