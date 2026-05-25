import { useEffect, useState } from "react"
import { Globe, LayoutDashboard, Monitor, RefreshCw, Server, Settings, Shield, TerminalSquare, Wrench } from "lucide-react"
import type { ManagementClient } from "../../management-api/client"
import type { ConfigBackup, ConfigDocument, ConfigPreset, ConfigTarget, RuntimeInfo } from "../../management-api/types"
import { redactSensitiveText } from "../../shared/redact-sensitive-text"
import { CloudflareTunnelPageWrapper } from "../features/cloudflare/CloudflareTunnelPageWrapper"
import { ConfigPage } from "../features/config/ConfigPage"
import { DashboardView } from "../features/dashboard/DashboardView"
import { DesktopTunnelsPageWrapper } from "../features/desktop-tunnels/DesktopTunnelsPageWrapper"
import { type DashboardState, useDashboardState } from "../features/dashboard/use-dashboard-state"
import { EndpointsPageWrapper } from "../features/endpoints/EndpointsPageWrapper"
import { FrpPageWrapper } from "../features/frp/FrpPageWrapper"
import { SettingsPage } from "../features/settings/SettingsPage"
import { ToolsPage } from "../features/tools/ToolsPage"

type NavigationItem = {
  id: ManagementPageId
  label: string
  icon: typeof LayoutDashboard
  requiresCloudflareTunnel?: boolean
}

const navigationItems: NavigationItem[] = [
  { id: "dashboard", label: "主控台", icon: LayoutDashboard },
  { id: "tools", label: "工具管理", icon: Wrench },
  { id: "endpoints", label: "公网入口", icon: Globe },
  { id: "config", label: "配置与备份", icon: Settings },
  { id: "frp", label: "FRP 穿透", icon: Shield },
  { id: "desktop-tunnels", label: "远程设备", icon: Monitor },
  { id: "cloudflare", label: "Cloudflare 隧道", icon: Globe, requiresCloudflareTunnel: true },
  { id: "logs", label: "日志", icon: TerminalSquare },
]

type ManagementPageId = "dashboard" | "tools" | "endpoints" | "config" | "frp" | "desktop-tunnels" | "cloudflare" | "logs"

export function ManagementDashboardApp({ client }: { client: ManagementClient }) {
  const dashboardState = useDashboardState(client)
  const [activePage, setActivePage] = useState<ManagementPageId>("dashboard")
  const runtimeLabel = dashboardState.dashboard?.runtimeInfo.capabilities.mode === "desktop" ? "桌面模式" : "服务器模式"
  const lastUpdatedLabel = dashboardState.lastUpdated ? dashboardState.lastUpdated.toLocaleTimeString("zh-CN", { hour12: false }) : "尚未同步"
  const visibleNavigationItems = getVisibleNavigationItems(dashboardState.dashboard?.runtimeInfo)
  const effectiveActivePage = visibleNavigationItems.some((item) => item.id === activePage) ? activePage : "dashboard"

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50 font-sans text-slate-900">
      <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300">
        <div className="flex h-16 items-center border-b border-slate-800 px-6 text-lg font-semibold tracking-wide text-white" title="FRP-Oh-My-OpenCode">
          <span className="mr-2 text-blue-400">{"</>"}</span>
          FOMO
        </div>
        <nav className="flex-1 px-3 py-4" aria-label="管理导航">
          <ul className="space-y-1">
            {visibleNavigationItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => setActivePage(item.id)}
                      aria-current={effectiveActivePage === item.id ? "page" : undefined}
                      className={`flex w-full items-center rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                        effectiveActivePage === item.id ? "bg-blue-600/10 font-medium text-blue-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
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
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          {dashboardState.isLoading ? <DashboardLoadingState /> : null}
          {!dashboardState.isLoading && dashboardState.errorMessage ? <DashboardErrorState message={dashboardState.errorMessage} onRetry={dashboardState.refresh} /> : null}
          {!dashboardState.isLoading && dashboardState.dashboard ? renderActivePage(effectiveActivePage, client, dashboardState, setActivePage) : null}
        </main>
      </div>
    </div>
  )
}

function getVisibleNavigationItems(runtimeInfo: RuntimeInfo | undefined) {
  return navigationItems.filter((item) => !item.requiresCloudflareTunnel || runtimeInfo?.capabilities.canManageCloudflareTunnel)
}

function renderActivePage(activePage: ManagementPageId, client: ManagementClient, dashboardState: DashboardState, openPage: (page: ManagementPageId) => void) {
  const dashboard = dashboardState.dashboard
  if (!dashboard) {
    return null
  }

  switch (activePage) {
    case "dashboard":
      return <DashboardView runtimeInfo={dashboard.runtimeInfo} frpStatus={dashboard.frpStatus} logs={dashboard.logs} onOpenPage={openPage} />
    case "tools":
      return <ToolsPage client={client} />
    case "endpoints":
      return <EndpointsPageWrapper client={client} />
    case "config":
      return <ConfigPageShell client={client} runtimeInfo={dashboard.runtimeInfo} />
    case "frp":
      return <FrpPageWrapper client={client} initialRuntimeInfo={dashboard.runtimeInfo} initialStatus={dashboard.frpStatus} initialEndpoints={dashboard.runtimeInfo.config.publicEndpoints} />
    case "desktop-tunnels":
      return <DesktopTunnelsPageWrapper client={client} />
    case "cloudflare":
      return <CloudflareTunnelPageWrapper client={client} initialRuntimeInfo={dashboard.runtimeInfo} />
    case "logs":
      return <LogsPage dashboard={dashboard} />
  }
}

function LogsPage({ dashboard }: { dashboard: NonNullable<DashboardState["dashboard"]> }) {
  return (
    <section className="flex h-[calc(100vh-4rem)] flex-col p-8" aria-label="系统日志">
      <div className="mb-6 flex shrink-0 flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-800">系统日志</h1>
          <p className="mt-1 text-sm text-slate-500">查看和导出系统各组件的运行日志</p>
        </div>
        <div className="flex gap-3">
          <button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            清空日志
          </button>
          <button type="button" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-900">
            导出日志
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-[#1E1E1E] shadow-inner">
        <div className="flex shrink-0 items-center border-b border-[#333] bg-[#252526] px-4 py-2">
          <TerminalSquare className="mr-2 h-4 w-4 text-slate-400" />
          <span className="font-mono text-xs text-slate-400">/var/log/opencode/system.log</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
          {dashboard.logs.length === 0 ? <p className="text-slate-500">暂无日志</p> : dashboard.logs.map((log) => (
            <div key={`${log.timestamp}-${log.level}-${log.message}`} className={`mb-1 ${getLogLevelClass(log.level)}`}>
              [{log.timestamp}] [{log.level.toUpperCase()}] {redactSensitiveText(log.message)}
            </div>
          ))}
          <div className="mt-2 animate-pulse text-slate-500">_</div>
        </div>
      </div>
    </section>
  )
}

type ConfigPageInitialData = {
  selectedTarget: ConfigTarget
  opencode: ConfigDocument
  ohMyOpenAgent: ConfigDocument
  presets: ConfigPreset[]
  backups: ConfigBackup[]
}

function ConfigPageShell({ client, runtimeInfo }: { client: ManagementClient; runtimeInfo: RuntimeInfo }) {
  const [initialData, setInitialData] = useState<ConfigPageInitialData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadConfig = async () => {
      setError(null)
      const data = await createConfigInitialData(client, runtimeInfo)
      if (!cancelled) {
        setInitialData(data)
      }
    }

    void loadConfig().catch((loadError: unknown) => {
      if (!cancelled) {
        setError(loadError instanceof Error ? loadError.message : String(loadError))
      }
    })

    return () => {
      cancelled = true
    }
  }, [client, runtimeInfo])

  if (error) {
    return (
      <section className="p-8" aria-label="配置加载错误">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">配置数据加载失败：{redactSensitiveText(error)}</div>
      </section>
    )
  }

  if (!initialData) {
    return (
      <section className="p-8" aria-label="配置加载状态">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">正在加载配置数据……</div>
      </section>
    )
  }

  return (
    <ConfigPage
      key={`${initialData.selectedTarget.toolInstanceId}:${initialData.selectedTarget.kind}:${initialData.selectedTarget.path ?? "default"}`}
      client={client}
      initialSelectedTarget={initialData.selectedTarget}
      opencode={initialData.opencode}
      ohMyOpenAgent={initialData.ohMyOpenAgent}
      presets={initialData.presets}
      backups={initialData.backups}
    />
  )
}

async function createConfigInitialData(client: ManagementClient, runtimeInfo: RuntimeInfo): Promise<ConfigPageInitialData> {
  const tool = runtimeInfo.config.toolInstances[0]
  if (!tool) {
    const fallbackTarget: ConfigTarget = { toolInstanceId: "opencode-server", kind: "opencode" }
    const fallbackPluginTarget: ConfigTarget = { toolInstanceId: "opencode-server", kind: "oh-my-openagent" }
    return {
      selectedTarget: fallbackTarget,
      opencode: createMissingConfigDocument(fallbackTarget, "当前运行时没有可配置的工具实例。"),
      ohMyOpenAgent: createMissingConfigDocument(fallbackPluginTarget, "当前运行时没有可配置的工具实例。"),
      presets: [],
      backups: [],
    }
  }

  const opencodeTarget: ConfigTarget = {
    toolInstanceId: tool.id,
    kind: "opencode",
    path: tool.configDirectory ? `${tool.configDirectory}/opencode.json` : undefined,
  }
  const pluginConfig = runtimeInfo.config.pluginConfigs.find((item) => item.toolInstanceId === tool.id && item.plugin === "oh-my-openagent")
  const pluginTarget: ConfigTarget = {
    toolInstanceId: tool.id,
    kind: "oh-my-openagent",
    path: pluginConfig?.configPath ?? (tool.configDirectory ? `${tool.configDirectory}/oh-my-openagent.json` : undefined),
  }

  const [opencode, ohMyOpenAgent] = await Promise.all([
    safeReadConfig(client, opencodeTarget),
    pluginConfig || tool.configDirectory ? safeReadConfig(client, pluginTarget) : Promise.resolve(createMissingConfigDocument(pluginTarget, "当前工具未配置 oh-my-openagent 插件。")),
  ])
  const selectedTarget = ohMyOpenAgent.missing ? opencodeTarget : pluginTarget
  const [presets, backups] = await Promise.all([
    client.listPresets(selectedTarget),
    client.listBackups(selectedTarget),
  ])

  return { selectedTarget, opencode, ohMyOpenAgent, presets, backups }
}

async function safeReadConfig(client: ManagementClient, target: ConfigTarget): Promise<ConfigDocument> {
  try {
    return await client.readConfig(target)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const lowerMessage = message.toLowerCase()
    return {
      target,
      content: "",
      path: target.path,
      missing: lowerMessage.includes("missing") || lowerMessage.includes("not found") || lowerMessage.includes("no such file") || lowerMessage.includes("未配置"),
      error: message,
    }
  }
}

function createMissingConfigDocument(target: ConfigTarget, error: string): ConfigDocument {
  return {
    target,
    content: "",
    path: target.path,
    missing: true,
    error,
  }
}

function getLogLevelClass(level: string) {
  if (level === "error") return "text-red-400"
  if (level === "warn") return "text-amber-400"
  if (level === "debug") return "text-slate-500"
  return "text-slate-300"
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
      <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
        <span>Management backend is unavailable: {message}</span>
        <button type="button" onClick={() => void onRetry()} className="rounded-md border border-red-200 bg-white px-3 py-1 text-xs font-medium text-red-700">
          重试
        </button>
      </div>
    </section>
  )
}
