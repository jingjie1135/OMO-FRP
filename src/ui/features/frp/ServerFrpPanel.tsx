import type { FrpStatus } from "../../../management-api/types"
import { getFrpPanelActions } from "./frp-panel-actions"

export interface ServerFrpPanelState {
  status: FrpStatus
  endpointCount: number
  connectedClients: number
}

export function ServerFrpPanel(state: ServerFrpPanelState): string {
  return [
    `server-frp:${state.status.running ? "running" : "stopped"}`,
    `message:${state.status.message}`,
    `actions:${getFrpPanelActions("server").join("|")}`,
    `endpoints:${state.endpointCount}`,
    `clients:${state.connectedClients}`,
  ].join("\n")
}
