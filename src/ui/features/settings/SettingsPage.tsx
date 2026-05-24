import React, { useState } from "react"
import { AlertCircle, CheckCircle2, Clock3, DatabaseBackup, Download, HardDrive, RefreshCw, Server, Sparkles, Wrench, XCircle } from "lucide-react"
import { createFallbackBackupSummary, createFallbackSecurityChecks, useSettingsState, type SettingsInitialData } from "./use-settings-state"
import type { ManagementClient } from "../../../management-api/client"
import type { RuntimeInfo, SecurityCheck } from "../../../management-api/types"
import { ErrorState } from "../../components/ErrorState"

export interface SettingsPageProps {
  client?: ManagementClient
  info?: RuntimeInfo
  initialData?: SettingsInitialData
}

export function SettingsPage({ client, info, initialData }: SettingsPageProps) {
  const resolvedInitialData = initialData ?? (info ? {
    runtimeInfo: info,
    securityChecks: createFallbackSecurityChecks(info),
    backupSummary: createFallbackBackupSummary(info),
  } : {})
  const resolvedClient = client ?? createStaticSettingsClient(resolvedInitialData)
  const state = useSettingsState(resolvedClient, resolvedInitialData)
  const [confirmBackup, setConfirmBackup] = useState(false)
  const [confirmCleanup, setConfirmCleanup] = useState(false)

  if (state.isLoading && !state.runtimeInfo) {
    return (
      <div className="p-8 flex items-center justify-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        <span>正在加载系统设置...</span>
      </div>
    )
  }

  const runtimeInfo = state.runtimeInfo
  if (!runtimeInfo) {
    return (
      <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
        当前无法获取系统设置所需的运行时信息。
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">运行信息、安全与诊断</p>
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">系统设置</h1>
        </div>
        <button
          onClick={() => state.refresh()}
          className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          刷新
        </button>
      </div>

      {state.errorMessage && <ErrorState error={state.errorMessage} onRetry={() => state.refresh()} />}

      <section aria-labelledby="runtime-heading" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="runtime-heading" className="text-lg font-semibold text-slate-800">运行时配置</h2>
            <p className="text-sm text-slate-500 mt-1">按当前运行模式展示可用能力，后端未开放的能力会以占位状态保留。</p>
          </div>
          <span className="inline-flex w-fit items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
            {runtimeInfo.capabilities.mode === "server" ? "服务器模式" : "桌面模式"}
          </span>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <RuntimeFact label="配置目录" value={runtimeInfo.config.toolInstances.find(t => t.kind === "opencode")?.configDirectory || "未知"} icon={<HardDrive className="w-4 h-4" />} />
            <RuntimeFact label="管理接口" value={runtimeInfo.capabilities.mode === "server" ? getManagementApiAddress() : "Tauri Bridge 已连接"} icon={<Server className="w-4 h-4" />} />
            <RuntimeFact label="受管工具" value={`${runtimeInfo.config.toolInstances.length} 个工具实例`} icon={<Wrench className="w-4 h-4" />} />
          </div>

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-slate-800">系统能力</h3>
              <span className="text-xs text-slate-500">能力名称已中文化，不再暴露内部 capability key。</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {createCapabilityCards(runtimeInfo).map((capability) => (
                <article key={capability.id} className={`rounded-lg border p-4 ${capability.available ? "bg-emerald-50/40 border-emerald-100" : "bg-slate-50 border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{capability.label}</p>
                      <p className="text-xs text-slate-500 mt-1">{capability.description}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${capability.available ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                      {capability.available ? "可用" : "待接入"}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
        <div className="hidden" data-testid="settings-summary" data-settings-mode={runtimeInfo.capabilities.mode} />
      </section>

      <section aria-labelledby="security-heading" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 id="security-heading" className="text-lg font-semibold text-slate-800">安全状态</h2>
          <p className="text-sm text-slate-500 mt-1">公开入口、密钥引用和日志脱敏会在这里集中检查。</p>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          {state.securityChecks.map((check) => <SecurityCheckCard key={check.id} check={check} />)}
        </div>
      </section>

      <section aria-labelledby="backups-heading" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="backups-heading" className="text-lg font-semibold text-slate-800">备份与恢复</h2>
            <p className="text-sm text-slate-500 mt-1">参考原型的时间线呈现备份状态；后端未提供的恢复能力先明确占位。</p>
          </div>
          <a
            href="/config"
            className="inline-flex items-center px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            前往配置恢复流程
          </a>
        </div>
        {state.backupSummary && (
          <div className="p-6 grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RuntimeFact label="备份总数" value={`${state.backupSummary.count}`} icon={<DatabaseBackup className="w-4 h-4" />} />
                <RuntimeFact label="最近备份" value={state.backupSummary.lastBackupTime || "从未备份"} icon={<Clock3 className="w-4 h-4" />} />
                <RuntimeFact label="备份目录" value={state.backupSummary.backupDirectory} icon={<HardDrive className="w-4 h-4" />} />
              </div>

              {state.backupSummary.failureRecords.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  <p className="font-semibold mb-1">最近失败记录：</p>
                  <ul className="list-disc list-inside">
                    {state.backupSummary.failureRecords.map((rec, i) => <li key={i}>{rec}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {confirmBackup ? (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-xs font-medium text-amber-900">确认立即执行手动备份？</span>
                    <button
                      onClick={() => { state.runManualBackup(); setConfirmBackup(false); }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => setConfirmBackup(false)}
                      className="px-3 py-1 bg-white border border-slate-200 rounded text-xs"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmBackup(true)}
                    disabled={!state.backupSummary.canManualBackup}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-500 disabled:border disabled:border-slate-200"
                  >
                    {state.backupSummary.canManualBackup ? "执行手动备份" : "手动备份待接入"}
                  </button>
                )}

                {state.backupSummary.canCleanup ? (
                  confirmCleanup ? (
                    <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <span className="text-xs font-medium text-amber-900">确认清理旧备份？</span>
                      <button
                        onClick={() => { state.cleanupOldBackups(); setConfirmCleanup(false); }}
                        className="px-3 py-1 bg-red-600 text-white rounded text-xs"
                      >
                        确认
                      </button>
                      <button
                        onClick={() => setConfirmCleanup(false)}
                        className="px-3 py-1 bg-white border border-slate-200 rounded text-xs"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmCleanup(true)}
                      className="px-4 py-2 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
                    >
                      清理旧备份
                    </button>
                  )
                ) : (
                  <button disabled className="px-4 py-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg text-sm font-medium">
                    旧备份清理待接入
                  </button>
                )}
              </div>
            </div>

            <aside className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-medium text-slate-800 flex items-center mb-4">
                <DatabaseBackup className="w-4 h-4 mr-2 text-slate-500" />
                备份时间线
              </h3>
              <div className="relative border-l border-slate-200 pl-4 space-y-5">
                <div className="relative">
                  <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-500" />
                  <p className="text-sm font-medium text-slate-800">当前配置</p>
                  <p className="text-xs text-slate-500 mt-1 font-mono">{state.backupSummary.lastBackupTime || "尚未产生备份"}</p>
                </div>
                {state.backupSummary.count > 0 ? (
                  <div className="relative">
                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-300" />
                    <p className="text-sm font-medium text-slate-700">最近备份记录</p>
                    <p className="text-xs text-slate-500 mt-1">恢复动作请从配置页执行。</p>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute -left-6 top-1 w-4 h-4 rounded-full bg-white border-2 border-slate-300" />
                    <p className="text-sm font-medium text-slate-700">暂无历史备份</p>
                    <p className="text-xs text-slate-500 mt-1">后端备份能力未开放时，这里保留时间线占位。</p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </section>

      <section aria-labelledby="diagnostics-heading" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <h2 id="diagnostics-heading" className="text-lg font-semibold text-slate-800">系统诊断</h2>
          <p className="text-sm text-slate-500 mt-1">导出运行时状态、工具检测结果和已脱敏日志，方便问题排查。</p>
        </div>
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 text-sm text-slate-600">
            <Sparkles className="w-5 h-5 text-blue-500 mt-0.5" />
            <p>密码、令牌等敏感信息会自动脱敏；后端暂无的诊断项会在导出中以空数组占位。</p>
          </div>
          <button
            onClick={() => state.exportDiagnostics()}
            className="inline-flex items-center px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 text-sm font-medium"
          >
            <Download className="w-4 h-4 mr-2" />
            导出脱敏诊断文件（.json）
          </button>
        </div>
      </section>
    </div>
  )
}

function RuntimeFact({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mb-2">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="text-sm font-medium text-slate-800 break-all">{value}</p>
    </div>
  )
}

function SecurityCheckCard({ check }: { check: SecurityCheck }) {
  const display = getSecurityCheckDisplay(check)
  const icon = check.status === "pass" ? <CheckCircle2 className="w-5 h-5" /> : check.status === "warn" ? <AlertCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />
  const tone = check.status === "pass" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : check.status === "warn" ? "bg-amber-50 border-amber-100 text-amber-700" : "bg-red-50 border-red-100 text-red-700"
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex items-center justify-center rounded-full p-2 ${tone}`}>
          {icon}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-slate-800">{display.label}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tone}`}>{display.statusLabel}</span>
          </div>
          <p className="text-xs text-slate-600 mt-1">{display.message}</p>
          {display.fix && <p className="text-xs text-blue-600 mt-2 font-medium">建议：{display.fix}</p>}
        </div>
      </div>
    </article>
  )
}

function createCapabilityCards(runtimeInfo: RuntimeInfo): Array<{ id: string; label: string; description: string; available: boolean }> {
  const capabilities = runtimeInfo.capabilities
  const cards = [
    { id: "frp-server", label: "FRP 服务端", description: "管理服务器侧 frps、frp-panel 和公网入口。", available: capabilities.canManageFrpServer },
    { id: "frp-client", label: "FRP 客户端", description: "管理桌面侧 frpc 配置、连接和本地端口暴露。", available: capabilities.canManageFrpClient },
    { id: "server-services", label: "服务器服务安装", description: "安装 Docker、Caddy 或 systemd 相关服务。", available: capabilities.canInstallServerServices },
    { id: "filesystem", label: "本地文件访问", description: "读取配置目录、备份目录和诊断日志。", available: capabilities.canAccessLocalFilesystem },
    { id: "systemd", label: "Systemd 服务", description: "管理 Linux 服务单元和长期运行进程。", available: capabilities.canManageSystemd },
  ]
  if (capabilities.canManageCloudflareTunnel) {
    cards.splice(2, 0, { id: "cloudflare", label: "Cloudflare 隧道", description: "生成 quick/named tunnel 计划并跟踪执行步骤。", available: true })
  }
  return cards
}

function getSecurityCheckDisplay(check: SecurityCheck) {
  const knownChecks: Record<string, { label: string; pass: string; warn: string; fail: string; fix?: string }> = {
    "opencode-password": {
      label: "OpenCode 访问密码",
      pass: "公开 OpenCode 入口已要求 OpenCode 访问密码。",
      warn: "当前公开入口尚未声明 OpenCode 访问密码保护。",
      fail: "OpenCode 访问密码检查未通过。",
      fix: "启用公网入口前，请使用 opencode-password 或双重认证。",
    },
    "endpoint-auth": {
      label: "公网入口认证",
      pass: "未发现仅使用 Basic Auth 的入口。",
      warn: "至少一个入口只使用 Basic Auth。",
      fail: "公网入口认证配置存在阻断问题。",
      fix: "公网入口建议同时启用 Basic Auth 与 OpenCode 密码。",
    },
    "frp-token-ref": {
      label: "FRP 密钥引用",
      pass: "FRP 配置通过引用名称读取密钥。",
      warn: "尚未配置 FRP 密钥引用。",
      fail: "FRP 密钥引用检查未通过。",
      fix: "将 FRP 密钥放入环境变量或受限文件，不要明文写入配置。",
    },
    "cleartext-secret-risk": {
      label: "明文密钥风险",
      pass: "入口元数据未发现明显密钥字符串。",
      warn: "入口元数据可能包含敏感字段。",
      fail: "入口元数据疑似包含 token/password/secret。",
      fix: "把敏感值迁移为 SecretRef 或环境变量。",
    },
    "log-redaction": {
      label: "日志脱敏",
      pass: "诊断导出会先脱敏日志再下载。",
      warn: "日志脱敏能力需要复核。",
      fail: "日志脱敏检查未通过。",
    },
    "backup-availability": {
      label: "备份可用性",
      pass: "当前运行时可以检查本地备份文件。",
      warn: "当前运行时不能访问本地备份文件，先展示占位状态。",
      fail: "备份可用性检查未通过。",
    },
  }
  const statusLabel = check.status === "pass" ? "通过" : check.status === "warn" ? "提醒" : "阻断"
  const known = knownChecks[check.id]
  if (!known) {
    return { label: check.label, statusLabel, message: check.message, fix: check.fix }
  }
  return {
    label: known.label,
    statusLabel,
    message: check.status === "pass" ? known.pass : check.status === "warn" ? known.warn : known.fail,
    fix: check.fix ? known.fix ?? check.fix : known.fix,
  }
}

function getManagementApiAddress(): string {
  if (typeof window === "undefined") {
    return "同源管理接口"
  }
  return window.location.origin && window.location.origin !== "null" ? window.location.origin : "同源管理接口"
}

function createStaticSettingsClient(initialData: SettingsInitialData): ManagementClient {
  const runtimeInfo = initialData.runtimeInfo
  if (!runtimeInfo) {
    throw new Error("SettingsPage requires either client or info.")
  }

  const successJob = { jobId: "settings-static", status: "succeeded" as const, message: "ok" }
  return {
    async getRuntimeInfo() {
      return runtimeInfo
    },
    async detectTools() {
      return []
    },
    async listToolInstances() {
      return runtimeInfo.config.toolInstances
    },
    async installTool() {
      return successJob
    },
    async startTool() {
      return successJob
    },
    async stopTool() {
      return successJob
    },
    async restartTool() {
      return successJob
    },
    async getToolLogs() {
      return []
    },
    async readConfig(target) {
      return { target, content: "" }
    },
    async validateConfig() {
      return { valid: true, fieldErrors: [] }
    },
    async saveConfig() {},
    async listPresets() {
      return []
    },
    async applyPreset() {},
    async listBackups() {
      return []
    },
    async restoreBackup() {},
    async listEndpoints() {
      return runtimeInfo.config.publicEndpoints
    },
    async saveEndpoint() {},
    async enableEndpoint() {
      return successJob
    },
    async disableEndpoint() {
      return successJob
    },
    async getFrpStatus() {
      return { mode: runtimeInfo.capabilities.canManageFrpServer ? "server" : runtimeInfo.capabilities.canManageFrpClient ? "client" : "unavailable", running: false, message: "FRP status unavailable." }
    },
    async saveFrpConfig() {},
    async startFrp() {
      return successJob
    },
    async stopFrp() {
      return successJob
    },
    async getCloudflareTunnelStatus() {
      return { mode: "unavailable", running: false, message: "Cloudflare status unavailable." }
    },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan(config) {
      return { mode: config.mode, localUrl: `http://${config.localHost}:${config.localPort}`, commandSummary: [], cloudflaredDetected: false, diagnostics: [], securityNotes: [], steps: [] }
    },
    async startCloudflareTunnel() {
      return successJob
    },
    async stopCloudflareTunnel() {
      return successJob
    },
    async retryCloudflareTunnelStep() {
      return successJob
    },
    async getSecurityChecks() {
      return initialData.securityChecks ?? createFallbackSecurityChecks(runtimeInfo)
    },
    async getBackupSummary() {
      return initialData.backupSummary ?? createFallbackBackupSummary(runtimeInfo)
    },
    async runManualBackup() {
      return successJob
    },
    async cleanupOldBackups() {
      return successJob
    },
    async getDiagnostics() {
      return { runtime: runtimeInfo, tools: [], endpoints: runtimeInfo.config.publicEndpoints, frp: { mode: "unavailable", running: false, message: "FRP status unavailable." }, jobs: [], redactedLogs: [] }
    },
  }
}
