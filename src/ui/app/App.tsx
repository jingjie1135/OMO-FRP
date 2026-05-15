import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ManagementClient } from "../../management-api/client"
import type { RuntimeInfo } from "../../management-api/types"
import { loadConfigPage, loadDashboardPage, loadEndpointsPage, loadFrpPage, loadSettingsPage, loadToolsPage } from "./page-loaders"
import { AppLayout } from "../layout/AppLayout"
import { routes } from "../routes/routes"

export interface AppProps {
  runtimeInfo: RuntimeInfo
  children?: React.ReactNode
}

export function App({ runtimeInfo, children }: AppProps) {
  return (
    <AppLayout mode={runtimeInfo.capabilities.mode} routes={routes}>
      {children}
    </AppLayout>
  )
}

export async function renderManagementApp(client: ManagementClient): Promise<string> {
  const runtimeInfo = await client.getRuntimeInfo()
  const [dashboard, tools, config, endpoints, frp, settings] = await Promise.all([
    loadDashboardPage(client),
    loadToolsPage(client),
    loadConfigPage(client),
    loadEndpointsPage(client),
    loadFrpPage(client),
    loadSettingsPage(client),
  ])

  return renderToStaticMarkup(
    <App runtimeInfo={runtimeInfo}>
      {dashboard}
      {tools}
      {config}
      {endpoints}
      {frp}
      {settings}
    </App>,
  )
}
