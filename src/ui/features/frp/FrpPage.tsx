import React from "react"
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

export function FrpPage(state: FrpPageState) {
  const panel = selectFrpPanelKind(state.capabilities)

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">FRP Management</h1>
      <section aria-label="FRP Status" className="space-y-4">
        <p className="font-mono text-sm">frp:{panel}</p>
        {panel === "server" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">FRP Server Panel</h2>
            <FrpStatusCard {...state.status} />
            <ServerFrpPanel
              status={state.status}
              endpointCount={state.endpoints.length}
              connectedClients={state.endpoints.filter((endpoint) => endpoint.targetType === "desktop-frp").length}
            />
            {!state.capabilities.canManageFrpClient && (
              <p className="text-sm text-gray-500 italic">Note: Desktop frpc operations are not supported in server mode.</p>
            )}
          </div>
        )}

        {panel === "client" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">FRP Client Panel</h2>
            <FrpStatusCard {...state.status} />
            {(() => {
              const desktopEndpoint = state.endpoints.find((endpoint) => endpoint.targetType === "desktop-frp")
              return (
                <>
                  <FrpConnectionCard
                    serverAddr="frp.example.com"
                    publicUrl={desktopEndpoint ? `${desktopEndpoint.protocol}://${desktopEndpoint.domain}` : undefined}
                    connected={state.status.running}
                  />
                  <ClientFrpPanel
                    status={state.status}
                    serverAddr="frp.example.com"
                    publicUrl={desktopEndpoint ? `${desktopEndpoint.protocol}://${desktopEndpoint.domain}` : undefined}
                  />
                  <h3 className="text-md font-medium mt-6">Endpoint Configuration</h3>
                  <EndpointRouteForm
                    serverAddr="frp.example.com"
                    serverPort={7000}
                    tokenRef="FRP_TOKEN"
                    localPort={4096}
                    subdomain={desktopEndpoint?.domain.split(".")[0]}
                  />
                </>
              )
            })()}
            {!state.capabilities.canManageFrpServer && (
              <p className="text-sm text-gray-500 italic">Note: FRP server and system service management are restricted in desktop mode.</p>
            )}
          </div>
        )}

        {panel === "unavailable" && (
          <div role="alert" className="p-4 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
            <h2 className="font-bold mb-2">Capability Restricted</h2>
            <p>FRP management is not available in this mode or for your current permissions.</p>
            <p className="text-sm mt-2">Reason: Both canManageFrpServer and canManageFrpClient are false.</p>
          </div>
        )}
      </section>
    </div>
  )
}
