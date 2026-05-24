import type { RuntimeMode } from "../../core/app-config/types"

export interface LayoutRoute {
  path: string
  label: string
  icon: string
}

export interface AppLayoutInput {
  mode: RuntimeMode
  routes: LayoutRoute[]
  activePath?: string
  content?: string
}

export function AppLayout(input: AppLayoutInput): string {
  const activePath = input.activePath ?? "/"
  const modeLabel = input.mode === "server" ? "服务器模式" : "桌面模式"
  const navigation = input.routes
    .map((route) => {
      const active = route.path === activePath
      return `<li><a href="${route.path}" class="flex items-center px-3 py-2.5 rounded-md transition-colors ${active ? "bg-blue-600/10 text-blue-400 font-medium" : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"}"><span class="mr-3 text-base">${route.icon}</span><span class="text-sm">${route.label}</span></a></li>`
    })
    .join("\n")

  return `<div class="fomo-shell flex h-screen w-full bg-slate-50 overflow-hidden font-sans" data-product="FRP-Oh-My-OpenCode">
  <aside class="w-64 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800">
    <div class="h-16 flex items-center px-6 border-b border-slate-800 text-white font-semibold text-lg tracking-wide" title="FRP-Oh-My-OpenCode"><span class="text-blue-500 mr-2">&lt;/&gt;</span>FOMO</div>
    <nav class="flex-1 overflow-y-auto py-4"><ul class="space-y-1 px-3">${navigation}</ul></nav>
    <div class="p-4 border-t border-slate-800 text-xs text-slate-500 text-center font-mono">v1.2.0-beta</div>
  </aside>
  <div class="flex flex-col flex-1 min-w-0">
    <header class="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200">
      <div class="flex items-center space-x-4">
        <h1 class="text-xl font-medium text-slate-800 tracking-tight" title="FRP-Oh-My-OpenCode">FOMO</h1>
        <span class="flex items-center px-2 py-1 bg-slate-100 rounded-md border border-slate-200 text-slate-600 text-xs font-medium">${modeLabel}</span>
      </div>
      <div class="flex items-center space-x-6">
        <span class="flex items-center space-x-2"><span class="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span><span class="text-sm text-slate-600 font-medium">系统在线</span></span>
        <span class="h-6 w-px bg-slate-200"></span>
        <button class="flex items-center text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium">刷新</button>
      </div>
    </header>
    <main class="flex-1 overflow-y-auto">${input.content ?? ""}</main>
  </div>
</div>`
}
