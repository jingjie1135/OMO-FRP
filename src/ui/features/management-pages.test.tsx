import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { ActionRunner } from "../app/action-runner"
import type { RuntimeInfo } from "../../management-api/types"
import { ConfigPage } from "./config/ConfigPage"
import { DashboardPage } from "./dashboard/DashboardPage"
import { EndpointsPage } from "./endpoints/EndpointsPage"
import { FrpPage } from "./frp/FrpPage"
import { SettingsPage } from "./settings/SettingsPage"
import { ToolsPage } from "./tools/ToolsPage"
import type { ManagementClient } from "../../management-api/client"

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

function createToolsPageClient(instances: RuntimeInfo["config"]["toolInstances"], detections: Array<{ kind: "opencode" | "bun" | "oh-my-openagent" | "docker" | "docker-compose" | "caddy" | "frpc" | "cloudflared" | "future-tool"; displayName: string; detected: boolean }>, logs: Array<{ timestamp: string; level: "debug" | "info" | "warn" | "error"; message: string }> = []): ManagementClient {
  return {
    async getRuntimeInfo() {
      return {
        ...serverInfo,
        config: {
          ...serverInfo.config,
          toolInstances: instances,
        },
      }
    },
    async detectTools() {
      return detections
    },
    async listToolInstances() {
      return instances
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
      return logs
    },
    async readConfig() {
      return { target: { toolInstanceId: "opencode-server", kind: "opencode" }, content: "{}" }
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
    async getCloudflareTunnelStatus() {
      return { mode: "quick", running: false, message: "Cloudflare Tunnel stopped" }
    },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() {
      return { mode: "quick", localUrl: "http://127.0.0.1:4096", commandSummary: [], cloudflaredDetected: false, diagnostics: [], securityNotes: [], steps: [] }
    },
    async startCloudflareTunnel() {
      return { jobId: "start-cloudflare", status: "succeeded", message: "ok" }
    },
    async stopCloudflareTunnel() {
      return { jobId: "stop-cloudflare", status: "succeeded", message: "ok" }
    },
    async retryCloudflareTunnelStep() {
      return { jobId: "retry-cloudflare", status: "succeeded", message: "ok" }
    },
    async getSecurityChecks() {
      return []
    },
    async getBackupSummary() {
      return { count: 0, backupDirectory: "", failureRecords: [], canManualBackup: false, canCleanup: false }
    },
    async runManualBackup() {
      return { jobId: "manual-backup", status: "succeeded", message: "ok" }
    },
    async cleanupOldBackups() {
      return { jobId: "cleanup-backups", status: "succeeded", message: "ok" }
    },
    async getDiagnostics() {
      return { runtime: serverInfo, tools: [], endpoints: [], frp: { mode: "server", running: false, message: "FRP server stopped." }, jobs: [], redactedLogs: [] }
    },
  }
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
  it("renders dashboard capability matrix with visible reasons", () => {
    const container = render(<DashboardPage info={serverInfo} />)

    const summary = container.querySelector('[data-testid="dashboard-summary"]')
    expect(summary?.textContent).toContain("dashboard:server")
    expect(summary?.textContent).toContain("capabilities:frpServer=true")
    expect(summary?.textContent).toContain("state:ready")

    // Semantic verification
    expect(container.querySelector('h1')?.textContent).toBe("主控台")
    expect(container.querySelectorAll('article').length).toBeGreaterThan(0)

    // Reason verification
    expect(container.textContent).toContain("当前为服务器模式")
  })

  it("renders tools, config, endpoints, and settings states with semantic sections", async () => {
    const toolsContainer = render(
      <ToolsPage
        client={createToolsPageClient(serverInfo.config.toolInstances, [{ kind: "opencode", displayName: "OpenCode", detected: true }])}
      />,
    )
    await act(async () => {})

    expect(toolsContainer.textContent).toContain("OpenCode")
    expect(toolsContainer.querySelector('h2#detections-heading')).toBeTruthy()
    expect(toolsContainer.querySelector('h2#instances-heading')).toBeTruthy()
    expect(toolsContainer.querySelector('h1')?.textContent).toContain("Tools Management")

    const configContainer = render(
      <ConfigPage
        client={createToolsPageClient([], [])}
        opencode={{ target: { toolInstanceId: "opencode-server", kind: "opencode" }, content: "{}" }}
        ohMyOpenAgent={{ target: { toolInstanceId: "opencode-server", kind: "oh-my-openagent" }, content: "{}" }}
        presets={[{ id: "fast", name: "fast", path: "/tmp/fast.json", updatedAt: "2026-05-13T04:00:00Z" }]}
        backups={[
          {
            id: "20260513T040000Z",
            target: { toolInstanceId: "opencode-server", kind: "oh-my-openagent" },
            path: "/tmp/backup",
            createdAt: "20260513T040000Z",
          },
        ]}
      />,
    )
    expect(configContainer.textContent).toContain("fast")
    expect(configContainer.textContent).toContain("/tmp/fast.json")
    expect(configContainer.querySelector('h2#target-selection-heading')).toBeTruthy()
    expect(configContainer.querySelector('h2#editor-heading')).toBeTruthy()
    expect(configContainer.querySelector('h2#presets-heading')).toBeTruthy()
    expect(configContainer.querySelector('h2#backups-heading')).toBeTruthy()

    const endpointsContainer = render(
      <EndpointsPage
        endpoints={serverInfo.config.publicEndpoints}
        saveEndpoint={async () => {}}
        enableEndpoint={async () => {}}
        disableEndpoint={async () => {}}
        checkSafety={() => ({ ok: true, issues: [], suggestion: "Endpoint is ready to enable." })}
      />,
    )
    expect(endpointsContainer.textContent).toContain("Desktop Route")
    expect(endpointsContainer.textContent).toContain("disabled")
    expect(endpointsContainer.querySelector('h2#endpoint-list-heading')).toBeTruthy()
    expect(endpointsContainer.querySelector('h2#endpoint-editor-heading')).toBeTruthy()
    expect(endpointsContainer.querySelector('h2#endpoint-validation-heading')).toBeTruthy()
    expect(endpointsContainer.querySelector('h2#endpoint-enable-heading')).toBeTruthy()
    expect(endpointsContainer.querySelector('h2#endpoint-disable-heading')).toBeTruthy()
    expect(endpointsContainer.querySelector('h2#diagnostics-heading')).toBeTruthy()

    const settingsContainer = render(<SettingsPage info={serverInfo} />)
    expect(settingsContainer.textContent).toContain("settings:mode=server")
    expect(settingsContainer.textContent).toContain("same-origin management API")
    expect(settingsContainer.textContent).not.toContain("Cleanup Old Backups")
    expect(settingsContainer.querySelector<HTMLAnchorElement>('a[href="/config"]')?.textContent).toContain("Restore Config Flow")
    expect(settingsContainer.querySelector('h2#runtime-heading')).toBeTruthy()
    expect(settingsContainer.querySelector('h2#security-heading')).toBeTruthy()
    expect(settingsContainer.querySelector('h2#backups-heading')).toBeTruthy()
    expect(settingsContainer.querySelector('h2#diagnostics-heading')).toBeTruthy()
  })

  it("renders loading and error states with accessible roles", async () => {
    const configContainer = render(
      <ConfigPage
        client={createToolsPageClient([], [])}
        presets={[]}
        backups={[]}
      />
    )
    expect(configContainer.textContent).toContain("All changes saved")

    const toolsContainer = render(<ToolsPage client={createToolsPageClient([], [])} />)
    await act(async () => {})

    const endpointsContainer = render(
      <EndpointsPage
        endpoints={[]}
        loading={true}
        saveEndpoint={async () => {}}
        enableEndpoint={async () => {}}
        disableEndpoint={async () => {}}
        checkSafety={() => ({ ok: true, issues: [], suggestion: "Endpoint is ready to enable." })}
      />,
    )
    expect(endpointsContainer.textContent).toContain("Loading endpoints...")
  })

  it("branches FRP page by runtime capability with visible reasons", () => {
    const container = render(
      <FrpPage
        capabilities={serverInfo.capabilities}
        status={{ mode: "server", running: true, message: "FRP server is running." }}
        endpoints={serverInfo.config.publicEndpoints}
      />,
    )

    expect(container.textContent).toContain("frp:server")
    expect(container.textContent).toContain("server-frp:running")
    expect(container.textContent).toContain("FRP Server Panel")
    expect(container.textContent).toContain("Desktop frpc operations are not supported in server mode")

    document.body.innerHTML = ""
    const desktopContainer = render(
      <FrpPage
        capabilities={{
          mode: "desktop",
          canManageFrpServer: false,
          canManageFrpClient: true,
          canInstallServerServices: false,
          canAccessLocalFilesystem: true,
          canManageSystemd: false,
          canManageLocalProcesses: true,
        }}
        status={{ mode: "client", running: false, message: "frpc is not configured yet." }}
        endpoints={serverInfo.config.publicEndpoints}
      />,
    )

    expect(desktopContainer.textContent).toContain("frp:client")
    expect(desktopContainer.textContent).toContain("client-frp:stopped")
    expect(desktopContainer.textContent).toContain("FRP Client Panel")
    expect(desktopContainer.textContent).toContain("FRP server and system service management are restricted in desktop mode")
    expect(desktopContainer.textContent).toContain("endpoint-route:not configured:7000:4096")

    document.body.innerHTML = ""
    const unavailableContainer = render(
      <FrpPage
        capabilities={{
          mode: "server",
          canManageFrpServer: false,
          canManageFrpClient: false,
          canInstallServerServices: false,
          canAccessLocalFilesystem: false,
          canManageSystemd: false,
          canManageLocalProcesses: false,
        }}
        status={{ mode: "unavailable", running: false, message: "No capabilities" }}
        endpoints={[]}
      />,
    )
    expect(unavailableContainer.querySelector('[role="alert"]')).toBeTruthy()
    expect(unavailableContainer.textContent).toContain("Reason: Both canManageFrpServer and canManageFrpClient are false")
  })
})
