import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ManagementDashboardApp } from "./app/ManagementDashboardApp"
import { createBrowserManagementClient } from "./browser-management-client"
import type { ManagementClient } from "../management-api/client"
import { redactSensitiveText } from "../shared/redact-sensitive-text"
import "./theme.css"

export interface BootManagementUiOptions {
  createClient?: () => ManagementClient
}

export function bootManagementUi(options: BootManagementUiOptions = {}): void {
  const rootElement = document.getElementById("root")
  if (!rootElement) {
    throw new Error("Management UI root element #root was not found.")
  }

  const client = options.createClient?.() ?? createBrowserManagementClient()
  startDesktopAutoTunnelIfAvailable(client)

  createRoot(rootElement).render(
    <StrictMode>
      <ManagementDashboardApp client={client} />
    </StrictMode>,
  )
}

function startDesktopAutoTunnelIfAvailable(client: ManagementClient): void {
  const startup = (client as ManagementClient & { startDesktopAutoTunnel?: () => Promise<unknown> }).startDesktopAutoTunnel
  if (!startup) {
    return
  }

  void startup().catch((error: unknown) => {
    console.error(redactSensitiveText(error instanceof Error ? error.message : String(error)))
  })
}
try {
  bootManagementUi()
} catch (error: unknown) {
  const rootElement = document.getElementById("root")
  const message = error instanceof Error ? redactSensitiveText(error.message) : "Management UI failed to start."
  if (rootElement) {
    rootElement.textContent = message
  }
}
