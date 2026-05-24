import { escapeHtml, pageFrame } from "../../shared/fomo-html"

const logs = [
  "[2026-05-13 10:00:01] [INFO] Starting OpenCode Management console v1.2.0...",
  "[2026-05-13 10:00:02] [INFO] Loading configuration from /etc/opencode/config.toml",
  "[2026-05-13 10:00:03] [DEBUG] Initializing sub-services...",
  "[2026-05-13 10:00:04] [INFO] Service 'OpenCode' started on port 8080.",
  "[2026-05-13 10:12:06] [ERROR] FRP Connection failed: auth_failed.",
  "[2026-05-13 10:16:02] [INFO] FRP Tunnel established successfully.",
]

export function LogsPage(logLines = logs): string {
  const body = `<section class="flex-1 bg-[#1E1E1E] rounded-xl border border-slate-800 overflow-hidden flex flex-col shadow-inner min-h-[520px]"><div class="px-4 py-2 border-b border-[#333] bg-[#252526] flex items-center shrink-0"><span class="text-xs text-slate-400 font-mono">/var/log/opencode/system.log</span></div><div class="flex-1 p-4 overflow-y-auto font-mono text-sm">${logLines.map(renderLog).join("")}<div class="animate-pulse text-slate-500 mt-2">_</div></div></section>`
  return pageFrame({
    title: "系统日志",
    subtitle: "查看和导出系统各组件的运行日志",
    actions: `<div class="flex space-x-3"><button class="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium">清空日志</button><button class="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium">导出日志</button></div>`,
    body,
  })
}

function renderLog(log: string): string {
  const color = log.includes("[ERROR]") ? "text-red-400" : log.includes("[WARN]") ? "text-amber-400" : log.includes("[DEBUG]") ? "text-slate-500" : "text-slate-300"
  return `<div class="mb-1 ${color}">${escapeHtml(log)}</div>`
}
