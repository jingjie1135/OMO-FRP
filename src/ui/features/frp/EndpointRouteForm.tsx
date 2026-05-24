import React from "react"
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
    <article className="p-4 bg-gray-50 rounded border space-y-2" aria-label="FRP endpoint route summary">
      <p className="font-mono text-sm">endpoint-route:{draft.serverAddr}:{draft.serverPort}:{draft.localPort}</p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <div><dt className="font-medium">服务端</dt><dd>{draft.serverAddr}:{draft.serverPort}</dd></div>
        <div><dt className="font-medium">本地目标</dt><dd>{draft.localHost ?? "127.0.0.1"}:{draft.localPort}</dd></div>
        <div><dt className="font-medium">代理名称</dt><dd>{draft.proxyName ?? "待生成"}</dd></div>
        <div><dt className="font-medium">子域名</dt><dd>{draft.subdomain ?? "待生成"}</dd></div>
        <div><dt className="font-medium">自定义域名</dt><dd>{draft.customDomain ?? "未配置"}</dd></div>
        <div><dt className="font-medium">令牌引用</dt><dd>{maskFrpTokenRef(tokenRef)}</dd></div>
        <div><dt className="font-medium">公网地址</dt><dd>{draft.publicUrl ?? "待生成"}</dd></div>
      </dl>
    </article>
  )
}
