import { describe, expect, it } from "bun:test"
import type { ManagementClient } from "../../../management-api/client"
import type { Diagnostics, FrpStatus, JobResult, LogLine, RuntimeInfo } from "../../../management-api/types"
import { loadDashboardViewModel } from "./dashboard-view-model"

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
        currentPort: 4096,
        status: "running",
      },
    ],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
  },
}

const frpStatus: FrpStatus = {
  mode: "server",
  running: true,
  status: "ready",
  message: "FRP server is running.",
}

const logs: LogLine[] = [{ timestamp: "2026-05-14T10:00:00.000Z", level: "info", message: "OpenCode started" }]

describe("loadDashboardViewModel", () => {
  it("loads runtime info, FRP status, and logs for the first tool instance", async () => {
    const calls: string[] = []
    const client = createClient(calls)

    const model = await loadDashboardViewModel(client)

    expect(model.runtimeInfo).toEqual(runtimeInfo)
    expect(model.frpStatus).toEqual(frpStatus)
    expect(model.logs).toEqual(logs)
    expect(calls).toEqual(["getRuntimeInfo", "getFrpStatus", "getToolLogs:opencode-server"])
  })
})

function createClient(calls: string[]): ManagementClient {
  const job: JobResult = { jobId: "noop", status: "succeeded", message: "ok" }
  const diagnostics: Diagnostics = { runtime: runtimeInfo, tools: [], endpoints: [], frp: frpStatus, jobs: [], redactedLogs: [] }

  return {
    async getRuntimeInfo() {
      calls.push("getRuntimeInfo")
      return runtimeInfo
    },
    async detectTools() {
      return []
    },
    async listToolInstances() {
      return runtimeInfo.config.toolInstances
    },
    async installTool() {
      return job
    },
    async startTool() {
      return job
    },
    async stopTool() {
      return job
    },
    async restartTool() {
      return job
    },
    async getToolLogs(instanceId: string) {
      calls.push(`getToolLogs:${instanceId}`)
      return logs
    },
    async readConfig(target) {
      return { target, content: "{}" }
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
      return job
    },
    async disableEndpoint() {
      return job
    },
    async getFrpStatus() {
      calls.push("getFrpStatus")
      return frpStatus
    },
    async saveFrpConfig() {},
    async startFrp() {
      return job
    },
    async stopFrp() {
      return job
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
      return job
    },
    async stopCloudflareTunnel() {
      return job
    },
    async retryCloudflareTunnelStep() {
      return { jobId: "retry-cloudflare", status: "succeeded", message: "ok" }
    },
    async getSecurityChecks() { return [] },
    async getBackupSummary() { return { count: 0, backupDirectory: "", failureRecords: [], canManualBackup: false, canCleanup: false } },
    async runManualBackup() { return job },
    async cleanupOldBackups() { return job },
    async getDiagnostics() { return diagnostics },
  }
}
