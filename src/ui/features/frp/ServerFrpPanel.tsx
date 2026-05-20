import React, { useEffect, useState } from "react"
import type { FrpStatus } from "../../../management-api/types"
import type { FrpServerConfig, PublicEndpoint } from "../../../core/app-config/types"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { ErrorState } from "../../components/ErrorState"
import { getFrpPanelActions } from "./frp-panel-actions"
import { createDefaultServerConfig, maskFrpTokenRef, validateFrpServerConfig } from "./use-frp-state"

export interface ServerFrpPanelState {
  status: FrpStatus
  endpointCount: number
  connectedClients: number
  config?: FrpServerConfig
  endpoints?: PublicEndpoint[]
  saveConfig?: (config: FrpServerConfig) => Promise<void>
  startFrp?: () => Promise<void>
  stopFrp?: () => Promise<void>
  getActionStatus?: (key: string) => "idle" | "pending" | "succeeded" | "failed"
  getActionError?: (key: string) => { message: string; retryable?: boolean; needsReauth?: boolean; status?: number; target?: string } | undefined
}

export function ServerFrpPanel(state: ServerFrpPanelState) {
  const config = state.config ?? createDefaultServerConfig()
  const [draft, setDraft] = useState<FrpServerConfig>(config)

  useEffect(() => {
    setDraft(config)
  }, [config])

  const validation = validateFrpServerConfig(draft)
  const saveStatus = state.getActionStatus?.("frp:save-server") ?? "idle"
  const startStatus = state.getActionStatus?.("frp:start") ?? "idle"
  const stopStatus = state.getActionStatus?.("frp:stop") ?? "idle"
  const saveError = state.getActionError?.("frp:save-server")
  const startError = state.getActionError?.("frp:start")
  const stopError = state.getActionError?.("frp:stop")
  const actionPending = saveStatus === "pending" || startStatus === "pending" || stopStatus === "pending"

  return (
    <section aria-labelledby="frp-server-heading" className="space-y-4 p-4 bg-white rounded shadow border">
      <h2 id="frp-server-heading" className="text-lg font-semibold">FRP 服务端管理</h2>
      <div className="font-mono text-sm">
        <p>server-frp:{state.status.running ? "running" : "stopped"}</p>
        <p>message:{state.status.message}</p>
        <p>actions:{getFrpPanelActions("server").join("|")}</p>
        <p>endpoints:{state.endpointCount}</p>
        <p>clients:{state.connectedClients}</p>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div><dt className="font-medium">Panel 地址</dt><dd>{config.panelUrl || "未配置"}</dd></div>
        <div><dt className="font-medium">RPC 地址</dt><dd>{config.rpcUrl || "未配置"}</dd></div>
        <div><dt className="font-medium">服务端地址</dt><dd>{config.serverAddr || "未配置"}</dd></div>
        <div><dt className="font-medium">绑定端口</dt><dd>{config.bindPort}</dd></div>
        <div><dt className="font-medium">控制台状态</dt><dd>{config.dashboardEnabled ? "已启用" : "已停用"}</dd></div>
        <div><dt className="font-medium">令牌引用</dt><dd>{maskFrpTokenRef(config.authTokenRef)}</dd></div>
      </dl>
      <form
        aria-label="FRP server configuration form"
        className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"
        onSubmit={(event) => {
          event.preventDefault()
          if (!validation.ok) return
          void state.saveConfig?.(draft)
        }}
      >
        <label className="space-y-1">
          <span className="font-medium">Panel 地址</span>
          <input name="panelUrl" value={draft.panelUrl} onChange={(event) => setDraft({ ...draft, panelUrl: event.currentTarget.value })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">RPC 地址</span>
          <input name="rpcUrl" value={draft.rpcUrl} onChange={(event) => setDraft({ ...draft, rpcUrl: event.currentTarget.value })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">服务端地址</span>
          <input name="serverAddr" value={draft.serverAddr} onChange={(event) => setDraft({ ...draft, serverAddr: event.currentTarget.value })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">绑定端口</span>
          <input name="bindPort" type="number" value={draft.bindPort} onChange={(event) => setDraft({ ...draft, bindPort: Number(event.currentTarget.value) })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">令牌引用</span>
          <input name="authTokenRef" value={draft.authTokenRef} onChange={(event) => setDraft({ ...draft, authTokenRef: event.currentTarget.value })} className="w-full rounded border p-2" />
        </label>
        <label className="flex items-center gap-2 pt-6">
          <input name="dashboardEnabled" type="checkbox" checked={draft.dashboardEnabled} onChange={(event) => setDraft({ ...draft, dashboardEnabled: event.currentTarget.checked })} />
          <span className="font-medium">启用控制台</span>
        </label>
        <button type="submit" disabled={!state.saveConfig || !validation.ok || actionPending} className="px-3 py-2 rounded bg-blue-600 text-white disabled:bg-gray-300">保存服务端配置</button>
      </form>
      <section aria-label="FRP client list" className="space-y-2">
        <h3 className="font-medium">客户端列表</h3>
        {state.status.client ? (
          <p className="text-sm">{state.status.client.id}: {state.status.client.status}{state.status.client.lastSeenAt ? ` (last seen ${state.status.client.lastSeenAt})` : ""}</p>
        ) : (
          <p className="text-sm text-gray-500">当前没有已连接的桌面端客户端。</p>
        )}
      </section>
      <section aria-label="Desktop connection information" className="space-y-2">
        <h3 className="font-medium">桌面端连接信息</h3>
        {(state.endpoints ?? []).filter((endpoint) => endpoint.targetType === "desktop-frp").map((endpoint) => (
          <p key={endpoint.id} className="text-sm">{endpoint.name}: {endpoint.protocol}://{endpoint.domain} ({endpoint.status})</p>
        ))}
        {state.status.proxy && <p className="text-sm">Proxy {state.status.proxy.name}: {state.status.proxy.status} {state.status.proxy.publicUrl ?? ""}</p>}
      </section>
      {!validation.ok && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{validation.issues.join(" ")}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" disabled={!state.startFrp || !validation.ok || actionPending || state.status.running} onClick={() => void state.startFrp?.()} className="px-3 py-2 rounded bg-green-600 text-white disabled:bg-gray-300">启动 FRP 服务端</button>
        <button type="button" disabled={!state.stopFrp || actionPending || !state.status.running} onClick={() => void state.stopFrp?.()} className="px-3 py-2 rounded bg-red-600 text-white disabled:bg-gray-300">停止 FRP 服务端</button>
        <AsyncActionStatus status={startStatus === "idle" ? stopStatus : startStatus} />
      </div>
      {saveError && <ErrorState error={saveError} onRetry={() => void state.saveConfig?.(draft)} />}
      {startError && <ErrorState error={startError} onRetry={() => void state.startFrp?.()} />}
      {stopError && <ErrorState error={stopError} onRetry={() => void state.stopFrp?.()} />}
    </section>
  )
}
