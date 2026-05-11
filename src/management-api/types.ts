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

export interface ToolDetection {
  kind: ToolKind
  displayName: string
  detected: boolean
  binaryPath?: string
  version?: string
  configDirectory?: string
}

export interface InstallToolRequest {
  kind: ToolKind
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
}

export interface ConfigBackup {
  id: string
  target: ConfigTarget
  path: string
  createdAt: string
}

export interface FrpStatus {
  mode: "server" | "client" | "unavailable"
  running: boolean
  message: string
}

export type FrpConfigRequest = FrpServerConfig | FrpClientConfig

export type { ConfigPreset, PublicEndpoint, ToolInstance }
