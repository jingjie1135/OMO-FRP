import React from "react"
import { Link as LinkIcon, Network, Unlink } from "lucide-react"
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
  const publicUrl = state.status.publicUrl ?? clientPublicUrl

  if (state.loading) {
    return <div className="p-8 text-gray-500">正在加载 FRP 状态...</div>
  }

  if (state.error) {
    return <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">FRP 错误：{state.error}</div>
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <p className="text-sm font-medium text-slate-500">隧道状态与连接配置</p>
        <h1 className="text-2xl font-semibold text-slate-900">FRP 穿透</h1>
      </div>
      {panel !== "unavailable" && (
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center">
          <div className="flex items-center space-x-6">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${state.status.running ? "bg-emerald-50 text-emerald-500" : "bg-slate-50 text-slate-400"}`}>
              <Network className="h-8 w-8" />
            </div>
            <div>
              <div className="mb-1 flex items-center space-x-3">
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-800">{panel === "server" ? "FRP 服务端" : "FRP 客户端"}</span>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${state.status.running ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {state.status.running ? "运行中" : "已断开"}
                </span>
              </div>
              {state.status.running && publicUrl ? (
                <p className="mt-2 font-mono text-sm text-slate-600">
                  <a href={publicUrl} className="text-blue-600 hover:underline">{publicUrl}</a>
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">隧道当前未建立连接</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void (state.status.running ? state.stopFrp?.() : state.startFrp?.())}
            disabled={state.status.running ? !state.stopFrp : !state.startFrp}
            className={`flex items-center justify-center rounded-lg px-6 py-3 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              state.status.running ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
            }`}
          >
            {state.status.running ? <><Unlink className="mr-2 h-5 w-5" /> 断开连接</> : <><LinkIcon className="mr-2 h-5 w-5" /> 建立连接</>}
          </button>
        </div>
      )}
      <section aria-label="FRP 状态" className="space-y-4">
        {panel === "server" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">FRP 服务端</h2>
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
              <p className="text-sm text-gray-500 italic">当前处于服务器模式，暂不支持桌面端 frpc 操作。</p>
            )}
            <div className="hidden" data-testid="frp-summary" data-frp-panel="server" />
          </div>
        )}

        {panel === "client" && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">FRP 客户端</h2>
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
              <h3 className="text-md font-medium mt-6">入口路由配置</h3>
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
              <p className="text-sm text-gray-500 italic">桌面模式下不支持管理 FRP 服务端或系统服务。</p>
            )}
            <div className="hidden" data-testid="frp-summary" data-frp-panel="client" />
          </div>
        )}

        {panel === "unavailable" && (
          <div role="alert" className="p-4 bg-yellow-50 text-yellow-700 rounded border border-yellow-200">
            <h2 className="font-bold mb-2">能力受限</h2>
            <p>当前模式或权限下暂时无法管理 FRP。</p>
            <p className="text-sm mt-2">原因：当前运行时既不能管理 FRP 服务端，也不能管理 FRP 客户端。</p>
            {state.status.failureReason && <p className="text-sm mt-2">处理建议：{state.status.suggestion ?? getFrpFailureGuidance(state.status.failureReason)}</p>}
          </div>
        )}
      </section>
    </div>
  )
}
