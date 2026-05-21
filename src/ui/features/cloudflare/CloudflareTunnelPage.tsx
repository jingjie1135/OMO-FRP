import React, { useEffect, useMemo, useState } from "react"
import { AlertCircle, Cloud, Copy, FileCode, Play, RefreshCw, Save, Square, Terminal } from "lucide-react"
import type {
  CloudflareTunnelConfigRequest,
  CloudflareTunnelPlan,
  CloudflareTunnelStatus,
  CloudflareTunnelStep,
  CloudflareTunnelStepId,
} from "../../../management-api/types"
import type { RuntimeInfo } from "../../../core/app-config/types"
import { AsyncActionStatus } from "../../components/AsyncActionStatus"
import { getCloudflareFailureGuidance, redactCloudflareTunnelText, validateCloudflareTunnelConfig } from "./use-cloudflare-tunnel-state"

export interface CloudflareTunnelPageProps {
  runtimeInfo?: RuntimeInfo
  status: CloudflareTunnelStatus
  config: CloudflareTunnelConfigRequest
  plan?: CloudflareTunnelPlan
  loading?: boolean
  error?: string
  saveConfig?: (config: CloudflareTunnelConfigRequest) => Promise<void>
  startTunnel?: () => Promise<void>
  stopTunnel?: () => Promise<void>
  retryStep?: (stepId: CloudflareTunnelStepId) => Promise<void>
  getActionStatus?: (key: string) => "idle" | "pending" | "succeeded" | "failed"
  getActionError?: (key: string) => { message: string; retryable?: boolean; needsReauth?: boolean; status?: number; target?: string } | undefined
}

export function CloudflareTunnelPage(props: CloudflareTunnelPageProps) {
  const [draft, setDraft] = useState<CloudflareTunnelConfigRequest>(props.config)

  useEffect(() => {
    setDraft(props.config)
  }, [props.config])

  const validation = useMemo(() => validateCloudflareTunnelConfig(draft), [draft])
  const planMode = props.plan?.mode ?? draft.mode
  const actionStatus = props.getActionStatus ?? (() => "idle" as const)
  const actionError = props.getActionError ?? (() => undefined)
  const cloudflaredDetected = props.plan?.cloudflaredDetected ?? Boolean(props.runtimeInfo?.config.toolInstances.some((tool) => tool.kind === "cloudflared" && tool.installState !== "missing"))
  const localUrl = props.plan?.localUrl ?? `http://${draft.localHost}:${draft.localPort}`
  const publicUrl = props.plan?.publicUrl ?? props.status.publicUrl ?? (draft.mode === "named" && draft.hostname ? `https://${draft.hostname}` : "https://<generated>.trycloudflare.com")
  const commands = props.plan?.commandSummary && props.plan.commandSummary.length > 0 ? props.plan.commandSummary : [`cloudflared tunnel --url ${localUrl}`]
  const statusMessage = redactCloudflareTunnelText(props.status.message)
  const displayPublicUrl = redactCloudflareTunnelText(publicUrl)
  const failureSuggestion = props.status.suggestion ? redactCloudflareTunnelText(props.status.suggestion) : getCloudflareFailureGuidance(props.status.failureReason)

  if (props.loading) {
    return <div className="p-8 text-gray-500">正在加载 Cloudflare Tunnel 状态...</div>
  }

  if (props.error) {
    return <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">Cloudflare Tunnel 错误：{redactCloudflareTunnelText(props.error)}</div>
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Cloudflare 暴露策略与步骤</p>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Cloudflare Tunnel</h1>
        </div>
      </div>

      <section aria-label="Cloudflare Tunnel 状态" className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${props.status.running ? "bg-emerald-50 text-emerald-500" : "bg-slate-50 text-slate-400"}`}>
            <Cloud className="w-8 h-8" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">状态总览</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${props.status.running ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {props.status.running ? "运行中" : "已停止"}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                {planMode === "quick" ? "快速隧道" : "命名隧道"}
              </span>
            </div>
            <p className="text-sm text-slate-600">cloudflared：{cloudflaredDetected ? "已检测" : "缺失"}</p>
            <p className="text-sm text-slate-500 mt-1">{statusMessage}</p>
            <p className="font-mono text-sm text-blue-600 mt-2 break-all">{displayPublicUrl}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void props.startTunnel?.()}
            disabled={actionStatus("cloudflare:start") === "pending"}
            className="inline-flex items-center px-5 py-3 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Play className="w-4 h-4 mr-2" />
            启动隧道
          </button>
          <button
            type="button"
            onClick={() => void props.stopTunnel?.()}
            disabled={actionStatus("cloudflare:stop") === "pending"}
            className="inline-flex items-center px-5 py-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            <Square className="w-4 h-4 mr-2" />
            停止隧道
          </button>
        </div>
        <div className="hidden" data-testid="cloudflare-summary" data-cloudflare-mode={planMode} />
      </section>

      {props.status.failureReason && (
        <div role="alert" className="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-red-800">隧道异常</h3>
            <p className="text-sm text-red-700 mt-1">处理建议：{failureSuggestion}</p>
          </div>
        </div>
      )}

      {!props.plan && (
        <section aria-label="Cloudflare fallback command guidance" className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            正在使用本地表单生成的命令摘要
          </h2>
          <p className="text-sm text-amber-800 mt-2">
            运行时未返回完整计划时，界面会基于当前草稿展示可保存配置和手动命令；启动按钮仍会请求后端执行并显示真实结果。
          </p>
        </section>
      )}

      <form
        aria-label="Cloudflare tunnel configuration form"
        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
        onSubmit={(event) => {
          event.preventDefault()
          void props.saveConfig?.(draft)
        }}
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="cloudflare-config-heading" className="text-lg font-semibold text-slate-800 flex items-center">
              <FileCode className="w-5 h-5 mr-2 text-slate-400" />
              隧道配置
            </h2>
            <p className="text-sm text-slate-500 mt-1">快速模式用于临时公网地址；命名模式用于固定域名和 DNS 路由。</p>
          </div>
          <button
            type="submit"
            disabled={!validation.ok || actionStatus("cloudflare:save-config") === "pending"}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4 mr-2" />
            保存隧道草稿
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              模式
              <select name="mode" className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" value={draft.mode} onChange={(event) => {
                const value = event.currentTarget.value === "named" ? "named" : "quick"
                setDraft((current) => ({ ...current, mode: value }))
              }}>
                <option value="quick">快速隧道</option>
                <option value="named">命名隧道</option>
              </select>
            </label>
            <TextInput label="本地地址" name="localHost" value={draft.localHost} onChange={(value) => setDraft((current) => ({ ...current, localHost: value }))} />
            <TextInput label="本地端口" name="localPort" type="number" value={`${draft.localPort}`} onChange={(value) => setDraft((current) => ({ ...current, localPort: Number(value) }))} />
            <TextInput label="主机名" name="hostname" value={draft.hostname ?? ""} onChange={(value) => setDraft((current) => ({ ...current, hostname: value || undefined }))} />
            <TextInput label="隧道名称" name="tunnelName" value={draft.tunnelName ?? ""} onChange={(value) => setDraft((current) => ({ ...current, tunnelName: value || undefined }))} />
            <TextInput label="DNS 路由" name="dnsRoute" value={draft.dnsRoute ?? ""} onChange={(value) => setDraft((current) => ({ ...current, dnsRoute: value || undefined }))} />
          </div>
          {!validation.ok && (
            <ul role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 list-disc list-inside">
              {validation.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          )}
          <AsyncActionStatus status={actionStatus("cloudflare:save-config")} />
          {actionError("cloudflare:save-config") && <p role="alert" className="text-sm text-red-700">{redactCloudflareTunnelText(actionError("cloudflare:save-config")?.message ?? "")}</p>}
        </div>
      </form>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_24rem] gap-6">
        {planMode === "quick"
          ? <QuickTunnelFlow plan={props.plan} publicUrl={publicUrl} localUrl={localUrl} commands={commands} />
          : <NamedTunnelFlow plan={props.plan} retryStep={props.retryStep} actionStatus={actionStatus} commands={commands} />}
        <ManualCommandPanel commands={commands} />
      </div>

      <section aria-label="Cloudflare Tunnel actions" className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-slate-800 mb-3">隧道操作</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ActionStatusCard title="启动状态" status={actionStatus("cloudflare:start")} error={actionError("cloudflare:start")?.message} />
          <ActionStatusCard title="停止状态" status={actionStatus("cloudflare:stop")} error={actionError("cloudflare:stop")?.message} />
        </div>
      </section>
    </div>
  )
}

function TextInput({ label, name, value, onChange, type = "text" }: { label: string; name: string; value: string; onChange(value: string): void; type?: "text" | "number" }) {
  return (
    <label className="space-y-2 text-sm font-medium text-slate-700">
      {label}
      <input
        name={name}
        type={type}
        className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  )
}

function QuickTunnelFlow({ plan, publicUrl, localUrl, commands }: { plan?: CloudflareTunnelPlan; publicUrl: string; localUrl: string; commands: string[] }) {
  return (
    <section aria-label="Quick tunnel flow" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-800">快速隧道流程</h2>
        <p className="text-sm text-slate-500 mt-1">适合临时调试，公网地址由 Cloudflare 自动生成。</p>
      </div>
      <div className="p-6 space-y-4">
        <FlowFact label="本地目标" value={localUrl} />
        <FlowFact label="临时公网地址" value={publicUrl} />
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
          可直接用上方按钮启动快速隧道；如果自动执行失败，再复制右侧命令到目标机器排查。
        </div>
        <CommandSummary commands={commands} />
        <Notes plan={plan} />
      </div>
    </section>
  )
}

function NamedTunnelFlow({ plan, retryStep, actionStatus, commands }: { plan?: CloudflareTunnelPlan; retryStep?: (stepId: CloudflareTunnelStepId) => Promise<void>; actionStatus: (key: string) => "idle" | "pending" | "succeeded" | "failed"; commands: string[] }) {
  const steps = plan?.steps && plan.steps.length > 0 ? plan.steps : createPlaceholderNamedSteps()
  return (
    <section aria-label="Named tunnel flow" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <h2 className="text-lg font-semibold text-slate-800">命名隧道流程</h2>
        <p className="text-sm text-slate-500 mt-1">固定域名需要登录、创建隧道、写入配置并验证公网访问。</p>
      </div>
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FlowFact label="主机名" value={plan?.hostname ?? "未配置"} />
          <FlowFact label="隧道名称" value={plan?.tunnelName ?? "未配置"} />
          <FlowFact label="DNS 路由" value={plan?.dnsRoute ?? plan?.hostname ?? "未配置"} />
          <FlowFact label="公网地址" value={plan?.publicUrl ?? "暂不可用"} />
        </div>
        <div className="relative border-l border-slate-200 pl-4 space-y-4">
          {steps.map((step) => <NamedStepItem key={step.id} step={step} retryStep={retryStep} actionStatus={actionStatus} />)}
        </div>
        <CommandSummary commands={commands} />
        <Notes plan={plan} />
      </div>
    </section>
  )
}

function NamedStepItem({ step, retryStep, actionStatus }: { step: CloudflareTunnelStep; retryStep?: (stepId: CloudflareTunnelStepId) => Promise<void>; actionStatus: (key: string) => "idle" | "pending" | "succeeded" | "failed" }) {
  const display = getStepDisplay(step)
  return (
    <div className="relative">
      <span className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 ${step.status === "succeeded" ? "bg-emerald-100 border-emerald-500" : step.status === "failed" ? "bg-red-100 border-red-500" : step.status === "pending" ? "bg-blue-100 border-blue-500" : "bg-white border-slate-300"}`} />
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
        <div>
          <p className="text-sm font-medium text-slate-800">{display.label}</p>
          <p className="text-xs text-slate-500 mt-1">{display.statusLabel}{step.message ? ` — ${redactCloudflareTunnelText(step.message)}` : ""}</p>
        </div>
        {step.status === "failed" && step.retryable && (
          <button type="button" className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-100" data-testid={`retry-cloudflare-step-${step.id}`} onClick={() => void retryStep?.(step.id)} disabled={actionStatus(`cloudflare:retry:${step.id}`) === "pending"}>
            <RefreshCw className="w-3 h-3 mr-1" />
            重试
          </button>
        )}
      </div>
    </div>
  )
}

function ManualCommandPanel({ commands }: { commands: string[] }) {
  return (
    <aside className="bg-slate-900 text-slate-100 rounded-xl border border-slate-800 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center">
          <Terminal className="w-4 h-4 mr-2 text-blue-300" />
          手动执行命令
        </h2>
        <Copy className="w-4 h-4 text-slate-500" />
      </div>
      <pre className="p-5 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">{commands.map(redactCloudflareTunnelText).join("\n")}</pre>
      <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-400">
        自动化执行失败时，可复制以上命令到目标机器排查。
      </div>
    </aside>
  )
}

function ActionStatusCard({ title, status, error }: { title: string; status: "idle" | "pending" | "succeeded" | "failed"; error?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-800">{title}</p>
        <AsyncActionStatus status={status} />
      </div>
      {error && <p role="alert" className="text-xs text-red-700 mt-2">{redactCloudflareTunnelText(error)}</p>}
    </div>
  )
}

function FlowFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm font-mono text-slate-800 break-all">{redactCloudflareTunnelText(value)}</p>
    </div>
  )
}

function CommandSummary({ commands }: { commands: string[] }) {
  return (
    <section aria-label="Command summary" className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-medium text-slate-800 mb-2">命令摘要</h3>
      <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap break-all">{commands.map(redactCloudflareTunnelText).join("\n")}</pre>
    </section>
  )
}

function Notes({ plan }: { plan?: CloudflareTunnelPlan }) {
  if (!plan) return null
  return (
    <section aria-label="Cloudflare diagnostics" className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-medium text-slate-800 mb-2">诊断与安全说明</h3>
      <ul className="space-y-2 text-sm text-slate-600">
        {plan.diagnostics.map((diagnostic) => <li key={diagnostic.code}>{translateSeverity(diagnostic.severity)}：{redactCloudflareTunnelText(diagnostic.message)} 修复建议：{redactCloudflareTunnelText(diagnostic.fix)}</li>)}
        {plan.securityNotes.map((note) => <li key={note}>{redactCloudflareTunnelText(note)}</li>)}
      </ul>
    </section>
  )
}

function createPlaceholderNamedSteps(): CloudflareTunnelStep[] {
  return [
    { id: "login", label: "Login", status: "idle", retryable: true },
    { id: "create_tunnel", label: "Create tunnel", status: "idle", retryable: true },
    { id: "configure_dns", label: "Configure DNS", status: "idle", retryable: true },
    { id: "write_config", label: "Write config", status: "idle", retryable: true },
    { id: "start_tunnel", label: "Start tunnel", status: "idle", retryable: true },
    { id: "verify_public_access", label: "Verify public access", status: "idle", retryable: true },
  ]
}

function getStepDisplay(step: CloudflareTunnelStep): { label: string; statusLabel: string } {
  const labels: Record<CloudflareTunnelStepId, string> = {
    login: "登录 Cloudflare",
    create_tunnel: "创建隧道",
    configure_dns: "配置 DNS",
    write_config: "写入配置",
    start_tunnel: "启动隧道",
    verify_public_access: "验证公网访问",
  }
  const statuses: Record<CloudflareTunnelStep["status"], string> = {
    idle: "待执行",
    pending: "执行中",
    succeeded: "已完成",
    failed: "失败",
  }
  return { label: labels[step.id], statusLabel: statuses[step.status] }
}

function translateSeverity(severity: "error" | "warning" | "info"): string {
  if (severity === "error") return "错误"
  if (severity === "warning") return "提醒"
  return "信息"
}
