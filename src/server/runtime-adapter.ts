import { SERVER_CAPABILITIES, type AppConfig, type RuntimeInfo } from "../core/app-config/types"
import type {
  ConfigBackup,
  ConfigDocument,
  ConfigPreset,
  ConfigTarget,
  CloudflareTunnelConfigRequest,
  CloudflareTunnelPlan,
  CloudflareTunnelStatus,
  CloudflareTunnelStepId,
  ConfigValidationResult,
  FrpConfigRequest,
  FrpStatus,
  InstallToolRequest,
  JobResult,
  LogLine,
  ToolDetection,
  ToolInstance,
  SecurityCheck,
  BackupSummary,
  Diagnostics,
  DesktopTunnelDevice,
  DesktopTunnelProvisionRequest,
  DesktopTunnelProvisionResponse,
  DesktopTunnelHeartbeatRequest,
} from "../management-api/types"
import { createLocalManagementRuntime } from "../management-api/local-management-runtime"
import type { DesktopTunnelProvisioningServiceOptions } from "../core/desktop-tunnel/provisioning-service"

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
  validateConfig(target: ConfigTarget, content: string): Promise<ConfigValidationResult>
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
  listDesktopTunnelDevices(): Promise<DesktopTunnelDevice[]>
  provisionDesktopTunnel(request: DesktopTunnelProvisionRequest): Promise<DesktopTunnelProvisionResponse>
  sendDesktopTunnelHeartbeat(request: DesktopTunnelHeartbeatRequest): Promise<DesktopTunnelDevice>
  deleteDesktopTunnelDevice(deviceId: string): Promise<void>
  getCloudflareTunnelStatus(): Promise<CloudflareTunnelStatus>
  saveCloudflareTunnelConfig(config: CloudflareTunnelConfigRequest): Promise<void>
  createCloudflareTunnelPlan(config: CloudflareTunnelConfigRequest): Promise<CloudflareTunnelPlan>
  startCloudflareTunnel(config: CloudflareTunnelConfigRequest): Promise<JobResult>
  stopCloudflareTunnel(): Promise<JobResult>
  retryCloudflareTunnelStep(stepId: CloudflareTunnelStepId): Promise<JobResult>
  getSecurityChecks(): Promise<SecurityCheck[]>
  getBackupSummary(): Promise<BackupSummary>
  runManualBackup(): Promise<JobResult>
  cleanupOldBackups(): Promise<JobResult>
  getDiagnostics(): Promise<Diagnostics>
}


export interface CreateServerRuntimeAdapterOptions {
  config?: AppConfig
  desktopTunnelProvisioning?: DesktopTunnelProvisioningServiceOptions
}

export function createServerRuntimeAdapter(options: AppConfig | CreateServerRuntimeAdapterOptions = createEmptyServerConfig()): ServerRuntimeAdapter {
  const normalizedOptions = "mode" in options ? { config: options } : options
  return createLocalManagementRuntime({
    capabilities: SERVER_CAPABILITIES,
    config: normalizedOptions.config ?? createEmptyServerConfig(),
    defaultConfigDirectory: "/opt/opencode-remote-platform/config",
    frpStatusMode: "server",
    desktopTunnelProvisioning: normalizedOptions.desktopTunnelProvisioning,
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
