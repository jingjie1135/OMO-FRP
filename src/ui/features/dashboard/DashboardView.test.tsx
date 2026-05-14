import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import type { FrpStatus, LogLine, RuntimeInfo } from "../../../management-api/types"
import { DashboardView } from "./DashboardView"

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
      {
        id: "frpc-local",
        kind: "frpc",
        displayName: "frpc Client",
        hostType: "desktop",
        installState: "installed",
        defaultPort: 7000,
        status: "stopped",
      },
    ],
    pluginConfigs: [],
    publicEndpoints: [
      {
        id: "opencode-public",
        name: "OpenCode Web",
        domain: "code.example.com",
        protocol: "https",
        targetType: "server-local",
        targetToolInstanceId: "opencode-server",
        authMode: "both",
        status: "active",
      },
      {
        id: "metrics",
        name: "Metrics",
        domain: "metrics.example.com",
        protocol: "https",
        targetType: "server-local",
        targetToolInstanceId: "opencode-server",
        authMode: "basic-auth",
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

const frpStatus: FrpStatus = {
  mode: "server",
  running: true,
  status: "ready",
  message: "FRP server is running.",
  publicUrl: "https://code.example.com",
}

const logs: LogLine[] = [
  { timestamp: "2026-05-14T09:00:00.000Z", level: "info", message: "OpenCode started" },
  { timestamp: "2026-05-14T09:01:00.000Z", level: "warn", message: "Anonymous access blocked" },
  { timestamp: "2026-05-14T09:02:00.000Z", level: "error", message: "Authorization: Bearer session-secret token=client-secret password=Strong-password-123!" },
]

describe("DashboardView", () => {
  it("renders runtime, tool, endpoint, FRP, and log data from ManagementClient state", () => {
    const html = renderToStaticMarkup(<DashboardView runtimeInfo={runtimeInfo} frpStatus={frpStatus} logs={logs} />)

    expect(html).toContain("主控台")
    expect(html).toContain("服务器模式")
    expect(html).toContain("2 个工具")
    expect(html).toContain("1 个运行中")
    expect(html).toContain("1 个已启用")
    expect(html).toContain("FRP server is running.")
    expect(html).toContain("https://code.example.com")
    expect(html).toContain("OpenCode started")
    expect(html).toContain("Anonymous access blocked")
    expect(html).not.toContain("session-secret")
    expect(html).not.toContain("client-secret")
    expect(html).not.toContain("Strong-password-123")
    expect(html).toContain("[REDACTED]")
  })
})
