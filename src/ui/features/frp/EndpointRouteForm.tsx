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
        <div><dt className="font-medium">Server</dt><dd>{draft.serverAddr}:{draft.serverPort}</dd></div>
        <div><dt className="font-medium">Local target</dt><dd>{draft.localHost ?? "127.0.0.1"}:{draft.localPort}</dd></div>
        <div><dt className="font-medium">Proxy name</dt><dd>{draft.proxyName ?? "pending"}</dd></div>
        <div><dt className="font-medium">Subdomain</dt><dd>{draft.subdomain ?? "pending"}</dd></div>
        <div><dt className="font-medium">Custom domain</dt><dd>{draft.customDomain ?? "not configured"}</dd></div>
        <div><dt className="font-medium">Token reference</dt><dd>{maskFrpTokenRef(tokenRef)}</dd></div>
        <div><dt className="font-medium">Public URL</dt><dd>{draft.publicUrl ?? "pending"}</dd></div>
      </dl>
    </article>
  )
}
