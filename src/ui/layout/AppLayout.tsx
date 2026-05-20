import React from "react"
import { Globe, LayoutDashboard, RefreshCw, Server, Settings, Shield, Wrench } from "lucide-react"
import type { RuntimeMode } from "../../core/app-config/types"

export interface LayoutRoute {
  path: string
  label: string
}

export interface AppLayoutProps {
  mode: RuntimeMode
  routes: LayoutRoute[]
  children?: React.ReactNode
}

export function AppLayout({ mode, routes, children }: AppLayoutProps) {
  const runtimeLabel = mode === "desktop" ? "桌面模式" : "服务器模式"

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900">
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
        <div className="flex h-16 items-center border-b border-slate-800 px-6 text-lg font-semibold tracking-wide text-white" title="FRP-Oh-My-OpenCode">
          <span className="mr-2 text-blue-400">{"</>"}</span>
          FOMO
        </div>
        <nav aria-label="主导航" className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {routes.map((route) => (
              <li key={route.path}>
                <a href={route.path} className="flex items-center rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-slate-800 hover:text-slate-100">
                  <RouteIcon path={route.path} />
                  {route.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-slate-800 p-4 text-center font-mono text-xs text-slate-500">v1.2.0-beta</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-medium tracking-tight text-slate-800" title="FRP-Oh-My-OpenCode">FOMO</h1>
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
              <Server className="mr-1 h-3.5 w-3.5" />
              {runtimeLabel}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </div>
              <span className="text-sm font-medium text-slate-600">系统在线</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <button type="button" className="flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-slate-800">
              <RefreshCw className="mr-1.5 h-4 w-4" />
              刷新
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {children}
          <div className="hidden" data-testid="layout-summary" data-layout-mode={mode}>
            {mode}:{routes.map((route) => route.label).join("|")}
          </div>
        </main>
      </div>
    </div>
  )
}

function RouteIcon({ path }: { path: string }) {
  const Icon = path === "/"
    ? LayoutDashboard
    : path === "/tools"
      ? Wrench
      : path === "/endpoints" || path === "/cloudflare"
        ? Globe
        : path === "/frp"
          ? Shield
          : Settings

  return <Icon className="mr-3 h-5 w-5 text-slate-500" />
}
