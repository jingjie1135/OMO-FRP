import type { ManagementClient } from "./client"
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
} from "./types"
import { validateEndpoint } from "../core/endpoints/endpoint-service"
import {
  findOhMyOpenAgentConfigPath,
  joinConfigPath,
  listOhMyOpenAgentPresetPaths,
} from "../core/oh-my-openagent/config-paths"
import { applyPresetToActiveConfig } from "../core/oh-my-openagent/preset-service"
import { readConfigDocument, saveConfigDocument } from "../core/oh-my-openagent/config-service"
import type {
  AppConfig,
  PublicEndpoint,
  RuntimeCapabilities,
  RuntimeInfo,
  ToolHostType,
  ToolInstance,
  ToolKind,
} from "../core/app-config/types"
import type { StorageAdapter } from "../core/storage/storage-adapter"
import { MemoryStorage } from "../core/storage/memory-storage"

export interface CreateLocalManagementRuntimeOptions {
  capabilities: RuntimeCapabilities
  defaultConfigDirectory: string
  frpStatusMode: FrpStatus["mode"]
  config?: AppConfig
  storage?: StorageAdapter
  now?: () => Date
}

interface LocalManagementState {
  config: AppConfig
  frpRunning: boolean
  logs: Map<string, LogLine[]>
}

export function createLocalManagementRuntime(options: CreateLocalManagementRuntimeOptions): ManagementClient {
  const storage = options.storage ?? new MemoryStorage()
  const now = options.now ?? (() => new Date())
  const state: LocalManagementState = {
    config: cloneValue(options.config ?? createEmptyConfig(options.capabilities.mode)),
    frpRunning: false,
    logs: new Map<string, LogLine[]>(),
  }

  return {
    async getRuntimeInfo(): Promise<RuntimeInfo> {
      return { capabilities: options.capabilities, config: cloneValue(state.config) }
    },

    async detectTools(): Promise<ToolDetection[]> {
      return state.config.toolInstances.map((tool) => ({
        kind: tool.kind,
        displayName: tool.displayName,
        detected: tool.installState !== "missing",
        binaryPath: tool.binaryPath,
        configDirectory: tool.configDirectory,
        version: tool.status === "running" ? "running" : undefined,
      }))
    },

    async listToolInstances(): Promise<ToolInstance[]> {
      return cloneValue(state.config.toolInstances)
    },

    async installTool(request: InstallToolRequest): Promise<JobResult> {
      const existing = state.config.toolInstances.find((tool) => tool.kind === request.kind)
      if (existing) {
        existing.installState = existing.installState === "configured" ? "configured" : "installed"
        existing.binaryPath = existing.binaryPath ?? request.kind
        appendLog(state, now, existing.id, `${existing.displayName} install requested.`)
        return createJobResult("install", existing.id, "succeeded", `${existing.displayName} is ready to configure.`)
      }

      const instance = createManagedTool(request.kind, options.capabilities.mode, options.defaultConfigDirectory)
      state.config.toolInstances.push(instance)
      appendLog(state, now, instance.id, `${instance.displayName} install requested.`)
      return createJobResult("install", instance.id, "succeeded", `${instance.displayName} has been added to this runtime.`)
    },

    async startTool(instanceId: string): Promise<JobResult> {
      const tool = state.config.toolInstances.find((item) => item.id === instanceId)
      if (!tool) {
        return createJobResult("start", instanceId, "failed", `Unknown tool instance: ${instanceId}`)
      }

      tool.status = "running"
      if (tool.installState === "missing") {
        tool.installState = "installed"
      }
      tool.currentPort = tool.currentPort ?? tool.defaultPort
      appendLog(state, now, tool.id, `${tool.displayName} started on port ${tool.currentPort}.`)
      return createJobResult("start", tool.id, "succeeded", `${tool.displayName} is running.`)
    },

    async stopTool(instanceId: string): Promise<JobResult> {
      const tool = state.config.toolInstances.find((item) => item.id === instanceId)
      if (!tool) {
        return createJobResult("stop", instanceId, "failed", `Unknown tool instance: ${instanceId}`)
      }

      tool.status = "stopped"
      appendLog(state, now, tool.id, `${tool.displayName} stopped.`)
      return createJobResult("stop", tool.id, "succeeded", `${tool.displayName} has been stopped.`)
    },

    async restartTool(instanceId: string): Promise<JobResult> {
      const stopResult = await this.stopTool(instanceId)
      if (stopResult.status === "failed") {
        return stopResult
      }
      return this.startTool(instanceId)
    },

    async getToolLogs(instanceId: string): Promise<LogLine[]> {
      return cloneValue(state.logs.get(instanceId) ?? [])
    },

    async readConfig(target: ConfigTarget): Promise<ConfigDocument> {
      const resolvedTarget = await resolveConfigTarget(state.config, storage, target)
      return readConfigDocument(storage, resolvedTarget)
    },

    async saveConfig(target: ConfigTarget, content: string): Promise<void> {
      const resolvedTarget = await resolveConfigTarget(state.config, storage, target)
      const configPath = requireTargetPath(resolvedTarget)
      if (await storage.exists(configPath)) {
        await storage.backup(configPath)
      }
      await saveConfigDocument(storage, resolvedTarget, content)
      markConfigSaved(state.config, resolvedTarget)
    },

    async listPresets(target: ConfigTarget): Promise<ConfigPreset[]> {
      if (target.kind !== "oh-my-openagent") {
        return []
      }

      const resolvedTarget = await resolveConfigTarget(state.config, storage, target)
      const configDirectory = getParentPath(requireTargetPath(resolvedTarget))
      const presetPaths = await listOhMyOpenAgentPresetPaths(storage, configDirectory)
      return presetPaths.map((path) => ({
        id: getPresetId(path),
        name: getPresetId(path),
        path,
        updatedAt: now().toISOString(),
      }))
    },

    async applyPreset(target: ConfigTarget, presetId: string): Promise<void> {
      if (target.kind !== "oh-my-openagent") {
        return
      }

      const resolvedTarget = await resolveConfigTarget(state.config, storage, target)
      const configPath = requireTargetPath(resolvedTarget)
      const configDirectory = getParentPath(configPath)
      await applyPresetToActiveConfig(storage, {
        activePath: configPath,
        presetPath: joinConfigPath(configDirectory, `oh-my-openagent.preset-${presetId}.json`),
        timestamp: createTimestamp(now),
      })
      markConfigSaved(state.config, resolvedTarget)
    },

    async listBackups(target: ConfigTarget): Promise<ConfigBackup[]> {
      const resolvedTarget = await resolveConfigTarget(state.config, storage, target)
      const configPath = requireTargetPath(resolvedTarget)
      const configDirectory = getParentPath(configPath)
      const backups = await storage.list(configDirectory)

      return backups
        .filter((path) => path.startsWith(`${configPath}.`) && path.endsWith(".backup"))
        .sort()
        .map((path) => ({
          id: path.slice(`${configPath}.`.length, -".backup".length),
          target: resolvedTarget,
          path,
          createdAt: path.slice(`${configPath}.`.length, -".backup".length),
        }))
    },

    async restoreBackup(target: ConfigTarget, backupId: string): Promise<void> {
      const resolvedTarget = await resolveConfigTarget(state.config, storage, target)
      const configPath = requireTargetPath(resolvedTarget)
      const backupPath = `${configPath}.${backupId}.backup`
      const backupContent = await storage.readText(backupPath)
      if (backupContent === null) {
        throw new Error(`Cannot restore missing backup: ${backupPath}`)
      }
      await saveConfigDocument(storage, resolvedTarget, backupContent)
      markConfigSaved(state.config, resolvedTarget)
    },

    async listEndpoints(): Promise<PublicEndpoint[]> {
      return cloneValue(state.config.publicEndpoints)
    },

    async saveEndpoint(endpoint: PublicEndpoint): Promise<void> {
      const existingIndex = state.config.publicEndpoints.findIndex((item) => item.id === endpoint.id)
      if (existingIndex >= 0) {
        state.config.publicEndpoints.splice(existingIndex, 1, cloneValue(endpoint))
        return
      }
      state.config.publicEndpoints.push(cloneValue(endpoint))
    },

    async enableEndpoint(id: string): Promise<JobResult> {
      const endpoint = state.config.publicEndpoints.find((item) => item.id === id)
      if (!endpoint) {
        return createJobResult("enable-endpoint", id, "failed", `Unknown endpoint: ${id}`)
      }

      const validation = validateEndpoint({ ...endpoint, status: "active" })
      if (!validation.ok) {
        return createJobResult("enable-endpoint", id, "failed", validation.issues.map((issue) => issue.message).join(" "))
      }

      endpoint.status = "active"
      return createJobResult("enable-endpoint", id, "succeeded", `${endpoint.name} is now active.`)
    },

    async disableEndpoint(id: string): Promise<JobResult> {
      const endpoint = state.config.publicEndpoints.find((item) => item.id === id)
      if (!endpoint) {
        return createJobResult("disable-endpoint", id, "failed", `Unknown endpoint: ${id}`)
      }

      endpoint.status = "disabled"
      return createJobResult("disable-endpoint", id, "succeeded", `${endpoint.name} has been disabled.`)
    },

    async getFrpStatus(): Promise<FrpStatus> {
      return {
        mode: options.frpStatusMode,
        running: state.frpRunning,
        message: buildFrpMessage(state, options.frpStatusMode),
      }
    },

    async saveFrpConfig(config: FrpConfigRequest): Promise<void> {
      if (isFrpClientConfig(config)) {
        const existingIndex = state.config.frpClients.findIndex((item) => item.endpointId === config.endpointId)
        if (existingIndex >= 0) {
          state.config.frpClients.splice(existingIndex, 1, cloneValue(config))
        } else {
          state.config.frpClients.push(cloneValue(config))
        }
        return
      }

      state.config.frpServer = cloneValue(config)
    },

    async startFrp(): Promise<JobResult> {
      if (options.frpStatusMode === "server" && !state.config.frpServer) {
        return createJobResult("start-frp", "frp", "failed", "FRP server configuration is missing.")
      }
      if (options.frpStatusMode === "client" && state.config.frpClients.length === 0) {
        return createJobResult("start-frp", "frp", "failed", "FRP client configuration is missing.")
      }

      state.frpRunning = true
      return createJobResult(
        "start-frp",
        "frp",
        "succeeded",
        options.frpStatusMode === "server" ? "FRP server is running." : "FRP client is running.",
      )
    },

    async stopFrp(): Promise<JobResult> {
      state.frpRunning = false
      return createJobResult(
        "stop-frp",
        "frp",
        "succeeded",
        options.frpStatusMode === "server" ? "FRP server has been stopped." : "FRP client has been stopped.",
      )
    },
  }
}

function createEmptyConfig(mode: RuntimeCapabilities["mode"]): AppConfig {
  return {
    mode,
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
  }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createManagedTool(kind: ToolKind, hostType: ToolHostType, configDirectory: string): ToolInstance {
  return {
    id: `${kind}-${hostType}`,
    kind,
    displayName: kind === "opencode" ? "OpenCode" : kind,
    hostType,
    installState: "installed",
    binaryPath: kind,
    configDirectory,
    defaultPort: 4096,
    currentPort: 4096,
    status: "stopped",
  }
}

function createJobResult(action: string, targetId: string, status: JobResult["status"], message: string): JobResult {
  return {
    jobId: `${action}:${targetId}`,
    status,
    message,
  }
}

function appendLog(state: LocalManagementState, now: () => Date, instanceId: string, message: string): void {
  const lines = state.logs.get(instanceId) ?? []
  lines.push({ timestamp: now().toISOString(), level: "info", message })
  state.logs.set(instanceId, lines)
}

async function resolveConfigTarget(config: AppConfig, storage: StorageAdapter, target: ConfigTarget): Promise<ConfigTarget> {
  if (target.path) {
    return target
  }

  const tool = config.toolInstances.find((item) => item.id === target.toolInstanceId)
  if (!tool?.configDirectory) {
    throw new Error(`Config target path is required for ${target.toolInstanceId}`)
  }

  if (target.kind === "opencode") {
    return { ...target, path: joinConfigPath(tool.configDirectory, "opencode.json") }
  }

  const pluginConfig = config.pluginConfigs.find((item) => item.toolInstanceId === target.toolInstanceId)
  if (pluginConfig?.configPath) {
    return { ...target, path: pluginConfig.configPath }
  }

  const detectedPath = await findOhMyOpenAgentConfigPath(storage, tool.configDirectory)
  return { ...target, path: detectedPath ?? joinConfigPath(tool.configDirectory, "oh-my-openagent.json") }
}

function requireTargetPath(target: ConfigTarget): string {
  if (!target.path) {
    throw new Error(`Config target path is required for ${target.toolInstanceId}`)
  }
  return target.path
}

function markConfigSaved(config: AppConfig, target: ConfigTarget): void {
  if (target.kind === "opencode") {
    const tool = config.toolInstances.find((item) => item.id === target.toolInstanceId)
    if (tool) {
      tool.installState = "configured"
    }
    return
  }

  const pluginConfig = config.pluginConfigs.find((item) => item.toolInstanceId === target.toolInstanceId)
  if (pluginConfig) {
    pluginConfig.status = "configured"
    return
  }

  config.pluginConfigs.push({
    toolInstanceId: target.toolInstanceId,
    plugin: "oh-my-openagent",
    configPath: requireTargetPath(target),
    status: "configured",
    presets: [],
  })
}

function getParentPath(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"))
  return separatorIndex >= 0 ? path.slice(0, separatorIndex) : "."
}

function getPresetId(path: string): string {
  const basename = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1)
  return basename.replace(/^oh-my-openagent\.preset-/, "").replace(/\.json$/, "")
}

function createTimestamp(now: () => Date): string {
  return now().toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z")
}

function isFrpClientConfig(config: FrpConfigRequest): config is AppConfig["frpClients"][number] {
  return "endpointId" in config
}

function buildFrpMessage(state: LocalManagementState, mode: FrpStatus["mode"]): string {
  if (mode === "server") {
    if (state.frpRunning) {
      return "FRP server is running."
    }
    return state.config.frpServer ? "FRP server is configured but stopped." : "FRP server is not configured yet."
  }

  if (mode === "client") {
    if (state.frpRunning) {
      return "frpc is connected."
    }
    return state.config.frpClients.length > 0 ? "frpc is configured but stopped." : "frpc is not configured yet."
  }

  return "FRP is unavailable in this runtime."
}
