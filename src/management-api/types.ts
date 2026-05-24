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

export type CloudflareTunnelMode = "quick" | "named"

export type CloudflareTunnelStepId =
  | "login"
  | "create_tunnel"
  | "configure_dns"
  | "write_config"
  | "start_tunnel"
  | "verify_public_access"

export type CloudflareTunnelStepStatus = "idle" | "pending" | "succeeded" | "failed"

export type CloudflareTunnelFailureReason =
  | "cloudflared_missing"
  | "opencode_not_running"
  | "password_missing"
  | "login_required"
  | "tunnel_create_failed"
  | "dns_route_failed"
  | "config_write_failed"
  | "public_access_failed"
  | "timeout"
  | "unknown"

export interface CloudflareTunnelConfigRequest {
  mode: CloudflareTunnelMode
  localHost: string
  localPort: number
  tunnelName?: string
  hostname?: string
  dnsRoute?: string
}

export interface CloudflareTunnelDiagnostic {
  code: string
  severity: "error" | "warning" | "info"
  message: string
  fix: string
}

export interface CloudflareTunnelStep {
  id: CloudflareTunnelStepId
  label: string
  status: CloudflareTunnelStepStatus
  message?: string
  retryable?: boolean
}

export interface CloudflareTunnelPlan {
  mode: CloudflareTunnelMode
  localUrl: string
  publicUrl?: string
  tunnelName?: string
  hostname?: string
  dnsRoute?: string
  commandSummary: string[]
  cloudflaredDetected: boolean
  diagnostics: CloudflareTunnelDiagnostic[]
  securityNotes: string[]
  steps: CloudflareTunnelStep[]
}

export interface CloudflareTunnelStatus {
  mode: CloudflareTunnelMode | "unavailable"
  running: boolean
  message: string
  publicUrl?: string
  currentStep?: CloudflareTunnelStepId
  failureReason?: CloudflareTunnelFailureReason
  suggestion?: string
}

export interface SecurityCheck {
  id: string
  label: string
  status: "pass" | "warn" | "fail"
  message: string
  fix?: string
}

export interface BackupSummary {
  count: number
  lastBackupTime?: string
  backupDirectory: string
  failureRecords: string[]
  canManualBackup: boolean
  canCleanup: boolean
}

export interface Diagnostics {
  runtime: RuntimeInfo
  tools: ToolDetection[]
  endpoints: PublicEndpoint[]
  frp: FrpStatus
  jobs: JobResult[]
  redactedLogs: LogLine[]
}

export type { ConfigPreset, PublicEndpoint, ToolInstance }
