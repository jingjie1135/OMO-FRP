import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ManagementDashboardApp } from "./app/ManagementDashboardApp"
import { createBrowserManagementClient } from "./browser-management-client"
import "./theme.css"

function boot(): void {
  const rootElement = document.getElementById("root")
  if (!rootElement) {
    throw new Error("Management UI root element #root was not found.")
  }

  createRoot(rootElement).render(
    <StrictMode>
      <ManagementDashboardApp client={createBrowserManagementClient()} />
    </StrictMode>,
  )
}

try {
  boot()
} catch (error: unknown) {
  const rootElement = document.getElementById("root")
  const message = error instanceof Error ? error.message : "Management UI failed to start."
  if (rootElement) {
    rootElement.textContent = message
  }
}
