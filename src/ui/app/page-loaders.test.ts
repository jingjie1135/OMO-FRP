import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../management-api/client"
import {
  loadConfigPage,
  loadDashboardPage,
  loadEndpointsPage,
  loadFrpPage,
  loadSettingsPage,
  loadToolsPage,
} from "./page-loaders"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

function render(element: React.ReactNode) {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  act(() => root.render(element))
  return container
}

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
          publicEndpoints: [
            {
              id: "desktop-route",
              name: "Desktop Route",
              domain: "desktop.example.com",
              protocol: "https",
              targetType: "desktop-frp",
              targetToolInstanceId: "opencode-server",
              authMode: "opencode-password",
              status: "disabled",
            },
          ],
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
    async validateConfig() {
      return { valid: true, fieldErrors: [] }
    },
    async saveConfig() {},
    async listPresets() {
      return [{ id: "fast", name: "fast", path: "/tmp/fast.json", updatedAt: "2026-05-13T04:00:00Z" }]
    },
    async applyPreset() {},
    async listBackups(target) {
      return [{ id: "backup-1", target, path: "/tmp/backup-1", createdAt: "2026-05-13T04:00:00Z" }]
    },
    async restoreBackup() {},
    async listEndpoints() {
      return (await this.getRuntimeInfo()).config.publicEndpoints
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

describe("page loaders", () => {
  it("loads all management pages through the management client", async () => {
    const client = createClient()

    const dashboard = (await loadDashboardPage(client)) as React.ReactElement
    const dashboardContainer = render(dashboard)
    expect(dashboardContainer.querySelector('[data-testid="dashboard-summary"]')?.textContent).toContain("dashboard:server")

    const tools = (await loadToolsPage(client)) as React.ReactElement
    const toolsContainer = render(tools)
    await act(async () => {})
    await act(async () => {})
    expect(toolsContainer.textContent).toContain("OpenCode")

    const config = (await loadConfigPage(client)) as React.ReactElement
    const configContainer = render(config)
    expect(configContainer.textContent).toContain("All changes saved")

    const endpoints = (await loadEndpointsPage(client)) as React.ReactElement
    const endpointsContainer = render(endpoints)
    expect(endpointsContainer.textContent).toContain("Desktop Route:disabled:desktop-frp:ok")

    const frp = (await loadFrpPage(client)) as React.ReactElement
    const frpContainer = render(frp)
    expect(frpContainer.textContent).toContain("frp:server")

    const settings = (await loadSettingsPage(client)) as React.ReactElement
    const settingsContainer = render(settings)
    expect(settingsContainer.textContent).toContain("settings:mode=server")
  })
})
