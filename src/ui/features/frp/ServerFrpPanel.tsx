import { getFrpPanelActions } from "./frp-panel-actions"

export function ServerFrpPanel(): string {
  return `server-frp:${getFrpPanelActions("server").join("|")}`
}
