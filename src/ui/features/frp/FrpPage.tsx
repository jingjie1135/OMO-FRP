import type { FrpStatus } from "../../../management-api/types"
import type { PublicEndpoint, RuntimeCapabilities } from "../../../core/app-config/types"
import { ClientFrpPanel } from "./ClientFrpPanel"
import { EndpointRouteForm } from "./EndpointRouteForm"
import { FrpConnectionCard } from "./FrpConnectionCard"
import { FrpStatusCard } from "./FrpStatusCard"
import { ServerFrpPanel } from "./ServerFrpPanel"

export type FrpPanelKind = "server" | "client" | "unavailable"

export interface FrpPageState {
  capabilities: RuntimeCapabilities
  status: FrpStatus
  endpoints: PublicEndpoint[]
}

export function selectFrpPanelKind(capabilities: Pick<RuntimeCapabilities, "mode" | "canManageFrpServer" | "canManageFrpClient">): FrpPanelKind {
  if (capabilities.mode === "server" && capabilities.canManageFrpServer) {
    return "server"
  }

  if (capabilities.mode === "desktop" && capabilities.canManageFrpClient) {
    return "client"
  }

  return "unavailable"
}

export function FrpPage(state: FrpPageState): string {
  const panel = selectFrpPanelKind(state.capabilities)
  if (panel === "server") {
    return [
      `frp:${panel}`,
      FrpStatusCard(state.status),
      ServerFrpPanel({
        status: state.status,
        endpointCount: state.endpoints.length,
        connectedClients: state.endpoints.filter((endpoint) => endpoint.targetType === "desktop-frp").length,
      }),
    ].join("\n")
  }

  if (panel === "client") {
    const desktopEndpoint = state.endpoints.find((endpoint) => endpoint.targetType === "desktop-frp")
    const frpConfig = EndpointRouteForm({
      serverAddr: "frp.example.com",
      serverPort: 7000,
      tokenRef: "FRP_TOKEN",
      localPort: 4096,
      subdomain: desktopEndpoint?.domain.split(".")[0],
    })

    return [
      `frp:${panel}`,
      FrpStatusCard(state.status),
      FrpConnectionCard({
        serverAddr: "frp.example.com",
        publicUrl: desktopEndpoint ? `${desktopEndpoint.protocol}://${desktopEndpoint.domain}` : undefined,
        connected: state.status.running,
      }),
      ClientFrpPanel({
        status: state.status,
        serverAddr: "frp.example.com",
        publicUrl: desktopEndpoint ? `${desktopEndpoint.protocol}://${desktopEndpoint.domain}` : undefined,
      }),
      frpConfig,
    ].join("\n")
  }

  return `frp:${panel}`
}
