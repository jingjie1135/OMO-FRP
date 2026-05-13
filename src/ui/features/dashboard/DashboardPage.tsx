import type { RuntimeInfo } from "../../../management-api/types"

export function DashboardPage(info: RuntimeInfo): string {
  const tools = info.config.toolInstances.length
  const endpoints = info.config.publicEndpoints.length
  const frpClients = info.config.frpClients.length
  const frpMode = info.capabilities.canManageFrpServer ? "server" : info.capabilities.canManageFrpClient ? "client" : "unavailable"

  return [
    `dashboard:${info.capabilities.mode}`,
    `capabilities:${formatCapabilityMatrix(info)}`,
    `tools:${tools}`,
    `endpoints:${endpoints}`,
    `frp:${frpMode}`,
    `frpClients:${frpClients}`,
    `state:${tools === 0 && endpoints === 0 ? "empty" : "ready"}`,
  ].join("\n")
}

function formatCapabilityMatrix(info: RuntimeInfo): string {
  const capabilities = info.capabilities
  return [
    `frpServer=${capabilities.canManageFrpServer}`,
    `frpClient=${capabilities.canManageFrpClient}`,
    `systemd=${capabilities.canManageSystemd}`,
    `filesystem=${capabilities.canAccessLocalFilesystem}`,
    `processes=${capabilities.canManageLocalProcesses}`,
  ].join(",")
}
