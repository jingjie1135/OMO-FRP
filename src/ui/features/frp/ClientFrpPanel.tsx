import { getFrpPanelActions } from "./frp-panel-actions"

export function ClientFrpPanel(): string {
  return `client-frp:${getFrpPanelActions("desktop").join("|")}`
}
