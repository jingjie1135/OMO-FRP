import React, { useEffect, useState } from "react"
import type { FrpStatus } from "../../../management-api/types"
import type { FrpServerConfig, PublicEndpoint } from "../../../core/app-config/types"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { ErrorState } from "../../components/ErrorState"
import { ActionButton, FactCard, FormField, SectionCard } from "../../components/FomoPrimitives"
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
    <SectionCard title="FRP 服务端管理" description="配置 frp-panel、frps 监听地址和桌面端连接材料。">
      <h2 id="frp-server-heading" className="sr-only">FRP 服务端管理</h2>
      <div className="hidden font-mono text-sm">
        <p>server-frp:{state.status.running ? "running" : "stopped"}</p>
        <p>message:{state.status.message}</p>
        <p>actions:{getFrpPanelActions("server").join("|")}</p>
        <p>endpoints:{state.endpointCount}</p>
        <p>clients:{state.connectedClients}</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FactCard label="Panel 地址" value={config.panelUrl || "未配置"} mono />
        <FactCard label="RPC 地址" value={config.rpcUrl || "未配置"} mono />
        <FactCard label="服务端地址" value={config.serverAddr || "未配置"} mono />
        <FactCard label="绑定端口" value={config.bindPort} />
        <FactCard label="控制台状态" value={config.dashboardEnabled ? "已启用" : "已停用"} tone={config.dashboardEnabled ? "success" : "neutral"} />
        <FactCard label="令牌引用" value={maskFrpTokenRef(config.authTokenRef)} mono />
      </dl>
      <form
        aria-label="FRP server configuration form"
        className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!validation.ok) return
          void state.saveConfig?.(draft)
        }}
      >
        <FormField label="Panel 地址">
          <input name="panelUrl" value={draft.panelUrl} onChange={(event) => setDraft({ ...draft, panelUrl: event.currentTarget.value })} />
        </FormField>
        <FormField label="RPC 地址">
          <input name="rpcUrl" value={draft.rpcUrl} onChange={(event) => setDraft({ ...draft, rpcUrl: event.currentTarget.value })} />
        </FormField>
        <FormField label="服务端地址">
          <input name="serverAddr" value={draft.serverAddr} onChange={(event) => setDraft({ ...draft, serverAddr: event.currentTarget.value })} />
        </FormField>
        <FormField label="绑定端口">
          <input name="bindPort" type="number" value={draft.bindPort} onChange={(event) => setDraft({ ...draft, bindPort: Number(event.currentTarget.value) })} />
        </FormField>
        <FormField label="令牌引用">
          <input name="authTokenRef" value={draft.authTokenRef} onChange={(event) => setDraft({ ...draft, authTokenRef: event.currentTarget.value })} />
        </FormField>
        <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
          <input name="dashboardEnabled" type="checkbox" checked={draft.dashboardEnabled} onChange={(event) => setDraft({ ...draft, dashboardEnabled: event.currentTarget.checked })} />
          <span>启用控制台</span>
        </label>
        <ActionButton type="submit" disabled={!state.saveConfig || !validation.ok || actionPending} tone="primary">保存服务端配置</ActionButton>
      </form>
      <section aria-label="FRP client list" className="mt-6 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-medium text-slate-800">客户端列表</h3>
        {state.status.client ? (
          <p className="text-sm text-slate-600">{state.status.client.id}: {state.status.client.status}{state.status.client.lastSeenAt ? ` (last seen ${state.status.client.lastSeenAt})` : ""}</p>
        ) : (
          <p className="text-sm text-slate-500">当前没有已连接的桌面端客户端。</p>
        )}
      </section>
      <section aria-label="Desktop connection information" className="mt-4 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h3 className="font-medium text-slate-800">桌面端连接信息</h3>
        {(state.endpoints ?? []).filter((endpoint) => endpoint.targetType === "desktop-frp").map((endpoint) => (
          <p key={endpoint.id} className="text-sm text-slate-600">{endpoint.name}: {endpoint.protocol}://{endpoint.domain} ({endpoint.status})</p>
        ))}
        {state.status.proxy && <p className="text-sm text-slate-600">Proxy {state.status.proxy.name}: {state.status.proxy.status} {state.status.proxy.publicUrl ?? ""}</p>}
      </section>
      {!validation.ok && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{validation.issues.join(" ")}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ActionButton type="button" disabled={!state.startFrp || !validation.ok || actionPending || state.status.running} onClick={() => void state.startFrp?.()} tone="success">启动 FRP 服务端</ActionButton>
        <ActionButton type="button" disabled={!state.stopFrp || actionPending || !state.status.running} onClick={() => void state.stopFrp?.()} tone="danger">停止 FRP 服务端</ActionButton>
        <AsyncActionStatus status={startStatus === "idle" ? stopStatus : startStatus} />
      </div>
      {saveError && <ErrorState error={saveError} onRetry={() => void state.saveConfig?.(draft)} />}
      {startError && <ErrorState error={startError} onRetry={() => void state.startFrp?.()} />}
      {stopError && <ErrorState error={stopError} onRetry={() => void state.stopFrp?.()} />}
    </SectionCard>
  )
}
