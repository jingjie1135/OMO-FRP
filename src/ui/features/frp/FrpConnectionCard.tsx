import React from "react"

export interface FrpConnectionSummary {
  serverAddr: string
  publicUrl?: string
  connected: boolean
}

export function FrpConnectionCard(summary: FrpConnectionSummary) {
  return (
    <div className="p-4 bg-white rounded shadow border font-mono text-sm">
      {summary.connected ? "connected" : "disconnected"}:{summary.serverAddr}:{summary.publicUrl ?? "pending"}
    </div>
  )
}
