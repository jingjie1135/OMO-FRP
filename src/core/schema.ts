export type PlatformMode = "server" | "desktop" | "local"
export type ToolKind = "opencode" | "claude-code" | "gemini-cli"
export type PluginKind = "oh-my-openagent"
export type RouteProvider = "frp" | "cloudflare"
export type RouteStatus = "planned" | "active" | "blocked" | "error"
export type InstallState = "missing" | "installed" | "configured" | "running" | "unknown"
export type OperationStatus = "planned" | "running" | "succeeded" | "failed" | "blocked"

export interface SecretRef {
  id: string
  source: "env" | "file" | "keychain"
  name: string
}

export interface AuthConfig {
  username?: string
  passwordRef?: SecretRef
  required: boolean
}

export interface ToolInstance {
  id: string
  kind: ToolKind
  executable: string
  localUrl?: string
  auth: AuthConfig
  installState: InstallState
}

export interface PluginInstance {
  toolId: string
  kind: PluginKind
  package: string
  configPath?: string
  enabled: boolean
}

export interface PublicRoute {
  id: string
  toolId: string
  provider: RouteProvider
  publicHost: string
  targetHost: string
  targetPort: number
  authRequired: boolean
  status: RouteStatus
}

export interface FrpProxy {
  routeId: string
  type: "http" | "tcp"
  customDomains: string[]
  localIp: string
  localPort: number
}

export interface FrpServerProfile {
  bindPort: number
  vhostHttpPort: number
  vhostHttpsPort: number
  tokenRef: SecretRef
  allowedDomains: string[]
}

export interface FrpClientProfile {
  serverAddr: string
  serverPort: number
  tokenRef: SecretRef
  proxies: FrpProxy[]
}

export interface FrpConfig {
  server?: FrpServerProfile
  clients: FrpClientProfile[]
}

export interface OperationRun {
  action: string
  targetId: string
  status: OperationStatus
  redactedLogPath: string
}

export interface AppConfig {
  schemaVersion: 1
  mode: PlatformMode
  tools: ToolInstance[]
  plugins: PluginInstance[]
  routes: PublicRoute[]
  frp: FrpConfig
  secrets: SecretRef[]
}

export const APP_CONFIG_SCHEMA_VERSION = 1 as const
