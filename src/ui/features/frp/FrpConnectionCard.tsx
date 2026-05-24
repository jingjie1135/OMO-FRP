import React from "react"
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
    <article className="p-4 bg-white rounded shadow border space-y-2" aria-label="FRP connection summary">
      <p className="font-mono text-sm">
        {summary.connected ? "已连接" : "未连接"}:{summary.serverAddr}{summary.serverPort ? `:${summary.serverPort}` : ""}:{summary.publicUrl ?? "待生成"}
      </p>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <div><dt className="font-medium">服务端地址</dt><dd>{summary.serverAddr}{summary.serverPort ? `:${summary.serverPort}` : ""}</dd></div>
        <div><dt className="font-medium">公网地址</dt><dd>{summary.publicUrl ?? "待生成"}</dd></div>
        <div><dt className="font-medium">连接状态</dt><dd>{summary.connected ? "已连接" : "未连接"}</dd></div>
        {summary.tokenRef && <div><dt className="font-medium">令牌引用</dt><dd>{maskFrpTokenRef(summary.tokenRef)}</dd></div>}
      </dl>
    </article>
  )
}
