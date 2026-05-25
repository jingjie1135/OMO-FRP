import React from "react"
import { Clipboard, ExternalLink, Monitor, RefreshCw, Trash2 } from "lucide-react"
import type { DesktopTunnelDevice } from "../../../management-api/types"
import { redactSensitiveText } from "../../../shared/redact-sensitive-text"

export interface DesktopTunnelsPageProps {
  devices: DesktopTunnelDevice[]
  loading?: boolean
  error?: string
  refresh?: () => Promise<void>
  deleteDevice?: (deviceId: string) => Promise<void>
  copyUrl?: (url: string) => void | Promise<void>
}

export function DesktopTunnelsPage({ devices, loading, error, refresh, deleteDevice, copyUrl }: DesktopTunnelsPageProps) {
  if (loading) {
    return <div className="p-8 text-sm text-slate-500">正在加载远程设备...</div>
  }

  if (error) {
    return <div role="alert" className="m-8 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">远程设备错误：{redactSensitiveText(error)}</div>
  }

  return (
    <section className="space-y-6 p-8" aria-label="远程设备">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">桌面端自动 FRP 隧道</p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">远程设备</h1>
        </div>
        <button
          type="button"
          onClick={() => void refresh?.()}
          disabled={!refresh}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新设备
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <Monitor className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-4 text-lg font-semibold text-slate-800">还没有桌面端连接</h2>
          <p className="mt-2 text-sm text-slate-500">打开 Tauri 桌面端后会自动申请 FRP 隧道，并在这里显示公网 URL 和连接状态。</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {devices.map((device) => <DesktopTunnelDeviceCard key={device.id} device={device} deleteDevice={deleteDevice} copyUrl={copyUrl} />)}
        </div>
      )}
    </section>
  )
}

function DesktopTunnelDeviceCard({ device, deleteDevice, copyUrl }: { device: DesktopTunnelDevice; deleteDevice?: (deviceId: string) => Promise<void>; copyUrl?: (url: string) => void | Promise<void> }) {
  const publicUrl = device.publicUrl
  const statusLabel = translateDeviceStatus(device.status)
  const statusClass = device.status === "online" ? "bg-emerald-100 text-emerald-700" : device.status === "error" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Monitor className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-slate-900">{device.name}</h2>
            <p className="mt-1 font-mono text-xs text-slate-500">{device.id}</p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>{statusLabel}</span>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <DeviceFact label="OpenCode" value={translateProcessStatus(device.opencodeStatus)} />
        <DeviceFact label="frpc" value={translateProcessStatus(device.frpcStatus)} />
        <DeviceFact label="隧道" value={translateTunnelStatus(device.tunnelStatus)} />
        <DeviceFact label="本地目标" value={`${device.localHost}:${device.localPort}`} mono />
        <DeviceFact label="代理" value={device.proxyName} mono />
        <DeviceFact label="最后心跳" value={device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString("zh-CN", { hour12: false }) : "尚未上报"} />
      </dl>

      {publicUrl ? (
        <div className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-3">
          <p className="text-xs font-medium text-blue-700">公网 URL</p>
          <a href={publicUrl} className="mt-1 block break-all font-mono text-sm text-blue-700 hover:underline">{publicUrl}</a>
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">公网 URL 尚未分配。</p>
      )}

      <div id={`diagnostics-${device.id}`} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <p className="font-medium text-slate-700">诊断详情</p>
        <p className="mt-1">OpenCode：{translateProcessStatus(device.opencodeStatus)}；frpc：{translateProcessStatus(device.frpcStatus)}；隧道：{translateTunnelStatus(device.tunnelStatus)}</p>
        {device.lastError && <p role="alert" className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-700">{redactSensitiveText(device.lastError)}</p>}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href={publicUrl ?? "#"}
          aria-disabled={!publicUrl}
          className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ${publicUrl ? "bg-blue-600 text-white hover:bg-blue-700" : "cursor-not-allowed bg-slate-100 text-slate-400"}`}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          打开 OpenCode
        </a>
        <button type="button" onClick={() => publicUrl && void copyUrl?.(publicUrl)} disabled={!publicUrl || !copyUrl} className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-50">
          <Clipboard className="mr-2 h-4 w-4" />
          复制 URL
        </button>
        <a href={`#diagnostics-${device.id}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm">查看诊断</a>
        <button type="button" onClick={() => void deleteDevice?.(device.id)} disabled={!deleteDevice} className="inline-flex items-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50">
          <Trash2 className="mr-2 h-4 w-4" />
          移除设备
        </button>
      </div>
    </article>
  )
}

function DeviceFact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 break-all text-sm font-medium text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  )
}

function translateDeviceStatus(status: DesktopTunnelDevice["status"]): string {
  if (status === "online") return "在线"
  if (status === "error") return "错误"
  return "离线"
}

function translateProcessStatus(status: DesktopTunnelDevice["opencodeStatus"]): string {
  if (status === "running") return "运行中"
  if (status === "starting") return "启动中"
  if (status === "stopped") return "已停止"
  if (status === "error") return "错误"
  return "未知"
}

function translateTunnelStatus(status: DesktopTunnelDevice["tunnelStatus"]): string {
  if (status === "connected") return "已连接"
  if (status === "provisioning") return "申请中"
  if (status === "disconnected") return "已断开"
  if (status === "error") return "错误"
  return "未知"
}