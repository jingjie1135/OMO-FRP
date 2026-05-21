import { readdir } from "node:fs/promises"
import { join, relative, resolve } from "node:path"
import type { PublicEndpoint } from "../core/app-config/types"
import { SERVER_CAPABILITIES, type AppConfig, type RuntimeInfo } from "../core/app-config/types"
import { NodeStorage } from "../core/storage/node-storage"
import type { StorageAdapter } from "../core/storage/storage-adapter"
import type { RuntimeExecutor } from "../management-api/runtime-executor"
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
} from "../management-api/types"
import { createLocalManagementRuntime } from "../management-api/local-management-runtime"
import { appendJobRecord, readJobRecords } from "./job-store"
import { appendRuntimeLog, readRuntimeLogs } from "./log-store"
import { createServerRuntimePaths } from "./server-runtime-paths"
import type { ServerRuntimePaths } from "./server-runtime-paths"
import { createServerRuntimeExecutor } from "./server-runtime-executor"
import { loadServerAppConfig, saveServerAppConfig } from "./server-runtime-state"

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
  defaultConfigDirectory?: string
  storage?: StorageAdapter
  executor?: RuntimeExecutor
}

export interface CreatePersistedServerRuntimeAdapterOptions {
  executor?: RuntimeExecutor
}

export function createServerRuntimeAdapter(config: AppConfig = createEmptyServerConfig(), options: CreateServerRuntimeAdapterOptions = {}): ServerRuntimeAdapter {
  return createLocalManagementRuntime({
    capabilities: SERVER_CAPABILITIES,
    config,
    defaultConfigDirectory: options.defaultConfigDirectory ?? "/opt/opencode-remote-platform/config",
    frpStatusMode: "server",
    storage: options.storage,
    executor: options.executor,
  })
}

export async function createPersistedServerRuntimeAdapter(options: CreatePersistedServerRuntimeAdapterOptions = {}): Promise<ServerRuntimeAdapter> {
  const paths = createServerRuntimePaths()
  const executor = options.executor ?? createServerRuntimeExecutor()
  const config = await loadServerAppConfig(paths.appConfigPath)
  const adapter = createServerRuntimeAdapter(config, {
    defaultConfigDirectory: paths.configDirectory,
    storage: new NodeStorage(),
    executor,
  })
  return createDurableServerRuntimeAdapter(adapter, paths, executor)
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

function createDurableServerRuntimeAdapter(adapter: ServerRuntimeAdapter, paths: ServerRuntimePaths, executor: RuntimeExecutor): ServerRuntimeAdapter {
  async function persistConfig(): Promise<void> {
    const runtime = await adapter.getRuntimeInfo()
    await saveServerAppConfig(paths.appConfigPath, runtime.config)
  }

  async function recordJob(action: string, targetId: string, result: JobResult): Promise<JobResult> {
    const timestamp = new Date().toISOString()
    await appendJobRecord(paths.jobsPath, {
      ...result,
      action,
      targetId,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
    await appendRuntimeLog(createLogPath(paths, targetId), {
      timestamp,
      level: result.status === "failed" ? "error" : "info",
      message: result.message,
    })
    return result
  }

  async function withPersistedConfig<T>(operation: () => Promise<T>): Promise<T> {
    const result = await operation()
    await persistConfig()
    return result
  }

  return {
    async getRuntimeInfo() { return adapter.getRuntimeInfo() },
    async detectTools() { return adapter.detectTools() },
    async listToolInstances() { return adapter.listToolInstances() },
    async installTool(request) { return recordJob("install", request.kind, await withPersistedConfig(() => adapter.installTool(request))) },
    async startTool(instanceId) { return recordJob("start", instanceId, await adapter.startTool(instanceId)) },
    async stopTool(instanceId) { return recordJob("stop", instanceId, await adapter.stopTool(instanceId)) },
    async restartTool(instanceId) { return recordJob("restart", instanceId, await adapter.restartTool(instanceId)) },
    async getToolLogs(instanceId) {
      const [durableLogs, liveLogs] = await Promise.all([
        readRuntimeLogs(createLogPath(paths, instanceId)),
        executor.getToolLogs(instanceId),
      ])
      return [...durableLogs, ...liveLogs]
    },
    async readConfig(target) { return adapter.readConfig(constrainConfigTarget(paths, target)) },
    async validateConfig(target, content) { return adapter.validateConfig(constrainConfigTarget(paths, target), content) },
    async saveConfig(target, content) { await withPersistedConfig(() => adapter.saveConfig(constrainConfigTarget(paths, target), content)) },
    async listPresets(target) { return adapter.listPresets(constrainConfigTarget(paths, target)) },
    async applyPreset(target, presetId) { await withPersistedConfig(() => adapter.applyPreset(constrainConfigTarget(paths, target), presetId)) },
    async listBackups(target) { return adapter.listBackups(constrainConfigTarget(paths, target)) },
    async restoreBackup(target, backupId) { await withPersistedConfig(() => adapter.restoreBackup(constrainConfigTarget(paths, target), backupId)) },
    async listEndpoints() { return adapter.listEndpoints() },
    async saveEndpoint(endpoint) { await withPersistedConfig(() => adapter.saveEndpoint(endpoint)) },
    async enableEndpoint(id) { return recordJob("enable-endpoint", id, await failUntilServerEndpointProvisioningExists(adapter, id)) },
    async disableEndpoint(id) { return recordJob("disable-endpoint", id, await withPersistedConfig(() => adapter.disableEndpoint(id))) },
    async getFrpStatus() { return adapter.getFrpStatus() },
    async saveFrpConfig(config) { await withPersistedConfig(() => adapter.saveFrpConfig(config)) },
    async startFrp() { return recordJob("start-frp", "frp", await adapter.startFrp()) },
    async stopFrp() { return recordJob("stop-frp", "frp", await adapter.stopFrp()) },
    async getCloudflareTunnelStatus() { return adapter.getCloudflareTunnelStatus() },
    async saveCloudflareTunnelConfig(config) { await withPersistedConfig(() => adapter.saveCloudflareTunnelConfig(config)) },
    async createCloudflareTunnelPlan(config) { return adapter.createCloudflareTunnelPlan(config) },
    async startCloudflareTunnel(config) { return recordJob("start-cloudflare", "cloudflare", await adapter.startCloudflareTunnel(config)) },
    async stopCloudflareTunnel() { return recordJob("stop-cloudflare", "cloudflare", await adapter.stopCloudflareTunnel()) },
    async retryCloudflareTunnelStep(stepId) { return recordJob("retry-cloudflare", "cloudflare", await adapter.retryCloudflareTunnelStep(stepId)) },
    async getSecurityChecks() { return adapter.getSecurityChecks() },
    async getBackupSummary() { return adapter.getBackupSummary() },
    async runManualBackup() { return recordJob("manual-backup", "settings", await adapter.runManualBackup()) },
    async cleanupOldBackups() { return recordJob("cleanup-backups", "settings", await adapter.cleanupOldBackups()) },
    async getDiagnostics() {
      const diagnostics = await adapter.getDiagnostics()
      return {
        ...diagnostics,
        jobs: await readJobRecords(paths.jobsPath),
        redactedLogs: [...diagnostics.redactedLogs, ...await readAllRuntimeLogs(paths.logDirectory)],
      }
    },
  }
}

async function failUntilServerEndpointProvisioningExists(adapter: ServerRuntimeAdapter, id: string): Promise<JobResult> {
  const endpoint = (await adapter.listEndpoints()).find((item: PublicEndpoint) => item.id === id)
  if (!endpoint) {
    return { jobId: `enable-endpoint:${id}`, status: "failed", message: `Unknown endpoint: ${id}` }
  }
  return {
    jobId: `enable-endpoint:${id}`,
    status: "failed",
    message: `Server endpoint route provisioning is not connected yet. Configure Caddy/frp-panel route for ${endpoint.domain}, then retry.`,
  }
}

function constrainConfigTarget(paths: ServerRuntimePaths, target: ConfigTarget): ConfigTarget {
  if (!target.path) {
    return target
  }

  const root = resolve(paths.configDirectory)
  const resolvedPath = resolve(target.path)
  const relativePath = relative(root, resolvedPath)
  if (relativePath.startsWith("..") || relativePath.includes(":")) {
    throw new Error(`Config target path must stay under ${paths.configDirectory}`)
  }
  return { ...target, path: resolvedPath }
}

async function readAllRuntimeLogs(logDirectory: string): Promise<LogLine[]> {
  let entries: string[]
  try {
    entries = await readdir(logDirectory)
  } catch (error) {
    if (isMissingFileError(error)) {
      return []
    }
    throw error
  }

  const logs = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".log"))
      .map((entry) => readRuntimeLogs(join(logDirectory, entry))),
  )
  return logs.flat()
}

function createLogPath(paths: ServerRuntimePaths, targetId: string): string {
  return join(paths.logDirectory, `${targetId.replace(/[^a-z0-9._-]/gi, "-")}.log`)
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT")
}
