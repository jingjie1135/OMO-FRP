import React from "react"
import type { FrpStatus } from "../../../management-api/types"
import { FactCard, StatusBadge } from "../../components/FomoPrimitives"
import { getFrpFailureGuidance } from "./use-frp-state"

export function FrpStatusCard(status: FrpStatus) {
  return (
    <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="FRP status summary">
      <div className="font-mono text-sm hidden" data-testid="frp-status-summary" data-frp-mode={status.mode} data-frp-running={status.running ? "running" : "stopped"} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FactCard label="模式" value={status.mode === "server" ? "服务端" : status.mode === "client" ? "客户端" : "不可用"} />
        <FactCard label="生命周期" value={status.status ?? (status.running ? "ready" : "idle")} mono />
        <FactCard label="运行状态" value={<StatusBadge tone={status.running ? "success" : "neutral"}>{status.running ? "运行中" : "已停止"}</StatusBadge>} tone={status.running ? "success" : "neutral"} />
      </div>
      <p className="text-sm text-slate-600">{status.message}</p>
      {status.publicUrl && <p className="text-sm text-slate-600"><span className="font-medium text-slate-800">公网地址：</span> {status.publicUrl}</p>}
      {status.failureReason && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {status.suggestion ?? getFrpFailureGuidance(status.failureReason)}
        </p>
      )}
    </article>
  )
}
