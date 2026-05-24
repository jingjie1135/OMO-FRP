import React from "react"
import type { FrpStatus } from "../../../management-api/types"
import { getFrpFailureGuidance } from "./use-frp-state"

export function FrpStatusCard(status: FrpStatus) {
  return (
    <article className="p-4 bg-gray-50 rounded border border-gray-200 space-y-2" aria-label="FRP status summary">
      <div className="font-mono text-sm hidden" data-testid="frp-status-summary" data-frp-mode={status.mode} data-frp-running={status.running ? "running" : "stopped"} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <p><span className="font-medium">模式：</span> {status.mode === "server" ? "服务端" : status.mode === "client" ? "客户端" : "不可用"}</p>
        <p><span className="font-medium">生命周期：</span> {status.status ?? (status.running ? "ready" : "idle")}</p>
        <p><span className="font-medium">运行状态：</span> {status.running ? "运行中" : "已停止"}</p>
      </div>
      <p className="text-sm text-gray-700">{status.message}</p>
      {status.publicUrl && <p className="text-sm"><span className="font-medium">公网地址：</span> {status.publicUrl}</p>}
      {status.failureReason && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          {status.suggestion ?? getFrpFailureGuidance(status.failureReason)}
        </p>
      )}
    </article>
  )
}
