import type {
  ConfigPreset,
  FrpClientConfig,
  FrpServerConfig,
  PublicEndpoint,
  RuntimeInfo,
  ToolInstance,
  ToolKind,
} from "../core/app-config/types"

export type { RuntimeInfo }

export type ManagementToolKind = ToolKind | "bun" | "oh-my-openagent" | "docker" | "docker-compose" | "caddy"

export interface ToolDetection {
  kind: ManagementToolKind
  displayName: string
  detected: boolean
  binaryPath?: string
  version?: string
  configDirectory?: string
}

export interface InstallToolRequest {
  kind: ManagementToolKind
  version?: string
  targetDirectory?: string
}

export interface JobResult {
  jobId: string
  status: "queued" | "running" | "succeeded" | "failed"
  message: string
}

export interface LogLine {
  timestamp: string
  level: "debug" | "info" | "warn" | "error"
  message: string
}

export interface ConfigTarget {
  toolInstanceId: string
  kind: "opencode" | "oh-my-openagent"
  path?: string
}

export interface ConfigDocument {
  target: ConfigTarget
  content: string
  updatedAt?: string
  path?: string
  missing?: boolean
  error?: string
}

export interface ConfigBackup {
  id: string
  target: ConfigTarget
  path: string
  createdAt: string
}

export interface ConfigValidationFieldError {
  field: string
  message: string
}

export interface ConfigValidationResult {
  valid: boolean
  fieldErrors: ConfigValidationFieldError[]
}

export type FrpFailureReason =
  | "auth_failed"
  | "api_unreachable"
  | "rpc_unreachable"
  | "proxy_not_ready"
  | "local_service_unreachable"
  | "client_not_ready"
  | "timeout"
  | "unknown"

export interface FrpPanelClientResource {
  id: string
  status: "online" | "offline" | "error" | "unknown"
  lastSeenAt?: string
  frpsUrl?: string
}

export interface FrpPanelProxyResource {
  name: string
  type: string
  status: "running" | "stopped" | "error" | "unknown"
  remoteAddress?: string
  publicUrl?: string
  error?: string
}

export interface FrpStatus {
  mode: "server" | "client" | "unavailable"
  running: boolean
  message: string
  status?: "idle" | "provisioning" | "ready" | "error"
  failureReason?: FrpFailureReason
  suggestion?: string
  publicUrl?: string
  client?: FrpPanelClientResource
  proxy?: FrpPanelProxyResource
}

export type FrpConfigRequest = FrpServerConfig | FrpClientConfig

export type { ConfigPreset, PublicEndpoint, ToolInstance }
