import React from "react"
import type { FrpStatus } from "../../../management-api/types"
import { getFrpPanelActions } from "./frp-panel-actions"

export interface ServerFrpPanelState {
  status: FrpStatus
  endpointCount: number
  connectedClients: number
}

export function ServerFrpPanel(state: ServerFrpPanelState) {
  return (
    <div className="space-y-2 p-4 bg-white rounded shadow border">
      <div className="font-mono text-sm">
        <p>server-frp:{state.status.running ? "running" : "stopped"}</p>
        <p>message:{state.status.message}</p>
        <p>actions:{getFrpPanelActions("server").join("|")}</p>
        <p>endpoints:{state.endpointCount}</p>
        <p>clients:{state.connectedClients}</p>
      </div>
    </div>
  )
}
