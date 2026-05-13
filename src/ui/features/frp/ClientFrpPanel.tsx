import type { FrpStatus } from "../../../management-api/types"
import { getFrpPanelActions } from "./frp-panel-actions"

export interface ClientFrpPanelState {
  status: FrpStatus
  serverAddr: string
  publicUrl?: string
}

export function ClientFrpPanel(state: ClientFrpPanelState): string {
  return [
    `client-frp:${state.status.running ? "running" : "stopped"}`,
    `message:${state.status.message}`,
    `server:${state.serverAddr}`,
    `publicUrl:${state.publicUrl ?? "pending"}`,
    `actions:${getFrpPanelActions("desktop").join("|")}`,
  ].join("\n")
}
