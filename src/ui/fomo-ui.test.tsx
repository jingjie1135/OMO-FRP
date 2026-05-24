import { describe, expect, it } from "bun:test"
import { DESKTOP_CAPABILITIES, SERVER_CAPABILITIES, type PublicEndpoint, type RuntimeInfo, type ToolInstance } from "../core/app-config/types"
import { App } from "./app/App"
import { ConfigPage } from "./features/config/ConfigPage"
import { DashboardPage } from "./features/dashboard/DashboardPage"
import { EndpointsPage } from "./features/endpoints/EndpointsPage"
import { CloudflarePage } from "./features/cloudflare/CloudflarePage"
import { FrpPage } from "./features/frp/FrpPage"
import { LogsPage } from "./features/logs/LogsPage"
import { SettingsPage } from "./features/settings/SettingsPage"
import { ToolsPage } from "./features/tools/ToolsPage"

const tools: ToolInstance[] = [
  {
    id: "opencode-local",
    kind: "opencode",
    displayName: "OpenCode",
    hostType: "server",
    installState: "configured",
    binaryPath: "opencode",
    configDirectory: "/etc/opencode",
    defaultPort: 4096,
    currentPort: 4096,
    status: "running",
  },
  {
    id: "future-docker",
    kind: "future-tool",
    displayName: "Docker Engine",
    hostType: "server",
    installState: "missing",
    defaultPort: 2375,
    status: "stopped",
  },
]

const endpoints: PublicEndpoint[] = [
  {
    id: "opencode-web",
    name: "OpenCode Web",
    domain: "code.example.com",
    protocol: "https",
    targetType: "server-local",
    targetToolInstanceId: "opencode-local",
    authMode: "opencode-password",
    status: "disabled",
  },
  {
    id: "desktop-frp",
    name: "Desktop FRP",
    domain: "alice-code.frp.example.com",
    protocol: "https",
    targetType: "desktop-frp",
    targetToolInstanceId: "opencode-local",
    authMode: "both",
    status: "active",
  },
]

const runtimeInfo: RuntimeInfo = {
  capabilities: SERVER_CAPABILITIES,
  config: {
    mode: "server",
    toolInstances: tools,
    pluginConfigs: [],
    publicEndpoints: endpoints,
    frpServer: {
      enabled: true,
      panelUrl: "https://frp.example.com",
      rpcUrl: "wss://frp.example.com/rpc",
      serverAddr: "frp.example.com",
      bindPort: 7000,
      authTokenRef: "secret:frp-token",
      dashboardEnabled: true,
    },
    frpClients: [],
  },
}

describe("FOMO management UI rebuild", () => {
  it("renders the FOMO shell with prioritized Chinese navigation", () => {
    const html = App(runtimeInfo)

    expect(html).toContain("FRP-Oh-My-OpenCode")
    expect(html).toContain("主控台")
    expect(html).toContain("工具管理")
    expect(html).toContain("公网入口")
    expect(html).toContain("配置与备份")
    expect(html).toContain("FRP 穿透")
    expect(html).toContain("日志")
    expect(html).toContain("设置")
    expect(html).toContain("Cloudflare 隧道")
    expect(html).toContain("服务器模式")
    expect(html).toContain("系统在线")
  })

  it("selects rebuilt pages by route path through the app shell", () => {
    expect(App(runtimeInfo, "/tools")).toContain("工具管理")
    expect(App(runtimeInfo, "/endpoints")).toContain("启用入口安全检查")
    expect(App(runtimeInfo, "/config")).toContain("OpenCode (config.toml)")
    expect(App(runtimeInfo, "/frp")).toContain("FRP 服务端")
    expect(App(runtimeInfo, "/logs")).toContain("/var/log/opencode/system.log")
    expect(App(runtimeInfo, "/settings")).toContain("管理员会话")
    expect(App(runtimeInfo, "/cloudflare")).toContain("cloudflared tunnel --url")
    expect(App({ ...runtimeInfo, capabilities: DESKTOP_CAPABILITIES, config: { ...runtimeInfo.config, mode: "desktop" } })).toContain("本机 OpenCode")
  })

  it("renders dashboard priority content from runtime data", () => {
    const html = DashboardPage(runtimeInfo)

    expect(html).toContain("未设置 OpenCode 访问密码")
    expect(html).toContain("工具实例")
    expect(html).toContain("1 / 2")
    expect(html).toContain("公网入口")
    expect(html).toContain("1 个已启用")
    expect(html).toContain("FRP 状态")
    expect(html).toContain("近期系统运行日志")
    expect(html).toContain("快捷操作")
    expect(html).toContain("服务器 OpenCode")
    expect(html).toContain("FRP 服务端")
    expect(html).toContain("enableEndpoint")
  })

  it("renders FOMO tool cards and missing-tool actions", () => {
    const html = ToolsPage(tools)

    expect(html).toContain("工具管理")
    expect(html).toContain("运行环境检测")
    expect(html).toContain("安装新工具")
    expect(html).toContain("OpenCode")
    expect(html).toContain("运行中")
    expect(html).toContain("Docker Engine")
    expect(html).toContain("未检测到")
    expect(html).toContain("立即安装")
    expect(html).toContain("detectTools")
    expect(html).toContain("getToolLogs")
  })

  it("renders endpoint table with security enable gate", () => {
    const html = EndpointsPage(endpoints)

    expect(html).toContain("公网入口")
    expect(html).toContain("入口名称")
    expect(html).toContain("OpenCode Web")
    expect(html).toContain("code.example.com")
    expect(html).toContain("opencode-local")
    expect(html).toContain("启用入口安全检查")
    expect(html).toContain("确认启用")
    expect(html).toContain("Caddy Basic Auth")
    expect(html).toContain("域名 allowlist")
    expect(html).toContain("目标端口冲突")
  })

  it("renders config editor and backup timeline", () => {
    const html = ConfigPage()

    expect(html).toContain("配置与备份")
    expect(html).toContain("OpenCode (config.toml)")
    expect(html).toContain("oh-my-openagent")
    expect(html).toContain("保存配置")
    expect(html).toContain("最近备份")
    expect(html).toContain("应用预设")
    expect(html).toContain("readConfig")
    expect(html).toContain("restoreBackup")
    expect(html).toContain("textarea")
  })

  it("renders server and desktop FRP variants", () => {
    expect(FrpPage(SERVER_CAPABILITIES)).toContain("FRP 服务端")
    expect(FrpPage(SERVER_CAPABILITIES)).toContain("初始化 frp-panel")
    expect(FrpPage(SERVER_CAPABILITIES)).toContain("生成桌面端连接配置")
    expect(FrpPage(SERVER_CAPABILITIES)).toContain("客户端列表")
    expect(FrpPage(SERVER_CAPABILITIES)).toContain("saveFrpConfig")
    const desktopFrp = FrpPage(DESKTOP_CAPABILITIES)
    expect(desktopFrp).toContain("FRP 客户端")
    expect(desktopFrp).toContain("生成 frpc 配置")
    expect(desktopFrp).toContain("启动 frpc")
    expect(desktopFrp).toContain('placeholder="example_token_replace_me"')
    expect(desktopFrp).not.toContain("super_secret")
  })

  it("renders the lower-priority logs, settings, and Cloudflare pages", () => {
    expect(LogsPage()).toContain("系统日志")
    expect(LogsPage()).toContain("/var/log/opencode/system.log")
    expect(SettingsPage()).toContain("设置")
    expect(SettingsPage()).toContain("管理员会话")
    expect(CloudflarePage()).toContain("Cloudflare 隧道")
    expect(CloudflarePage()).toContain("cloudflared tunnel --url")
    expect(CloudflarePage()).toContain("规划诊断")
    expect(CloudflarePage()).toContain("password-missing")
    expect(CloudflarePage()).toContain("securityNotes")
  })

  it("escapes runtime-sourced log text", () => {
    const html = LogsPage(["[INFO] <script>alert('xss')</script>"])

    expect(html).toContain("&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;")
    expect(html).not.toContain("<script>alert")
  })
})


