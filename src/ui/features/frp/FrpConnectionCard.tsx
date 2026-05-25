import React from "react"
import { FactCard } from "../../components/FomoPrimitives"
import { maskFrpTokenRef } from "./use-frp-state"

export interface FrpConnectionSummary {
  serverAddr: string
  serverPort?: number
  publicUrl?: string
  connected: boolean
  tokenRef?: string
}

export function FrpConnectionCard(summary: FrpConnectionSummary) {
  return (
    <article className="space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="FRP connection summary">
      <p className="font-mono text-sm text-slate-600">
        {summary.connected ? "已连接" : "未连接"}:{summary.serverAddr}{summary.serverPort ? `:${summary.serverPort}` : ""}:{summary.publicUrl ?? "待生成"}
      </p>
      <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <FactCard label="服务端地址" value={`${summary.serverAddr}${summary.serverPort ? `:${summary.serverPort}` : ""}`} mono />
        <FactCard label="公网地址" value={summary.publicUrl ?? "待生成"} mono />
        <FactCard label="连接状态" value={summary.connected ? "已连接" : "未连接"} tone={summary.connected ? "success" : "neutral"} />
        {summary.tokenRef && <FactCard label="令牌引用" value={maskFrpTokenRef(summary.tokenRef)} mono />}
      </dl>
    </article>
  )
}
