import React, { useEffect, useState } from "react"
import type { FrpStatus } from "../../../management-api/types"
import type { FrpClientConfig, PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { ErrorState } from "../../components/ErrorState"
import { ActionButton, FactCard, FormField, SectionCard } from "../../components/FomoPrimitives"
import { getFrpPanelActions } from "./frp-panel-actions"
import { buildGeneratedFrpcConfig, createDefaultClientConfig, maskFrpTokenRef, validateFrpClientConfig, validateFrpClientStartConfig } from "./use-frp-state"

export interface ClientFrpPanelState {
  status: FrpStatus
  serverAddr?: string
  publicUrl?: string
  config?: FrpClientConfig
  endpoints?: PublicEndpoint[]
  runtimeInfo?: RuntimeInfo
  saveConfig?: (config: FrpClientConfig) => Promise<void>
  startFrp?: () => Promise<void>
  stopFrp?: () => Promise<void>
  getActionStatus?: (key: string) => "idle" | "pending" | "succeeded" | "failed"
  getActionError?: (key: string) => { message: string; retryable?: boolean; needsReauth?: boolean; status?: number; target?: string } | undefined
}

export function ClientFrpPanel(state: ClientFrpPanelState) {
  const endpoint = state.endpoints?.find((item) => item.targetType === "desktop-frp")
  const config = state.config ?? createDefaultClientConfig(endpoint, state.runtimeInfo)
  const [draft, setDraft] = useState<FrpClientConfig>(config)
  const [connectionConfig, setConnectionConfig] = useState("")

  useEffect(() => {
    setDraft(config)
  }, [config])

  const saveValidation = validateFrpClientConfig(draft)
  const startValidation = validateFrpClientStartConfig(draft, state.runtimeInfo)
  const saveStatus = state.getActionStatus?.("frp:save-client") ?? "idle"
  const startStatus = state.getActionStatus?.("frp:start") ?? "idle"
  const stopStatus = state.getActionStatus?.("frp:stop") ?? "idle"
  const saveError = state.getActionError?.("frp:save-client")
  const startError = state.getActionError?.("frp:start")
  const stopError = state.getActionError?.("frp:stop")
  const actionPending = saveStatus === "pending" || startStatus === "pending" || stopStatus === "pending"
  const publicUrl = state.publicUrl ?? (endpoint ? `${endpoint.protocol}://${endpoint.domain}` : undefined)

  return (
    <SectionCard title="FRP 客户端管理" description="配置桌面端 frpc、导入连接材料并生成本机 OpenCode 入口。">
      <h2 id="frp-client-heading" className="sr-only">FRP 客户端管理</h2>
      <div className="hidden space-y-2 font-mono text-sm">
        <p>client-frp:{state.status.running ? "running" : "stopped"}</p>
        <p>message:{state.status.message}</p>
        <p>server:{draft.serverAddr || state.serverAddr || "not configured"}</p>
        <p>publicUrl:{publicUrl ?? "pending"}</p>
        <p>actions:{getFrpPanelActions("desktop").join("|")}</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FactCard label="服务端地址" value={draft.serverAddr || "not configured"} mono />
        <FactCard label="服务端端口" value={draft.serverPort} />
        <FactCard label="令牌引用" value={maskFrpTokenRef(draft.authTokenRef)} mono />
        <FactCard label="导入连接配置" value={draft.serverAddr && draft.authTokenRef ? "available" : "missing"} tone={draft.serverAddr && draft.authTokenRef ? "success" : "warning"} />
        <FactCard label="本机 OpenCode 端口" value={`${draft.localHost}:${draft.localPort}`} mono />
        <FactCard label="子域名 / 代理名" value={`${draft.subdomain ?? "none"} / ${draft.proxyName}`} mono />
        <FactCard label="公网地址" value={publicUrl ?? state.status.publicUrl ?? "pending"} mono />
        <FactCard label="连接状态" value={state.status.running ? "connected" : "disconnected"} tone={state.status.running ? "success" : "neutral"} />
      </dl>
      <section aria-label="Generated frpc config" className="mt-6 space-y-2">
        <h3 className="font-medium text-slate-800">生成的 frpc 配置</h3>
        <pre className="overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{buildGeneratedFrpcConfig(draft)}</pre>
      </section>
      <form
        aria-label="FRP client configuration form"
        className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!saveValidation.ok) return
          void state.saveConfig?.(draft)
        }}
      >
        <FormField label="服务端地址">
          <input name="serverAddr" value={draft.serverAddr} onChange={(event) => setDraft({ ...draft, serverAddr: event.currentTarget.value })} />
        </FormField>
        <FormField label="服务端端口">
          <input name="serverPort" type="number" value={draft.serverPort} onChange={(event) => setDraft({ ...draft, serverPort: Number(event.currentTarget.value) })} />
        </FormField>
        <FormField label="令牌引用">
          <input name="authTokenRef" value={draft.authTokenRef} onChange={(event) => setDraft({ ...draft, authTokenRef: event.currentTarget.value })} />
        </FormField>
        <FormField label="本机 OpenCode 端口">
          <input name="localPort" type="number" value={draft.localPort} onChange={(event) => setDraft({ ...draft, localPort: Number(event.currentTarget.value) })} />
        </FormField>
        <FormField label="代理名称">
          <input name="proxyName" value={draft.proxyName} onChange={(event) => setDraft({ ...draft, proxyName: event.currentTarget.value })} />
        </FormField>
        <FormField label="子域名">
          <input name="subdomain" value={draft.subdomain ?? ""} onChange={(event) => setDraft({ ...draft, subdomain: event.currentTarget.value || undefined })} />
        </FormField>
        <div className="md:col-span-2">
          <FormField label="导入连接配置">
            <textarea name="connectionConfig" value={connectionConfig} onChange={(event) => setConnectionConfig(event.currentTarget.value)} rows={3} />
          </FormField>
        </div>
        <ActionButton type="button" testId="import-frp-client-config" onClick={() => setDraft(importClientConfigDraft(draft, connectionConfig))} tone="slate">导入连接配置</ActionButton>
        <ActionButton type="submit" disabled={!state.saveConfig || !saveValidation.ok || actionPending} tone="primary">保存客户端配置</ActionButton>
      </form>
      {!startValidation.ok && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{startValidation.issues.join(" ")}</p>}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <ActionButton type="button" disabled={!state.startFrp || !startValidation.ok || actionPending || state.status.running} onClick={() => void state.startFrp?.()} tone="success">启动 frpc</ActionButton>
        <ActionButton type="button" disabled={!state.stopFrp || actionPending || !state.status.running} onClick={() => void state.stopFrp?.()} tone="danger">停止 frpc</ActionButton>
        <AsyncActionStatus status={startStatus === "idle" ? stopStatus : startStatus} />
      </div>
      {saveError && <ErrorState error={saveError} onRetry={() => void state.saveConfig?.(draft)} />}
      {startError && <ErrorState error={startError} onRetry={() => void state.startFrp?.()} />}
      {stopError && <ErrorState error={stopError} onRetry={() => void state.stopFrp?.()} />}
    </SectionCard>
  )
}

function importClientConfigDraft(current: FrpClientConfig, content: string): FrpClientConfig {
  if (!content.trim()) return current
  try {
    const parsed = JSON.parse(content) as Partial<Record<keyof FrpClientConfig, unknown>>
    return {
      ...current,
      serverAddr: typeof parsed.serverAddr === "string" ? parsed.serverAddr : current.serverAddr,
      serverPort: typeof parsed.serverPort === "number" ? parsed.serverPort : current.serverPort,
      authTokenRef: typeof parsed.authTokenRef === "string" ? parsed.authTokenRef : current.authTokenRef,
      localHost: typeof parsed.localHost === "string" ? parsed.localHost : current.localHost,
      localPort: typeof parsed.localPort === "number" ? parsed.localPort : current.localPort,
      proxyName: typeof parsed.proxyName === "string" ? parsed.proxyName : current.proxyName,
      subdomain: typeof parsed.subdomain === "string" ? parsed.subdomain : current.subdomain,
      customDomain: typeof parsed.customDomain === "string" ? parsed.customDomain : current.customDomain,
      remotePort: typeof parsed.remotePort === "number" ? parsed.remotePort : current.remotePort,
      transport: parsed.transport === "kcp" || parsed.transport === "websocket" || parsed.transport === "quic" || parsed.transport === "tcp" ? parsed.transport : current.transport,
    }
  } catch {
    return current
  }
}
