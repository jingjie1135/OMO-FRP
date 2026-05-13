import { describe, expect, it } from "bun:test"
import type { RuntimeInfo } from "../../management-api/types"
import { ConfigPage } from "./config/ConfigPage"
import { DashboardPage } from "./dashboard/DashboardPage"
import { EndpointsPage } from "./endpoints/EndpointsPage"
import { FrpPage } from "./frp/FrpPage"
import { SettingsPage } from "./settings/SettingsPage"
import { ToolsPage } from "./tools/ToolsPage"

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
        presets: [{ id: "fast", name: "fast", path: "/tmp/fast.json", updatedAt: "2026-05-13T04:00:00Z" }],
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

describe("management UI pages", () => {
  it("renders dashboard capability matrix", () => {
    const page = DashboardPage(serverInfo)

    expect(page).toContain("dashboard:server")
    expect(page).toContain("capabilities:frpServer=true")
    expect(page).toContain("state:ready")
  })

  it("renders tools, config, endpoints, and settings states", () => {
    expect(
      ToolsPage({
        tools: serverInfo.config.toolInstances,
        detections: [{ kind: "opencode", displayName: "OpenCode", detected: true }],
        lastAction: "start",
      }),
    ).toContain("instances:OpenCode:configured:running")

    expect(
      ConfigPage({
        opencode: { target: { toolInstanceId: "opencode-server", kind: "opencode" }, content: "{}" },
        ohMyOpenAgent: { target: { toolInstanceId: "opencode-server", kind: "oh-my-openagent" }, content: "{}" },
        presets: [{ id: "fast", name: "fast", path: "/tmp/fast.json", updatedAt: "2026-05-13T04:00:00Z" }],
        backups: [{ id: "20260513T040000Z", target: { toolInstanceId: "opencode-server", kind: "oh-my-openagent" }, path: "/tmp/backup", createdAt: "20260513T040000Z" }],
      }),
    ).toContain("presets:fast")

    expect(EndpointsPage({ endpoints: serverInfo.config.publicEndpoints })).toContain("Desktop Route:disabled:desktop-frp:ok")
    expect(SettingsPage(serverInfo)).toContain("settings:mode=server")
  })

  it("renders loading and error states", () => {
    expect(ConfigPage({ presets: [], backups: [], loading: true })).toBe("config:loading")
    expect(ToolsPage({ tools: [], detections: [], error: "boom" })).toBe("tools:error:boom")
    expect(EndpointsPage({ endpoints: [], loading: true })).toBe("endpoints:loading")
  })

  it("branches FRP page by runtime capability", () => {
    const serverPage = FrpPage({
      capabilities: serverInfo.capabilities,
      status: { mode: "server", running: true, message: "FRP server is running." },
      endpoints: serverInfo.config.publicEndpoints,
    })

    const desktopPage = FrpPage({
      capabilities: {
        mode: "desktop",
        canManageFrpServer: false,
        canManageFrpClient: true,
        canInstallServerServices: false,
        canAccessLocalFilesystem: true,
        canManageSystemd: false,
        canManageLocalProcesses: true,
      },
      status: { mode: "client", running: false, message: "frpc is not configured yet." },
      endpoints: serverInfo.config.publicEndpoints,
    })

    expect(serverPage).toContain("frp:server")
    expect(serverPage).toContain("server-frp:running")
    expect(desktopPage).toContain("frp:client")
    expect(desktopPage).toContain("client-frp:stopped")
    expect(desktopPage).toContain("endpoint-route:frp.example.com:7000:4096")
  })
})
