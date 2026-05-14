import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ManagementDashboardApp } from "./app/ManagementDashboardApp"
import { createBrowserManagementClient } from "./browser-management-client"
import { loadDashboardViewModel } from "./features/dashboard/dashboard-view-model"
import "./theme.css"

async function boot(): Promise<void> {
  const rootElement = document.getElementById("root")
  if (!rootElement) {
    throw new Error("Management UI root element #root was not found.")
  }

  const dashboard = await loadDashboardViewModel(createBrowserManagementClient())
  createRoot(rootElement).render(
    <StrictMode>
      <ManagementDashboardApp dashboard={dashboard} />
    </StrictMode>,
  )
}

void boot().catch((error: unknown) => {
  const rootElement = document.getElementById("root")
  const message = error instanceof Error ? error.message : "Management UI failed to start."
  if (rootElement) {
    rootElement.textContent = message
  }
})
