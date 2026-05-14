import { Globe, LayoutDashboard, Settings, Shield, TerminalSquare, Wrench } from "lucide-react"
import { DashboardView } from "../features/dashboard/DashboardView"
import type { DashboardViewModel } from "../features/dashboard/dashboard-view-model"

const navigationItems = [
  { label: "主控台", icon: LayoutDashboard, active: true },
  { label: "工具管理", icon: Wrench, active: false },
  { label: "公网入口", icon: Globe, active: false },
  { label: "配置与备份", icon: Settings, active: false },
  { label: "FRP 穿透", icon: Shield, active: false },
  { label: "日志", icon: TerminalSquare, active: false },
]

export function ManagementDashboardApp({ dashboard }: { dashboard: DashboardViewModel }) {
  const runtimeLabel = dashboard.runtimeInfo.capabilities.mode === "server" ? "服务器模式" : "桌面模式"

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
        <div className="flex h-16 items-center border-b border-slate-800 px-6 text-lg font-semibold tracking-wide text-white">
          <span className="mr-2 text-blue-400">{"</>"}</span>
          OpenCode Remote
        </div>
        <nav className="flex-1 px-3 py-4" aria-label="管理导航">
          <ul className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    className={`flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                      item.active ? "bg-blue-600/10 font-medium text-blue-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <p className="text-sm font-medium text-slate-500">FOMO</p>
            <h1 className="text-xl font-medium tracking-tight text-slate-800">OpenCode Remote Platform</h1>
          </div>
          <div className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{runtimeLabel}</div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <DashboardView runtimeInfo={dashboard.runtimeInfo} frpStatus={dashboard.frpStatus} logs={dashboard.logs} />
        </main>
      </div>
    </div>
  )
}
