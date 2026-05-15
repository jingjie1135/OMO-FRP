import React from "react"

export interface EndpointRouteDraft {
  serverAddr: string
  serverPort: number
  tokenRef: string
  localPort: number
  subdomain?: string
  customDomain?: string
}

export function EndpointRouteForm(draft: EndpointRouteDraft) {
  return (
    <div className="p-4 bg-gray-50 rounded border font-mono text-sm">
      endpoint-route:{draft.serverAddr}:{draft.serverPort}:{draft.localPort}
    </div>
  )
}
