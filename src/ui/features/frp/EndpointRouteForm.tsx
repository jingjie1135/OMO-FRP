import React from "react"
import { FactCard } from "../../components/FomoPrimitives"
import { maskFrpTokenRef } from "./use-frp-state"

export interface EndpointRouteDraft {
  serverAddr: string
  serverPort: number
  tokenRef?: string
  authTokenRef?: string
  localHost?: string
  localPort: number
  proxyName?: string
  subdomain?: string
  customDomain?: string
  publicUrl?: string
}

export function EndpointRouteForm(draft: EndpointRouteDraft) {
  const tokenRef = draft.tokenRef ?? draft.authTokenRef
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="FRP endpoint route summary">
      <p className="font-mono text-sm text-slate-600">endpoint-route:{draft.serverAddr}:{draft.serverPort}:{draft.localPort}</p>
      <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <FactCard label="服务端" value={`${draft.serverAddr}:${draft.serverPort}`} mono />
        <FactCard label="本地目标" value={`${draft.localHost ?? "127.0.0.1"}:${draft.localPort}`} mono />
        <FactCard label="代理名称" value={draft.proxyName ?? "待生成"} mono />
        <FactCard label="子域名" value={draft.subdomain ?? "待生成"} mono />
        <FactCard label="自定义域名" value={draft.customDomain ?? "未配置"} mono />
        <FactCard label="令牌引用" value={maskFrpTokenRef(tokenRef)} mono />
        <FactCard label="公网地址" value={draft.publicUrl ?? "待生成"} mono />
      </dl>
    </article>
  )
}
