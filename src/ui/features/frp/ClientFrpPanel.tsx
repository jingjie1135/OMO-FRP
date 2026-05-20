import React, { useEffect, useState } from "react"
import type { FrpStatus } from "../../../management-api/types"
import type { FrpClientConfig, PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { ErrorState } from "../../components/ErrorState"
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
    <section aria-labelledby="frp-client-heading" className="space-y-4 p-4 bg-white rounded shadow border">
      <h2 id="frp-client-heading" className="text-lg font-semibold">FRP Client Management</h2>
      <div className="space-y-2 font-mono text-sm">
        <p>client-frp:{state.status.running ? "running" : "stopped"}</p>
        <p>message:{state.status.message}</p>
        <p>server:{draft.serverAddr || state.serverAddr || "not configured"}</p>
        <p>publicUrl:{publicUrl ?? "pending"}</p>
        <p>actions:{getFrpPanelActions("desktop").join("|")}</p>
      </div>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div><dt className="font-medium">Server address</dt><dd>{draft.serverAddr || "not configured"}</dd></div>
        <div><dt className="font-medium">Server port</dt><dd>{draft.serverPort}</dd></div>
        <div><dt className="font-medium">Token reference</dt><dd>{maskFrpTokenRef(draft.authTokenRef)}</dd></div>
        <div><dt className="font-medium">Imported connection config</dt><dd>{draft.serverAddr && draft.authTokenRef ? "available" : "missing"}</dd></div>
        <div><dt className="font-medium">Local OpenCode port</dt><dd>{draft.localHost}:{draft.localPort}</dd></div>
        <div><dt className="font-medium">Subdomain / proxy name</dt><dd>{draft.subdomain ?? "none"} / {draft.proxyName}</dd></div>
        <div><dt className="font-medium">Public URL</dt><dd>{publicUrl ?? state.status.publicUrl ?? "pending"}</dd></div>
        <div><dt className="font-medium">Connection status</dt><dd>{state.status.running ? "connected" : "disconnected"}</dd></div>
      </dl>
      <section aria-label="Generated frpc config" className="space-y-2">
        <h3 className="font-medium">Generated frpc config</h3>
        <pre className="overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{buildGeneratedFrpcConfig(draft)}</pre>
      </section>
      <form
        aria-label="FRP client configuration form"
        className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm"
        onSubmit={(event) => {
          event.preventDefault()
          if (!saveValidation.ok) return
          void state.saveConfig?.(draft)
        }}
      >
        <label className="space-y-1">
          <span className="font-medium">Server address</span>
          <input name="serverAddr" value={draft.serverAddr} onChange={(event) => setDraft({ ...draft, serverAddr: event.currentTarget.value })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Server port</span>
          <input name="serverPort" type="number" value={draft.serverPort} onChange={(event) => setDraft({ ...draft, serverPort: Number(event.currentTarget.value) })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Token reference</span>
          <input name="authTokenRef" value={draft.authTokenRef} onChange={(event) => setDraft({ ...draft, authTokenRef: event.currentTarget.value })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Local OpenCode port</span>
          <input name="localPort" type="number" value={draft.localPort} onChange={(event) => setDraft({ ...draft, localPort: Number(event.currentTarget.value) })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">Proxy name</span>
          <input name="proxyName" value={draft.proxyName} onChange={(event) => setDraft({ ...draft, proxyName: event.currentTarget.value })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1">
          <span className="font-medium">子域名</span>
          <input name="subdomain" value={draft.subdomain ?? ""} onChange={(event) => setDraft({ ...draft, subdomain: event.currentTarget.value || undefined })} className="w-full rounded border p-2" />
        </label>
        <label className="space-y-1 md:col-span-2">
          <span className="font-medium">导入连接配置</span>
          <textarea name="connectionConfig" value={connectionConfig} onChange={(event) => setConnectionConfig(event.currentTarget.value)} className="w-full rounded border p-2" rows={3} />
        </label>
        <button type="button" data-testid="import-frp-client-config" onClick={() => setDraft(importClientConfigDraft(draft, connectionConfig))} className="px-3 py-2 rounded bg-slate-600 text-white">导入连接配置</button>
        <button type="submit" disabled={!state.saveConfig || !saveValidation.ok || actionPending} className="px-3 py-2 rounded bg-blue-600 text-white disabled:bg-gray-300">保存客户端配置</button>
      </form>
      {!startValidation.ok && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{startValidation.issues.join(" ")}</p>}
      <div className="flex flex-wrap gap-2 items-center">
        <button type="button" disabled={!state.startFrp || !startValidation.ok || actionPending || state.status.running} onClick={() => void state.startFrp?.()} className="px-3 py-2 rounded bg-green-600 text-white disabled:bg-gray-300">启动 frpc</button>
        <button type="button" disabled={!state.stopFrp || actionPending || !state.status.running} onClick={() => void state.stopFrp?.()} className="px-3 py-2 rounded bg-red-600 text-white disabled:bg-gray-300">停止 frpc</button>
        <AsyncActionStatus status={startStatus === "idle" ? stopStatus : startStatus} />
      </div>
      {saveError && <ErrorState error={saveError} onRetry={() => void state.saveConfig?.(draft)} />}
      {startError && <ErrorState error={startError} onRetry={() => void state.startFrp?.()} />}
      {stopError && <ErrorState error={stopError} onRetry={() => void state.stopFrp?.()} />}
    </section>
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
