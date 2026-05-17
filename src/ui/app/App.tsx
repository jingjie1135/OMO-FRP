import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ManagementClient } from "../../management-api/client"
import type { RuntimeInfo } from "../../management-api/types"
import { redactSensitiveText } from "../../shared/redact-sensitive-text"
import { loadCloudflareTunnelPage, loadConfigPage, loadDashboardPage, loadEndpointsPage, loadFrpPage, loadSettingsPage, loadToolsPage } from "./page-loaders"
import { AppLayout } from "../layout/AppLayout"
import { getRoutesForCapabilities } from "../routes/routes"

export interface AppProps {
  runtimeInfo: RuntimeInfo
  children?: React.ReactNode
}

export function App({ runtimeInfo, children }: AppProps) {
  return (
    <AppLayout mode={runtimeInfo.capabilities.mode} routes={getRoutesForCapabilities(runtimeInfo.capabilities)}>
      {children}
    </AppLayout>
  )
}

export async function renderManagementApp(client: ManagementClient): Promise<string> {
  try {
    const runtimeInfo = await client.getRuntimeInfo()
    const [dashboard, tools, config, endpoints, frp, cloudflare, settings] = await Promise.all([
      loadDashboardPage(client),
      loadToolsPage(client),
      loadConfigPage(client),
      loadEndpointsPage(client),
      loadFrpPage(client),
      runtimeInfo.capabilities.canManageCloudflareTunnel ? loadCloudflareTunnelPage(client) : Promise.resolve(null),
      loadSettingsPage(client),
    ])

    return renderToStaticMarkup(
      <App runtimeInfo={runtimeInfo}>
        {dashboard}
        {tools}
        {config}
        {endpoints}
        {frp}
        {cloudflare}
        {settings}
      </App>,
    )
  } catch (error) {
    return renderToStaticMarkup(<ManagementBackendUnavailable error={error} />)
  }
}

function ManagementBackendUnavailable({ error }: { error: unknown }) {
  return (
    <main role="alert" aria-label="Management backend unavailable" className="management-backend-unavailable">
      <h1>Management backend is unavailable</h1>
      <p>The frontend started, but it could not load runtime information from the current ManagementClient.</p>
      <p>{redactSensitiveText(getErrorMessage(error))}</p>
    </main>
  )
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  return "Unknown management backend error"
}
