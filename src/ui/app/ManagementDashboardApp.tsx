import { Globe, LayoutDashboard, RefreshCw, Settings, Shield, TerminalSquare, Wrench } from "lucide-react"
import type { ManagementClient } from "../../management-api/client"
import type { RuntimeInfo } from "../../management-api/types"
import { DashboardView } from "../features/dashboard/DashboardView"
import { useDashboardState } from "../features/dashboard/use-dashboard-state"

const navigationItems = [
  { label: "主控台", icon: LayoutDashboard, active: true },
  { label: "工具管理", icon: Wrench, active: false },
  { label: "公网入口", icon: Globe, active: false },
  { label: "配置与备份", icon: Settings, active: false },
  { label: "FRP 穿透", icon: Shield, active: false },
  { label: "Cloudflare Tunnel", icon: Globe, active: false, requiresCloudflareTunnel: true },
  { label: "日志", icon: TerminalSquare, active: false },
]

export function ManagementDashboardApp({ client }: { client: ManagementClient }) {
  const dashboardState = useDashboardState(client)
  const runtimeLabel = dashboardState.dashboard?.runtimeInfo.capabilities.mode === "desktop" ? "桌面模式" : "服务器模式"
  const lastUpdatedLabel = dashboardState.lastUpdated ? dashboardState.lastUpdated.toLocaleTimeString("zh-CN", { hour12: false }) : "尚未同步"
  const visibleNavigationItems = getVisibleNavigationItems(dashboardState.dashboard?.runtimeInfo)

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
        <div className="flex h-16 items-center border-b border-slate-800 px-6 text-lg font-semibold tracking-wide text-white">
          <span className="mr-2 text-blue-400">{"</>"}</span>
          OpenCode Remote
        </div>
        <nav className="flex-1 px-3 py-4" aria-label="管理导航">
          <ul className="space-y-1">
            {visibleNavigationItems.map((item) => {
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
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">最后同步：{lastUpdatedLabel}</span>
            <button
              type="button"
              onClick={() => void dashboardState.refresh()}
              disabled={dashboardState.isLoading || dashboardState.isRefreshing}
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              {dashboardState.isRefreshing ? "刷新中" : "刷新"}
            </button>
            <div className="rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">{runtimeLabel}</div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {dashboardState.isLoading ? <DashboardLoadingState /> : null}
          {!dashboardState.isLoading && dashboardState.errorMessage ? <DashboardErrorState message={dashboardState.errorMessage} onRetry={dashboardState.refresh} /> : null}
          {dashboardState.dashboard ? (
            <DashboardView runtimeInfo={dashboardState.dashboard.runtimeInfo} frpStatus={dashboardState.dashboard.frpStatus} logs={dashboardState.dashboard.logs} />
          ) : null}
        </main>
      </div>
    </div>
  )
}

function getVisibleNavigationItems(runtimeInfo: RuntimeInfo | undefined) {
  return navigationItems.filter((item) => !item.requiresCloudflareTunnel || runtimeInfo?.capabilities.canManageCloudflareTunnel)
}

function DashboardLoadingState() {
  return (
    <section className="p-8" aria-label="主控台加载状态">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">正在加载主控台数据……</div>
    </section>
  )
}

function DashboardErrorState({ message, onRetry }: { message: string; onRetry(): Promise<void> }) {
  return (
    <section className="px-8 pt-8" aria-label="主控台错误状态">
      <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <span>{message}</span>
        <button type="button" onClick={() => void onRetry()} className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700">
          重试
        </button>
      </div>
    </section>
  )
}
