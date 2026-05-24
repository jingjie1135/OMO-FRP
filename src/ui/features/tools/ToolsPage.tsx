import type { ToolInstance } from "../../../management-api/types"
import { escapeHtml, pageFrame, pill } from "../../shared/fomo-html"
import { statusPill } from "../dashboard/DashboardPage"

export function ToolsPage(tools: ToolInstance[]): string {
  const body = `<div class="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">操作映射：detectTools / installTool / startTool / stopTool / getToolLogs</div>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    ${tools.map(toolCard).join("\n")}
  </div>`

  return pageFrame({
    title: "工具管理",
    subtitle: "管理系统内嵌的各类开发辅助工具和服务",
    actions: `<div class="flex items-center space-x-3">
      <button class="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">运行环境检测</button>
      <button class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">安装新工具</button>
    </div>`,
    body,
  })
}

function toolCard(tool: ToolInstance): string {
  if (tool.installState === "missing") {
    return `<article class="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-center space-y-4">
      <div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">□</div>
      <div><h3 class="text-slate-700 font-medium">${escapeHtml(tool.displayName)}</h3>${pill("未检测到", "slate")}</div>
      <button class="mt-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors">立即安装</button>
    </article>`
  }

  return `<article class="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
    <div class="flex justify-between items-start mb-6">
      <div class="flex items-center">
        <div class="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl mr-3 font-mono">${escapeHtml(tool.displayName.charAt(0))}</div>
        <div>
          <h3 class="text-slate-800 font-medium">${escapeHtml(tool.displayName)}</h3>
          <p class="text-xs text-slate-500 font-mono mt-0.5">${escapeHtml(tool.binaryPath ?? tool.kind)}</p>
        </div>
      </div>
      ${statusPill(tool.status)}
    </div>
    <dl class="grid grid-cols-2 gap-3 text-xs text-slate-500 mb-6">
      <div><dt>端口</dt><dd class="font-mono text-slate-700">${tool.currentPort ?? tool.defaultPort}</dd></div>
      <div><dt>位置</dt><dd class="font-mono text-slate-700">${escapeHtml(tool.hostType)}</dd></div>
    </dl>
    <div class="mt-auto pt-6 flex items-center justify-between border-t border-slate-100">
      <div class="flex space-x-2">
        <button class="p-2 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-emerald-600 transition-colors" title="启动">▶</button>
        <button class="p-2 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors" title="停止">■</button>
        <button class="p-2 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors" title="重启">↻</button>
      </div>
      <button class="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">查看日志</button>
    </div>
  </article>`
}
