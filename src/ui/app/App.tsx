import type { RuntimeInfo } from "../../management-api/types"
import { CloudflarePage } from "../features/cloudflare/CloudflarePage"
import { ConfigPage } from "../features/config/ConfigPage"
import { DashboardPage } from "../features/dashboard/DashboardPage"
import { EndpointsPage } from "../features/endpoints/EndpointsPage"
import { FrpPage } from "../features/frp/FrpPage"
import { LogsPage } from "../features/logs/LogsPage"
import { SettingsPage } from "../features/settings/SettingsPage"
import { ToolsPage } from "../features/tools/ToolsPage"
import { AppLayout } from "../layout/AppLayout"
import { routes } from "../routes/routes"

export function App(runtimeInfo: RuntimeInfo, activePath = "/"): string {
  return AppLayout({ mode: runtimeInfo.capabilities.mode, routes, activePath, content: renderRoute(activePath, runtimeInfo) })
}

function renderRoute(path: string, runtimeInfo: RuntimeInfo): string {
  if (path === "/tools") return ToolsPage(runtimeInfo.config.toolInstances)
  if (path === "/endpoints") return EndpointsPage(runtimeInfo.config.publicEndpoints)
  if (path === "/config") return ConfigPage()
  if (path === "/frp") return FrpPage(runtimeInfo.capabilities)
  if (path === "/logs") return LogsPage()
  if (path === "/settings") return SettingsPage()
  if (path === "/cloudflare") return CloudflarePage()
  return DashboardPage(runtimeInfo)
}
