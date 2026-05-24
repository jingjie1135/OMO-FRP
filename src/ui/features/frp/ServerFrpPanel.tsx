import { getFrpPanelActions } from "./frp-panel-actions"

export function ServerFrpPanel(): string {
  return `FRP 服务端:${getFrpPanelActions("server").join("|")}`
}
