import React from "react"
import type { FrpStatus } from "../../../management-api/types"
import { getFrpPanelActions } from "./frp-panel-actions"

export interface ClientFrpPanelState {
  status: FrpStatus
  serverAddr: string
  publicUrl?: string
}

export function ClientFrpPanel(state: ClientFrpPanelState) {
  return (
    <div className="space-y-2 p-4 bg-white rounded shadow border font-mono text-sm">
      <p>client-frp:{state.status.running ? "running" : "stopped"}</p>
      <p>message:{state.status.message}</p>
      <p>server:{state.serverAddr}</p>
      <p>publicUrl:{state.publicUrl ?? "pending"}</p>
      <p>actions:{getFrpPanelActions("desktop").join("|")}</p>
    </div>
  )
}
