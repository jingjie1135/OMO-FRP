export interface FrpConnectionSummary {
  serverAddr: string
  publicUrl?: string
  connected: boolean
}

export function FrpConnectionCard(summary: FrpConnectionSummary): string {
  return `${summary.connected ? "connected" : "disconnected"}:${summary.serverAddr}:${summary.publicUrl ?? "pending"}`
}
