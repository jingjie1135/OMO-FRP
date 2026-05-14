import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { DashboardViewModel } from "../features/dashboard/dashboard-view-model"
import { ManagementDashboardApp } from "./ManagementDashboardApp"

const dashboard: DashboardViewModel = {
  runtimeInfo: {
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
          status: "running",
        },
      ],
      pluginConfigs: [],
      publicEndpoints: [],
      frpClients: [],
    },
  },
  frpStatus: {
    mode: "server",
    running: true,
    message: "FRP server is running.",
  },
  logs: [{ timestamp: "2026-05-14T10:00:00.000Z", level: "info", message: "OpenCode started" }],
}

describe("ManagementDashboardApp", () => {
  it("renders the shell navigation, runtime badge, and dashboard content", () => {
    const html = renderToStaticMarkup(<ManagementDashboardApp dashboard={dashboard} />)

    expect(html).toContain("OpenCode Remote")
    expect(html).toContain("主控台")
    expect(html).toContain("工具管理")
    expect(html).toContain("公网入口")
    expect(html).toContain("服务器模式")
    expect(html).toContain("FRP server is running.")
    expect(html).toContain("OpenCode started")
  })
})
