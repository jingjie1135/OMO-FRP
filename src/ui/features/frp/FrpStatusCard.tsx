import type { FrpStatus } from "../../../management-api/types"

export function FrpStatusCard(status: FrpStatus): string {
  return `frp-status:${status.mode}:${status.running ? "running" : "stopped"}`
}
