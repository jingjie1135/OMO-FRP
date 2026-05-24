import { monoBlock, pageFrame, panel } from "../../shared/fomo-html"

const sampleConfig = `[server]
host = "0.0.0.0"
port = 8080
mode = "production"

[auth]
enabled = true
token_file = "/etc/opencode/.token"
require_mfa = false

[features]
enable_telemetry = false
log_level = "info"
max_concurrent_tasks = 10`

export function ConfigPage(): string {
  const editor = `<div class="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
    <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
      <div class="flex items-center space-x-3"><span class="text-slate-400">▣</span><select class="bg-white border border-slate-200 text-slate-700 text-sm rounded-md p-1.5 font-medium"><option>OpenCode (config.toml)</option><option>oh-my-openagent (settings.json)</option></select></div>
      <div class="flex items-center space-x-4"><span class="text-xs text-slate-500">✓ 最后更新于 2 分钟前</span><button class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">保存配置</button></div>
    </div>
    <textarea class="min-h-[360px] w-full p-6 font-mono text-sm text-slate-200 bg-slate-900 leading-relaxed focus:outline-none resize-none" spellcheck="false">${sampleConfig}</textarea>
    <div class="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-500">readConfig · saveConfig · listPresets · applyPreset · listBackups · restoreBackup</div>
  </div>`
  const backups = panel("最近备份", `<div class="relative border-l border-slate-200 pl-4 space-y-6">
    ${backupItem("当前版本", "10 分钟前", true)}
    ${backupItem("备份 ID_7x9Q", "2 天前", false)}
    ${backupItem("系统初始化", "1 周前", false)}
    <button class="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">应用预设</button>
  </div>`, "w-full lg:w-80 shrink-0")

  return pageFrame({
    title: "配置与备份",
    subtitle: "管理各组件的配置文件及历史版本",
    body: `<div class="flex flex-col lg:flex-row gap-6 min-h-[520px]">${editor}${backups}</div>`,
  })
}

function backupItem(label: string, time: string, current: boolean): string {
  return `<div class="relative"><span class="absolute -left-6 top-1 w-4 h-4 rounded-full ${current ? "bg-blue-100 border-2 border-blue-500" : "bg-white border-2 border-slate-300"}"></span><p class="text-sm font-medium ${current ? "text-slate-800" : "text-slate-700"}">${label}</p><p class="text-xs text-slate-500 mt-1 font-mono">${time}</p></div>`
}
