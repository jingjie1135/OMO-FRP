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
  PublicEndpoint,
  RuntimeInfo,
  ToolDetection,
  ToolInstance,
  SecurityCheck,
  BackupSummary,
  Diagnostics,
  DesktopTunnelDevice,
  DesktopTunnelProvisionRequest,
  DesktopTunnelProvisionResponse,
  DesktopTunnelHeartbeatRequest,
} from "./types"

export interface ManagementClient {
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

  listEndpoints(): Promise<PublicEndpoint[]>
  saveEndpoint(endpoint: PublicEndpoint): Promise<void>
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

  getSecurityChecks?(): Promise<SecurityCheck[]>
  getBackupSummary?(): Promise<BackupSummary>
  runManualBackup?(): Promise<JobResult>
  cleanupOldBackups?(): Promise<JobResult>
  getDiagnostics?(): Promise<Diagnostics>
}

export interface SettingsManagementClient extends ManagementClient {
  getSecurityChecks(): Promise<SecurityCheck[]>
  getBackupSummary(): Promise<BackupSummary>
  runManualBackup(): Promise<JobResult>
  cleanupOldBackups(): Promise<JobResult>
  getDiagnostics(): Promise<Diagnostics>
}
