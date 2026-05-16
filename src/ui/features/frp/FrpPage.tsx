import React from "react"
import type { FrpStatus } from "../../../management-api/types"
import type { FrpClientConfig, FrpServerConfig, PublicEndpoint, RuntimeCapabilities, RuntimeInfo } from "../../../core/app-config/types"
import { ClientFrpPanel } from "./ClientFrpPanel"
import { EndpointRouteForm } from "./EndpointRouteForm"
import { FrpConnectionCard } from "./FrpConnectionCard"
import { FrpStatusCard } from "./FrpStatusCard"
import { ServerFrpPanel } from "./ServerFrpPanel"
import { createDefaultClientConfig, createDefaultServerConfig, getFrpFailureGuidance } from "./use-frp-state"

export type FrpPanelKind = "server" | "client" | "unavailable"

export interface FrpPageState {
  capabilities: RuntimeCapabilities
  status: FrpStatus
  endpoints: PublicEndpoint[]
  runtimeInfo?: RuntimeInfo
  serverConfig?: FrpServerConfig
  clientConfig?: FrpClientConfig
  loading?: boolean
  error?: string
  saveServerConfig?: (config: FrpServerConfig) => Promise<void>
  saveClientConfig?: (config: FrpClientConfig) => Promise<void>
  startFrp?: () => Promise<void>
  stopFrp?: () => Promise<void>
  getActionStatus?: (key: string) => "idle" | "pending" | "succeeded" | "failed"
  getActionError?: (key: string) => { message: string; retryable?: boolean; needsReauth?: boolean; status?: number; target?: string } | undefined
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
  const desktopEndpoint = state.endpoints.find((endpoint) => endpoint.targetType === "desktop-frp")
  const serverConfig = state.serverConfig ?? state.runtimeInfo?.config.frpServer ?? createDefaultServerConfig()
  const clientConfig = state.clientConfig ?? state.runtimeInfo?.config.frpClients[0] ?? createDefaultClientConfig(desktopEndpoint, state.runtimeInfo)
  const clientPublicUrl = desktopEndpoint ? `${desktopEndpoint.protocol}://${desktopEndpoint.domain}` : state.status.publicUrl

  if (state.loading) {
    return <div className="p-4 text-gray-500">Loading FRP state...</div>
  }

  if (state.error) {
    return <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">FRP Error: {state.error}</div>
  }

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
              config={serverConfig}
              endpoints={state.endpoints}
              saveConfig={state.saveServerConfig}
              startFrp={state.startFrp}
              stopFrp={state.stopFrp}
              getActionStatus={state.getActionStatus}
              getActionError={state.getActionError}
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
            <>
              <FrpConnectionCard
                serverAddr={clientConfig.serverAddr || "not configured"}
                serverPort={clientConfig.serverPort}
                publicUrl={clientPublicUrl}
                connected={state.status.running}
                tokenRef={clientConfig.authTokenRef}
              />
              <ClientFrpPanel
                status={state.status}
                serverAddr={clientConfig.serverAddr}
                publicUrl={clientPublicUrl}
                config={clientConfig}
                endpoints={state.endpoints}
                runtimeInfo={state.runtimeInfo}
                saveConfig={state.saveClientConfig}
                startFrp={state.startFrp}
                stopFrp={state.stopFrp}
                getActionStatus={state.getActionStatus}
                getActionError={state.getActionError}
              />
              <h3 className="text-md font-medium mt-6">Endpoint Configuration</h3>
              <EndpointRouteForm
                serverAddr={clientConfig.serverAddr || "not configured"}
                serverPort={clientConfig.serverPort}
                tokenRef={clientConfig.authTokenRef}
                localHost={clientConfig.localHost}
                localPort={clientConfig.localPort}
                proxyName={clientConfig.proxyName}
                subdomain={clientConfig.subdomain}
                customDomain={clientConfig.customDomain}
                publicUrl={clientPublicUrl}
              />
            </>
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
            {state.status.failureReason && <p className="text-sm mt-2">Guidance: {state.status.suggestion ?? getFrpFailureGuidance(state.status.failureReason)}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
