import { getFrpPanelActions } from "./frp-panel-actions"

export function ClientFrpPanel(): string {
  return `FRP 客户端:${getFrpPanelActions("desktop").join("|")}`
}
