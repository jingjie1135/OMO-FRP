import { SERVER_CAPABILITIES, type AppConfig, type RuntimeInfo } from "../core/app-config/types"
import type {
  ConfigBackup,
  ConfigDocument,
  ConfigPreset,
  ConfigTarget,
  FrpConfigRequest,
  FrpStatus,
  InstallToolRequest,
  JobResult,
  LogLine,
  ToolDetection,
  ToolInstance,
} from "../management-api/types"
import { createLocalManagementRuntime } from "../management-api/local-management-runtime"

export interface ServerRuntimeAdapter {
  getRuntimeInfo(): Promise<RuntimeInfo>
  detectTools(): Promise<ToolDetection[]>
  listToolInstances(): Promise<ToolInstance[]>
  installTool(request: InstallToolRequest): Promise<JobResult>
  startTool(instanceId: string): Promise<JobResult>
  stopTool(instanceId: string): Promise<JobResult>
  restartTool(instanceId: string): Promise<JobResult>
  getToolLogs(instanceId: string): Promise<LogLine[]>
  readConfig(target: ConfigTarget): Promise<ConfigDocument>
  saveConfig(target: ConfigTarget, content: string): Promise<void>
  listPresets(target: ConfigTarget): Promise<ConfigPreset[]>
  applyPreset(target: ConfigTarget, presetId: string): Promise<void>
  listBackups(target: ConfigTarget): Promise<ConfigBackup[]>
  restoreBackup(target: ConfigTarget, backupId: string): Promise<void>
  listEndpoints(): Promise<ReturnType<typeof createEmptyServerConfig>["publicEndpoints"]>
  saveEndpoint(endpoint: ReturnType<typeof createEmptyServerConfig>["publicEndpoints"][number]): Promise<void>
  enableEndpoint(id: string): Promise<JobResult>
  disableEndpoint(id: string): Promise<JobResult>
  getFrpStatus(): Promise<FrpStatus>
  saveFrpConfig(config: FrpConfigRequest): Promise<void>
  startFrp(): Promise<JobResult>
  stopFrp(): Promise<JobResult>
}

export function createServerRuntimeAdapter(config: AppConfig = createEmptyServerConfig()): ServerRuntimeAdapter {
  return createLocalManagementRuntime({
    capabilities: SERVER_CAPABILITIES,
    config,
    defaultConfigDirectory: "/opt/opencode-remote-platform/config",
    frpStatusMode: "server",
  })
}

export function createEmptyServerConfig(): AppConfig {
  return {
    mode: "server",
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
  }
}
