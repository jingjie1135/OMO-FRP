import type {
  AppConfig as CoreAppConfig,
  InstallState as CoreInstallState,
  PlatformMode,
  PluginInstance,
  PublicRoute,
  ToolInstance as CoreToolInstance,
  ToolKind as CoreToolKind,
} from "../schema"

export type RuntimeMode = Extract<PlatformMode, "server" | "desktop">

export interface RuntimeCapabilities {
  mode: RuntimeMode
  canManageFrpServer: boolean
  canManageFrpClient: boolean
  canInstallServerServices: boolean
  canAccessLocalFilesystem: boolean
  canManageSystemd: boolean
  canManageLocalProcesses: boolean
}

export const SERVER_CAPABILITIES: RuntimeCapabilities = {
  mode: "server",
  canManageFrpServer: true,
  canManageFrpClient: false,
  canInstallServerServices: true,
  canAccessLocalFilesystem: true,
  canManageSystemd: true,
  canManageLocalProcesses: true,
}

export const DESKTOP_CAPABILITIES: RuntimeCapabilities = {
  mode: "desktop",
  canManageFrpServer: false,
  canManageFrpClient: true,
  canInstallServerServices: false,
  canAccessLocalFilesystem: true,
  canManageSystemd: false,
  canManageLocalProcesses: true,
}

export type ToolKind = Extract<CoreToolKind, "opencode"> | "frpc" | "cloudflared" | "future-tool"
export type ToolHostType = "server" | "desktop"
export type ToolInstallState = "missing" | "detected" | "installed" | "configured"
export type ToolRuntimeStatus = "stopped" | "starting" | "running" | "error"

export interface ToolInstance {
  id: string
  kind: ToolKind
  displayName: string
  hostType: ToolHostType
  installState: ToolInstallState
  binaryPath?: string
  workingDirectory?: string
  configDirectory?: string
  defaultPort: number
  currentPort?: number
  status: ToolRuntimeStatus
  pid?: number
  logPath?: string
  lastExitCode?: number
  lastError?: string
}

export interface ConfigPreset {
  id: string
  name: string
  path: string
  updatedAt: string
}

export interface PluginConfig {
  toolInstanceId: string
  plugin: "oh-my-openagent"
  configPath: string
  status: "missing" | "detected" | "configured" | "invalid"
  presets: ConfigPreset[]
}

export interface PublicEndpoint {
  id: string
  name: string
  domain: string
  protocol: "https" | "http" | "tcp"
  targetType: "server-local" | "desktop-frp" | "cloudflare"
  targetToolInstanceId: string
  authMode: "basic-auth" | "opencode-password" | "both"
  status: "disabled" | "provisioning" | "active" | "error"
}

export interface FrpServerConfig {
  enabled: boolean
  panelUrl: string
  rpcUrl: string
  serverAddr: string
  bindPort: number
  authTokenRef: string
  dashboardEnabled: boolean
}

export interface FrpClientConfig {
  endpointId: string
  serverAddr: string
  serverPort: number
  authTokenRef: string
  localHost: string
  localPort: number
  remotePort?: number
  proxyName: string
  subdomain?: string
  customDomain?: string
  transport: "tcp" | "kcp" | "websocket" | "quic"
}

export interface AppConfig {
  mode: RuntimeMode
  toolInstances: ToolInstance[]
  pluginConfigs: PluginConfig[]
  publicEndpoints: PublicEndpoint[]
  frpServer?: FrpServerConfig
  frpClients: FrpClientConfig[]
}

export interface RuntimeInfo {
  capabilities: RuntimeCapabilities
  config: AppConfig
}

export function fromCoreAppConfig(config: CoreAppConfig): AppConfig {
  return {
    mode: config.mode === "desktop" ? "desktop" : "server",
    toolInstances: config.tools.map(toManagementToolInstance),
    pluginConfigs: config.plugins.map(toManagementPluginConfig),
    publicEndpoints: config.routes.map(toManagementEndpoint),
    frpServer: config.frp.server
      ? {
          enabled: true,
          panelUrl: "",
          rpcUrl: "",
          serverAddr: "",
          bindPort: config.frp.server.bindPort,
          authTokenRef: config.frp.server.tokenRef.id,
          dashboardEnabled: false,
        }
      : undefined,
    frpClients: [],
  }
}

function toManagementToolInstance(tool: CoreToolInstance): ToolInstance {
  const port = tool.localUrl ? Number(new URL(tool.localUrl).port || "4096") : 4096
  return {
    id: tool.id,
    kind: tool.kind === "opencode" ? "opencode" : "future-tool",
    displayName: tool.kind === "opencode" ? "OpenCode" : tool.kind,
    hostType: "server",
    installState: toManagementInstallState(tool.installState),
    binaryPath: tool.executable,
    defaultPort: port,
    currentPort: port,
    status: tool.installState === "running" ? "running" : "stopped",
  }
}

function toManagementInstallState(state: CoreInstallState): ToolInstallState {
  if (state === "missing") {
    return "missing"
  }
  if (state === "configured") {
    return "configured"
  }
  if (state === "installed" || state === "running") {
    return "installed"
  }
  return "detected"
}

function toManagementPluginConfig(plugin: PluginInstance): PluginConfig {
  return {
    toolInstanceId: plugin.toolId,
    plugin: plugin.kind,
    configPath: plugin.configPath ?? "",
    status: plugin.enabled ? "configured" : "detected",
    presets: [],
  }
}

function toManagementEndpoint(route: PublicRoute): PublicEndpoint {
  return {
    id: route.id,
    name: route.id,
    domain: route.publicHost,
    protocol: "https",
    targetType: route.provider === "cloudflare" ? "cloudflare" : "server-local",
    targetToolInstanceId: route.toolId,
    authMode: route.authRequired ? "opencode-password" : "basic-auth",
    status: route.status === "active" ? "active" : route.status === "error" ? "error" : "disabled",
  }
}
