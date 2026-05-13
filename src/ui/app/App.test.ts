import { describe, expect, it } from "bun:test"
import type { ManagementClient } from "../../management-api/client"
import { renderManagementApp } from "./App"

function createClient(): ManagementClient {
  return {
    async getRuntimeInfo() {
      return {
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
              configDirectory: "/opt/opencode-remote-platform/config",
              defaultPort: 4096,
              currentPort: 4096,
              status: "running",
            },
          ],
          pluginConfigs: [
            {
              toolInstanceId: "opencode-server",
              plugin: "oh-my-openagent",
              configPath: "/opt/opencode-remote-platform/config/oh-my-openagent.json",
              status: "configured",
              presets: [],
            },
          ],
          publicEndpoints: [],
          frpServer: {
            enabled: true,
            panelUrl: "https://frp.example.com",
            rpcUrl: "https://frp.example.com/rpc",
            serverAddr: "frp.example.com",
            bindPort: 7000,
            authTokenRef: "FRP_TOKEN",
            dashboardEnabled: true,
          },
          frpClients: [],
        },
      }
    },
    async detectTools() {
      return [{ kind: "opencode", displayName: "OpenCode", detected: true }]
    },
    async listToolInstances() {
      return (await this.getRuntimeInfo()).config.toolInstances
    },
    async installTool() {
      return { jobId: "install", status: "succeeded", message: "ok" }
    },
    async startTool() {
      return { jobId: "start", status: "succeeded", message: "ok" }
    },
    async stopTool() {
      return { jobId: "stop", status: "succeeded", message: "ok" }
    },
    async restartTool() {
      return { jobId: "restart", status: "succeeded", message: "ok" }
    },
    async getToolLogs() {
      return []
    },
    async readConfig(target) {
      return { target, content: "{}" }
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
      return { jobId: "enable", status: "succeeded", message: "ok" }
    },
    async disableEndpoint() {
      return { jobId: "disable", status: "succeeded", message: "ok" }
    },
    async getFrpStatus() {
      return { mode: "server", running: true, message: "FRP server is running." }
    },
    async saveFrpConfig() {},
    async startFrp() {
      return { jobId: "start-frp", status: "succeeded", message: "ok" }
    },
    async stopFrp() {
      return { jobId: "stop-frp", status: "succeeded", message: "ok" }
    },
  }
}

describe("management app", () => {
  it("renders the layout and all management sections", async () => {
    const app = await renderManagementApp(createClient())

    expect(app).toContain("server:Dashboard|Tools|Config|Endpoints|FRP|Settings")
    expect(app).toContain("dashboard:server")
    expect(app).toContain("tools:1")
    expect(app).toContain("config:opencode=loaded")
    expect(app).toContain("frp:server")
    expect(app).toContain("settings:mode=server")
  })
})
