import React from "react"
import type { FrpStatus } from "../../../management-api/types"

export function FrpStatusCard(status: FrpStatus) {
  return (
    <div className="p-4 bg-gray-50 rounded border border-gray-200">
      frp-status:{status.mode}:{status.running ? "running" : "stopped"}
    </div>
  )
}
