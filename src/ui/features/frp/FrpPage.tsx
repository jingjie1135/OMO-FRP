import type { RuntimeCapabilities } from "../../../core/app-config/types"

export type FrpPanelKind = "server" | "client" | "unavailable"

export function selectFrpPanelKind(capabilities: Pick<RuntimeCapabilities, "mode" | "canManageFrpServer" | "canManageFrpClient">): FrpPanelKind {
  if (capabilities.mode === "server" && capabilities.canManageFrpServer) {
    return "server"
  }

  if (capabilities.mode === "desktop" && capabilities.canManageFrpClient) {
    return "client"
  }

  return "unavailable"
}

export function FrpPage(capabilities: RuntimeCapabilities): string {
  const panel = selectFrpPanelKind(capabilities)
  return `frp:${panel}`
}
