import { describe, expect, it } from "bun:test"
import type { ManagementClient } from "../../management-api/client"
import { renderManagementApp } from "./App"

function createClient(mode: "server" | "desktop" = "server"): ManagementClient {
  return {
    async getRuntimeInfo() {
      return {
        capabilities: {
          mode,
          canManageFrpServer: mode === "server",
          canManageFrpClient: mode === "desktop",
          canInstallServerServices: mode === "server",
          canAccessLocalFilesystem: true,
          canManageSystemd: mode === "server",
          canManageLocalProcesses: true,
        },
        config: {
          mode,
          toolInstances: mode === "server" ? [
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
          ] : [],
          pluginConfigs: mode === "server" ? [
            {
              toolInstanceId: "opencode-server",
              plugin: "oh-my-openagent",
              configPath: "/opt/opencode-remote-platform/config/oh-my-openagent.json",
              status: "configured",
              presets: [],
            },
          ] : [],
          publicEndpoints: [],
          frpServer: mode === "server" ? {
            enabled: true,
            panelUrl: "https://frp.example.com",
            rpcUrl: "https://frp.example.com/rpc",
            serverAddr: "frp.example.com",
            bindPort: 7000,
            authTokenRef: "FRP_TOKEN",
            dashboardEnabled: true,
          } : undefined,
          frpClients: [],
        },
      }
    },
    async detectTools() {
      return []
    },
    async listToolInstances() {
      return (await this.getRuntimeInfo()).config.toolInstances
    },
    async installTool() { return { jobId: "i", status: "succeeded", message: "ok" } },
    async startTool() { return { jobId: "s", status: "succeeded", message: "ok" } },
    async stopTool() { return { jobId: "t", status: "succeeded", message: "ok" } },
    async restartTool() { return { jobId: "r", status: "succeeded", message: "ok" } },
    async getToolLogs() { return [] },
    async readConfig() { return { target: { toolInstanceId: "x", kind: "opencode" }, content: "{}" } },
    async validateConfig() { return { valid: true, fieldErrors: [] } },
    async saveConfig() {},
    async listPresets() { return [] },
    async applyPreset() {},
    async listBackups() { return [] },
    async restoreBackup() {},
    async listEndpoints() { return [] },
    async saveEndpoint() {},
    async enableEndpoint() { return { jobId: "e", status: "succeeded", message: "ok" } },
    async disableEndpoint() { return { jobId: "d", status: "succeeded", message: "ok" } },
    async getFrpStatus() { return { mode: mode === "desktop" ? "client" : "server", running: true, message: "ok" } },
    async saveFrpConfig() {},
    async startFrp() { return { jobId: "sf", status: "succeeded", message: "ok" } },
    async stopFrp() { return { jobId: "tf", status: "succeeded", message: "ok" } },
  }
}

describe("management app", () => {
  it("renders the layout and all management sections dynamically", async () => {
    const serverApp = await renderManagementApp(createClient("server"))
    expect(serverApp).toContain("OpenCode Platform (server)")
    expect(serverApp).toContain("dashboard:server")
    expect(serverApp).toContain("frp:server")
    expect(serverApp).toContain("settings:mode=server")

    const desktopApp = await renderManagementApp(createClient("desktop"))
    expect(desktopApp).toContain("OpenCode Platform (desktop)")
    expect(desktopApp).toContain("dashboard:desktop")
    expect(desktopApp).toContain("frp:client")
    expect(desktopApp).toContain("settings:mode=desktop")
  })
})
