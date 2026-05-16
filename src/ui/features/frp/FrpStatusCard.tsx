import React from "react"
import type { FrpStatus } from "../../../management-api/types"
import { getFrpFailureGuidance } from "./use-frp-state"

export function FrpStatusCard(status: FrpStatus) {
  return (
    <article className="p-4 bg-gray-50 rounded border border-gray-200 space-y-2" aria-label="FRP status summary">
      <div className="font-mono text-sm">frp-status:{status.mode}:{status.running ? "running" : "stopped"}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <p><span className="font-medium">Mode:</span> {status.mode}</p>
        <p><span className="font-medium">Lifecycle:</span> {status.status ?? (status.running ? "ready" : "idle")}</p>
        <p><span className="font-medium">Running:</span> {status.running ? "yes" : "no"}</p>
      </div>
      <p className="text-sm text-gray-700">{status.message}</p>
      {status.publicUrl && <p className="text-sm"><span className="font-medium">Public URL:</span> {status.publicUrl}</p>}
      {status.failureReason && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          {status.suggestion ?? getFrpFailureGuidance(status.failureReason)}
        </p>
      )}
    </article>
  )
}
