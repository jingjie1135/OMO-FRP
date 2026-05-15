import { AlertTriangle, CheckCircle, Globe, HardDrive, Terminal, Zap } from "lucide-react"
import type { FrpStatus, LogLine, RuntimeInfo } from "../../../management-api/types"
import { redactSensitiveText } from "../../../shared/redact-sensitive-text"

export interface DashboardViewProps {
  runtimeInfo: RuntimeInfo
  frpStatus: FrpStatus
  logs: LogLine[]
}

export function DashboardView({ runtimeInfo, frpStatus, logs }: DashboardViewProps) {
  const tools = runtimeInfo.config.toolInstances
  const runningTools = tools.filter((tool) => tool.status === "running").length
  const activeEndpoints = runtimeInfo.config.publicEndpoints.filter((endpoint) => endpoint.status === "active").length
  const runtimeLabel = runtimeInfo.capabilities.mode === "server" ? "服务器模式" : "桌面模式"
  const frpLabel = frpStatus.running ? "已连接" : "未连接"

  return (
    <section className="space-y-8 p-8" aria-label="主控台">
      <div>
        <p className="text-sm font-medium text-slate-500">{runtimeLabel}</p>
        <h1 className="text-2xl font-semibold text-slate-900">主控台</h1>
      </div>

      {runtimeInfo.config.publicEndpoints.some((endpoint) => endpoint.authMode !== "both") ? (
        <div className="flex items-center rounded-r-md border-l-4 border-amber-500 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mr-3 h-5 w-5 text-amber-500" />
          <span className="text-sm font-medium text-amber-800">存在未启用双重访问保护的公网入口。</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<HardDrive className="h-6 w-6 text-blue-500" />}
          title="工具实例"
          value={`${tools.length} 个工具`}
          subtitle={`${runningTools} 个运行中`}
        />
        <StatCard
          icon={<Globe className="h-6 w-6 text-purple-500" />}
          title="公网入口"
          value={`${activeEndpoints} 个已启用`}
          subtitle={`${runtimeInfo.config.publicEndpoints.length} 个入口已配置`}
        />
        <StatCard icon={<Zap className="h-6 w-6 text-emerald-500" />} title="FRP 状态" value={frpLabel} subtitle={frpStatus.message} />
        <StatCard icon={<CheckCircle className="h-6 w-6 text-slate-500" />} title="最近任务状态" value={frpStatus.status ?? "idle"} subtitle={frpStatus.publicUrl ?? "暂无公网地址"} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-medium text-slate-900">运行能力</h2>
          <p className="mt-1 text-xs text-slate-500">当前运行时允许管理的本机和服务器能力。</p>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {buildCapabilityItems(runtimeInfo).map((item) => (
            <div key={item.label} className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{item.label}</span>
                <span className={`text-xs font-medium ${item.enabled ? "text-emerald-600" : "text-slate-400"}`}>{item.enabled ? "可用" : "不可用"}</span>
              </div>
              {item.reason && <p className="text-[10px] text-slate-400 italic leading-tight">{item.reason}</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/50 px-4 py-3">
          <h2 className="flex items-center text-sm font-medium text-slate-200">
            <Terminal className="mr-2 h-4 w-4" />
            近期系统运行日志
          </h2>
          <span className="font-mono text-xs text-slate-500">只读</span>
        </div>
        <div className="space-y-2 p-4 font-mono text-xs text-slate-300">
          {logs.length === 0 ? <p className="text-slate-500">暂无日志</p> : logs.map((log) => <LogRow key={`${log.timestamp}-${log.message}`} log={log} />)}
        </div>
      </div>

      <div className="hidden" data-testid="dashboard-summary">
        dashboard:{runtimeInfo.capabilities.mode}
        capabilities:frpServer={String(runtimeInfo.capabilities.canManageFrpServer)},frpClient={String(runtimeInfo.capabilities.canManageFrpClient)},systemd={String(runtimeInfo.capabilities.canManageSystemd)},filesystem={String(runtimeInfo.capabilities.canAccessLocalFilesystem)},processes={String(runtimeInfo.capabilities.canManageLocalProcesses)}
        tools:{tools.length}
        endpoints:{runtimeInfo.config.publicEndpoints.length}
        frp:{runtimeInfo.capabilities.canManageFrpServer ? "server" : runtimeInfo.capabilities.canManageFrpClient ? "client" : "unavailable"}
        frpClients:{runtimeInfo.config.frpClients.length}
        state:{tools.length === 0 && runtimeInfo.config.publicEndpoints.length === 0 ? "empty" : "ready"}
      </div>
    </section>
  )
}

function buildCapabilityItems(runtimeInfo: RuntimeInfo): Array<{ label: string; enabled: boolean; reason?: string }> {
  const mode = runtimeInfo.capabilities.mode
  return [
    { label: "服务器模式", enabled: mode === "server", reason: mode === "desktop" ? "当前为桌面模式" : undefined },
    { label: "桌面模式", enabled: mode === "desktop", reason: mode === "server" ? "当前为服务器模式" : undefined },
    { label: "FRP Server 管理", enabled: runtimeInfo.capabilities.canManageFrpServer, reason: !runtimeInfo.capabilities.canManageFrpServer ? "当前运行时不支持 FRP 服务端" : undefined },
    { label: "FRP Client 管理", enabled: runtimeInfo.capabilities.canManageFrpClient, reason: !runtimeInfo.capabilities.canManageFrpClient ? "当前运行时不支持 FRP 客户端" : undefined },
    { label: "系统服务安装", enabled: runtimeInfo.capabilities.canInstallServerServices, reason: !runtimeInfo.capabilities.canInstallServerServices ? "系统权限不足或运行时不支持" : undefined },
    { label: "本地文件访问", enabled: runtimeInfo.capabilities.canAccessLocalFilesystem, reason: !runtimeInfo.capabilities.canAccessLocalFilesystem ? "沙箱环境限制访问" : undefined },
    { label: "systemd 管理", enabled: runtimeInfo.capabilities.canManageSystemd, reason: !runtimeInfo.capabilities.canManageSystemd ? "非 systemd 系统或权限不足" : undefined },
    { label: "本地进程管理", enabled: runtimeInfo.capabilities.canManageLocalProcesses, reason: !runtimeInfo.capabilities.canManageLocalProcesses ? "运行时不支持进程管控" : undefined },
  ]
}

function StatCard({ icon, title, value, subtitle }: { icon: React.ReactNode; title: string; value: string; subtitle: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 inline-flex rounded-lg bg-slate-50 p-2.5">{icon}</div>
      <h2 className="mb-1 text-sm font-medium text-slate-500">{title}</h2>
      <p className="mb-2 text-2xl font-semibold tracking-tight text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{subtitle}</p>
    </article>
  )
}

function LogRow({ log }: { log: LogLine }) {
  const levelClass = log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-amber-400" : log.level === "debug" ? "text-blue-400" : "text-emerald-400"

  return (
    <div className="flex gap-3">
      <span className={`w-14 shrink-0 uppercase ${levelClass}`}>[{log.level}]</span>
      <span className="text-slate-400">{redactSensitiveText(log.message)}</span>
    </div>
  )
}
