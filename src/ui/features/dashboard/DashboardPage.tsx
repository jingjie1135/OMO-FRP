import type { RuntimeInfo, ToolRuntimeStatus } from "../../../core/app-config/types"
import { escapeHtml, pageFrame, pill } from "../../shared/fomo-html"

export function DashboardPage(info: RuntimeInfo): string {
  const runningTools = info.config.toolInstances.filter((tool) => tool.status === "running").length
  const totalTools = info.config.toolInstances.length
  const activeEndpoints = info.config.publicEndpoints.filter((endpoint) => endpoint.status === "active").length
  const totalEndpoints = info.config.publicEndpoints.length
  const frpEnabled = Boolean(info.config.frpServer?.enabled || info.config.frpClients.length)
  const modeCards = info.capabilities.mode === "desktop" ? desktopModeCards() : serverModeCards()

  const body = `${securityBanner()}
  ${modeCards}
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    ${statCard("▣", "工具实例", `${runningTools} / ${totalTools}`, `${runningTools} 个运行中，${Math.max(totalTools - runningTools, 0)} 个待处理`, "blue")}
    ${statCard("◎", "公网入口", `${activeEndpoints} 个已启用`, `${activeEndpoints} 个已启用，${Math.max(totalEndpoints - activeEndpoints, 0)} 个未启用`, "purple")}
    ${statCard("◇", "FRP 状态", frpEnabled ? "已配置" : "未配置", frpEnabled ? "服务端或客户端配置已就绪" : "等待初始化 frp-panel 或 frpc", "emerald")}
    ${statCard("✓", "最近任务状态", "成功", "配置已保存，等待下一次应用", "slate")}
  </div>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <section class="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
      <div class="px-4 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
        <h3 class="text-slate-200 text-sm font-medium">近期系统运行日志</h3>
        <span class="text-xs text-slate-500 font-mono">实时</span>
      </div>
      <div class="flex-1 p-4 font-mono text-xs text-slate-400 space-y-2 overflow-y-auto">
        ${logLine("INFO", "SYSTEM: Management console rendered from shared runtime config.", "emerald")}
        ${logLine("DEBUG", `RUNTIME: ${info.capabilities.mode} capabilities loaded.`, "blue")}
        ${logLine("WARN", "AUTH: Anonymous access attempts require explicit protection checks.", "amber")}
        ${logLine("INFO", `ENDPOINTS: ${activeEndpoints}/${totalEndpoints} public routes active.`, "emerald")}
      </div>
    </section>
    <section class="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <h3 class="text-slate-800 text-sm font-medium mb-4">快捷操作</h3>
      <div class="space-y-3">
        ${quickAction("重启所有服务", "blue")}
        ${quickAction("立即备份当前配置", "emerald")}
        ${quickAction("更新 FRP 隧道", "purple")}
        ${quickAction("查看安全报告", "amber")}
      </div>
    </section>
  </div>`

  return pageFrame({ title: "主控台", subtitle: "OpenCode 远程平台的运行概览与安全提示", body })
}

function serverModeCards(): string {
  return `<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-runtime-mode="server">
    ${modeCard("服务器 OpenCode", "显式检测 / 安装 / 启动", "detectTools · startTool")}
    ${modeCard("FRP 服务端", "frp-panel、frps、Caddy 入口", "getFrpStatus · startFrp")}
    ${modeCard("公网入口", "路由启用前安全门禁", "enableEndpoint · disableEndpoint")}
    ${modeCard("桌面客户端", "生成连接配置并观察状态", "saveFrpConfig")}
  </section>`
}

function desktopModeCards(): string {
  return `<section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-runtime-mode="desktop">
    ${modeCard("本机 OpenCode", "检测本机端口和密码", "detectTools · startTool")}
    ${modeCard("frpc 客户端", "生成配置并连接服务器", "saveFrpConfig · startFrp")}
    ${modeCard("服务器连接", "FRP token 和 RPC 地址", "getFrpStatus")}
    ${modeCard("公网访问地址", "展示可分享 URL", "listEndpoints")}
  </section>`
}

function modeCard(title: string, body: string, footer: string): string {
  return `<article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><h3 class="text-sm font-semibold text-slate-800">${escapeHtml(title)}</h3><p class="mt-2 text-xs text-slate-500">${escapeHtml(body)}</p><p class="mt-3 font-mono text-[11px] text-blue-600">${escapeHtml(footer)}</p></article>`
}

function securityBanner(): string {
  return `<div class="flex items-center px-4 py-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-md">
  <span class="text-amber-500 mr-3">⚠</span>
  <span class="text-amber-800 text-sm font-medium">警告：未设置 OpenCode 访问密码。点击此处进行配置。</span>
</div>`
}

function statCard(icon: string, title: string, value: string, subtitle: string, tone: "blue" | "purple" | "emerald" | "slate"): string {
  const iconClass = tone === "purple" ? "text-purple-500" : tone === "emerald" ? "text-emerald-500" : tone === "blue" ? "text-blue-500" : "text-slate-500"
  const trendClass = tone === "emerald" ? "text-emerald-600" : "text-slate-500"
  return `<article class="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
    <div class="flex items-start justify-between mb-4"><div class="p-2.5 bg-slate-50 rounded-lg ${iconClass}">${icon}</div></div>
    <h4 class="text-slate-500 text-sm font-medium mb-1">${escapeHtml(title)}</h4>
    <div class="text-2xl font-semibold text-slate-800 tracking-tight mb-2">${escapeHtml(value)}</div>
    <p class="text-xs ${trendClass}">${escapeHtml(subtitle)}</p>
  </article>`
}

function logLine(level: string, message: string, tone: "emerald" | "blue" | "amber"): string {
  const toneClass = tone === "emerald" ? "text-emerald-400" : tone === "blue" ? "text-blue-400" : "text-amber-400"
  return `<div class="flex"><span class="${toneClass} w-20 shrink-0">[${level}]</span><span>${escapeHtml(message)}</span></div>`
}

function quickAction(label: string, tone: string): string {
  return `<button class="w-full text-left px-4 py-2.5 rounded-lg border border-slate-200 hover:border-${tone}-500 hover:bg-${tone}-50 transition-colors text-sm font-medium text-slate-700">${escapeHtml(label)}</button>`
}

export function statusLabel(status: ToolRuntimeStatus): string {
  if (status === "running") return "运行中"
  if (status === "starting") return "启动中"
  if (status === "error") return "异常"
  return "已停止"
}

export function statusPill(status: ToolRuntimeStatus): string {
  if (status === "running") return pill("运行中", "emerald")
  if (status === "starting") return pill("启动中", "blue")
  if (status === "error") return pill("异常", "red")
  return pill("已停止", "slate")
}
