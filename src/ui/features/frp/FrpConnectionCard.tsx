import React from "react"
import { maskFrpTokenRef } from "./use-frp-state"

export interface FrpConnectionSummary {
  serverAddr: string
  serverPort?: number
  publicUrl?: string
  connected: boolean
  tokenRef?: string
}

export function FrpConnectionCard(summary: FrpConnectionSummary) {
  return (
    <article className="p-4 bg-white rounded shadow border space-y-2" aria-label="FRP connection summary">
      <p className="font-mono text-sm">
        {summary.connected ? "connected" : "disconnected"}:{summary.serverAddr}{summary.serverPort ? `:${summary.serverPort}` : ""}:{summary.publicUrl ?? "pending"}
      </p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <div><dt className="font-medium">Server address</dt><dd>{summary.serverAddr}{summary.serverPort ? `:${summary.serverPort}` : ""}</dd></div>
        <div><dt className="font-medium">Public URL</dt><dd>{summary.publicUrl ?? "pending"}</dd></div>
        <div><dt className="font-medium">Connection status</dt><dd>{summary.connected ? "connected" : "disconnected"}</dd></div>
        {summary.tokenRef && <div><dt className="font-medium">Token reference</dt><dd>{maskFrpTokenRef(summary.tokenRef)}</dd></div>}
      </dl>
    </article>
  )
}
