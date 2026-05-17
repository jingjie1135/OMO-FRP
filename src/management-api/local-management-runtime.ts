import type { SettingsManagementClient } from "./client"
import type {
  ConfigBackup,
  ConfigDocument,
  ConfigPreset,
  ConfigTarget,
  CloudflareTunnelConfigRequest,
  CloudflareTunnelPlan,
  CloudflareTunnelStatus,
  CloudflareTunnelStep,
  CloudflareTunnelStepId,
  FrpConfigRequest,
  FrpStatus,
  InstallToolRequest,
  JobResult,
  LogLine,
  ManagementToolKind,
  ToolDetection,
  SecurityCheck,
  BackupSummary,
  Diagnostics,
} from "./types"

import { checkEndpointSafety, normalizeEndpointAddress } from "../core/endpoints/endpoint-service"
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
import { redactSensitiveText } from "../shared/redact-sensitive-text"

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
  cloudflareRunning: boolean
  cloudflareConfig?: CloudflareTunnelConfigRequest
  logs: Map<string, LogLine[]>
  backupFailureRecords: string[]
}

export function createLocalManagementRuntime(options: CreateLocalManagementRuntimeOptions): SettingsManagementClient {
  const storage = options.storage ?? new MemoryStorage()
  const now = options.now ?? (() => new Date())
  const state: LocalManagementState = {
    config: cloneValue(options.config ?? createEmptyConfig(options.capabilities.mode)),
    frpRunning: false,
    cloudflareRunning: false,
    logs: new Map<string, LogLine[]>(),
    backupFailureRecords: [],
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

    async validateConfig(target: ConfigTarget, content: string): Promise<import("./types").ConfigValidationResult> {
      if (!content.trim()) {
        return {
          valid: false,
          fieldErrors: [{ field: "content", message: "Content cannot be empty" }],
        }
      }

      if (target.kind === "oh-my-openagent") {
        try {
          JSON.parse(content)
        } catch (error) {
          return {
            valid: false,
            fieldErrors: [{ field: "content", message: error instanceof Error ? error.message : String(error) }],
          }
        }
      }

      return { valid: true, fieldErrors: [] }
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
      if (await storage.exists(configPath)) {
        await storage.backup(configPath)
      }
      await saveConfigDocument(storage, resolvedTarget, backupContent)
      markConfigSaved(state.config, resolvedTarget)
    },

    async listEndpoints(): Promise<PublicEndpoint[]> {
      return cloneValue(state.config.publicEndpoints)
    },

    async saveEndpoint(endpoint: PublicEndpoint): Promise<void> {
      const normalizedEndpoint = { ...normalizeEndpointAddress(endpoint), status: "disabled" as const }
      const existingIndex = state.config.publicEndpoints.findIndex((item) => item.id === endpoint.id)
      if (existingIndex >= 0) {
        state.config.publicEndpoints.splice(existingIndex, 1, cloneValue(normalizedEndpoint))
        return
      }
      state.config.publicEndpoints.push(cloneValue(normalizedEndpoint))
    },

    async enableEndpoint(id: string): Promise<JobResult> {
      const endpoint = state.config.publicEndpoints.find((item) => item.id === id)
      if (!endpoint) {
        return createJobResult("enable-endpoint", id, "failed", `Unknown endpoint: ${id}`)
      }

      const validation = checkEndpointSafety({ ...endpoint, status: "active" }, {
        capabilities: options.capabilities,
        toolInstances: state.config.toolInstances,
        endpoints: state.config.publicEndpoints,
      })
      if (!validation.ok) {
        return createJobResult("enable-endpoint", id, "failed", validation.issues.map((issue) => issue.message).join(" "))
      }

      const normalizedEndpoint = normalizeEndpointAddress(endpoint)
      endpoint.protocol = normalizedEndpoint.protocol
      endpoint.domain = normalizedEndpoint.domain
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

    async getCloudflareTunnelStatus(): Promise<CloudflareTunnelStatus> {
      const config = state.cloudflareConfig ?? createDefaultCloudflareConfig(state.config)
      return {
        mode: config.mode,
        running: state.cloudflareRunning,
        message: state.cloudflareRunning ? "Cloudflare Tunnel is running." : "Cloudflare Tunnel is configured but stopped.",
        publicUrl: buildCloudflarePublicUrl(config),
        currentStep: state.cloudflareRunning ? "verify_public_access" : "start_tunnel",
      }
    },

    async saveCloudflareTunnelConfig(config: CloudflareTunnelConfigRequest): Promise<void> {
      state.cloudflareConfig = cloneValue(config)
    },

    async createCloudflareTunnelPlan(config: CloudflareTunnelConfigRequest): Promise<CloudflareTunnelPlan> {
      return createCloudflarePlan(config, state.config.toolInstances)
    },

    async startCloudflareTunnel(config: CloudflareTunnelConfigRequest): Promise<JobResult> {
      const opencode = state.config.toolInstances.find((tool) => tool.kind === "opencode")
      if (opencode?.status !== "running") {
        return createJobResult("start-cloudflare", "cloudflare", "failed", "OpenCode must be running before cloudflared starts.")
      }
      const cloudflared = state.config.toolInstances.find((tool) => tool.kind === "cloudflared")
      if (!cloudflared || cloudflared.installState === "missing" || !cloudflared.binaryPath) {
        return createJobResult("start-cloudflare", "cloudflare", "failed", "cloudflared binary must be installed before start.")
      }
      state.cloudflareConfig = cloneValue(config)
      state.cloudflareRunning = true
      appendLog(state, now, cloudflared.id, `Cloudflare Tunnel started for ${buildCloudflareLocalUrl(config)}.`)
      return createJobResult("start-cloudflare", "cloudflare", "succeeded", "Cloudflare Tunnel is running.")
    },

    async stopCloudflareTunnel(): Promise<JobResult> {
      state.cloudflareRunning = false
      return createJobResult("stop-cloudflare", "cloudflare", "succeeded", "Cloudflare Tunnel has been stopped.")
    },

    async retryCloudflareTunnelStep(stepId: CloudflareTunnelStepId): Promise<JobResult> {
      return createJobResult("retry-cloudflare", stepId, "succeeded", `Cloudflare Tunnel step ${stepId} was retried.`)
    },

    async getSecurityChecks(): Promise<SecurityCheck[]> {
      return createSecurityChecks(state.config, options.capabilities)
    },

    async getBackupSummary(): Promise<BackupSummary> {
      return createBackupSummary(state.config, options.defaultConfigDirectory, storage, state.backupFailureRecords)
    },

    async runManualBackup(): Promise<JobResult> {
      const targets = await getConfiguredTargets(state.config, storage)
      if (targets.length === 0) {
        return createJobResult("manual-backup", "settings", "failed", "No configuration files are available for backup.")
      }

      const failures: string[] = []
      for (const target of targets) {
        try {
          await storage.backup(requireTargetPath(target))
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error))
        }
      }

      if (failures.length > 0) {
        state.backupFailureRecords.push(...failures)
        return createJobResult("manual-backup", "settings", "failed", failures.join("; "))
      }

      return createJobResult("manual-backup", "settings", "succeeded", `Created ${targets.length} configuration backup(s).`)
    },

    async cleanupOldBackups(): Promise<JobResult> {
      return createJobResult("cleanup-backups", "settings", "succeeded", "Backup cleanup is not needed for the local in-memory runtime.")
    },

    async getDiagnostics(): Promise<Diagnostics> {
      return redactDiagnostics({
        runtime: await this.getRuntimeInfo(),
        tools: await this.detectTools(),
        endpoints: await this.listEndpoints(),
        frp: await this.getFrpStatus(),
        jobs: [],
        redactedLogs: Array.from(state.logs.values()).flat().map((log) => ({ ...log, message: redactDiagnosticText(log.message) })),
      })
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

function createManagedTool(kind: ManagementToolKind, hostType: ToolHostType, configDirectory: string): ToolInstance {
  return {
    id: `${kind}-${hostType}`,
    kind: kind === "opencode" ? "opencode" : kind === "frpc" ? "frpc" : kind === "cloudflared" ? "cloudflared" : "future-tool",
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

function createSecurityChecks(config: AppConfig, capabilities: RuntimeCapabilities): SecurityCheck[] {
  const hasOpencodePasswordEndpoint = config.publicEndpoints.some((endpoint) => endpoint.authMode === "opencode-password" || endpoint.authMode === "both")
  const hasBasicOnlyEndpoint = config.publicEndpoints.some((endpoint) => endpoint.authMode === "basic-auth")
  const hasFrpTokenRef = Boolean(config.frpServer?.authTokenRef || config.frpClients.some((client) => client.authTokenRef))
  const cleartextSecretRisk = config.publicEndpoints.some((endpoint) => /password|token|secret|authorization/i.test(endpoint.domain))
  return [
    {
      id: "opencode-password",
      label: "OpenCode password",
      status: hasOpencodePasswordEndpoint ? "pass" : "warn",
      message: hasOpencodePasswordEndpoint ? "Public OpenCode routes require the OpenCode password." : "No public route currently reports OpenCode password protection.",
      fix: hasOpencodePasswordEndpoint ? undefined : "Use opencode-password or both authentication before enabling public access.",
    },
    {
      id: "endpoint-auth",
      label: "Endpoint auth",
      status: hasBasicOnlyEndpoint ? "warn" : "pass",
      message: hasBasicOnlyEndpoint ? "At least one endpoint uses only basic-auth." : "No basic-auth-only endpoint was reported.",
      fix: hasBasicOnlyEndpoint ? "Prefer both authentication layers for public endpoints." : undefined,
    },
    {
      id: "frp-token-ref",
      label: "FRP token ref",
      status: hasFrpTokenRef ? "pass" : "warn",
      message: hasFrpTokenRef ? "FRP configuration references a token by name." : "No FRP token reference is configured.",
      fix: hasFrpTokenRef ? undefined : "Store FRP secrets as references, not cleartext values.",
    },
    {
      id: "cleartext-secret-risk",
      label: "Cleartext secret risk",
      status: cleartextSecretRisk ? "fail" : "pass",
      message: cleartextSecretRisk ? "Endpoint metadata appears to contain secret-like text." : "Endpoint metadata does not expose obvious secret strings.",
      fix: cleartextSecretRisk ? "Move secrets to references or environment variables." : undefined,
    },
    {
      id: "log-redaction",
      label: "Log redaction",
      status: "pass",
      message: "Diagnostics export redacts logs before download.",
    },
    {
      id: "backup-availability",
      label: "Backup availability",
      status: capabilities.canAccessLocalFilesystem ? "pass" : "warn",
      message: capabilities.canAccessLocalFilesystem ? "Runtime can inspect local backup files." : "Runtime cannot access local backup files.",
    },
  ]
}

async function createBackupSummary(config: AppConfig, defaultConfigDirectory: string, storage: StorageAdapter, failureRecords: string[]): Promise<BackupSummary> {
  const targets = await getConfiguredTargets(config, storage)
  const backupPaths = (await Promise.all(targets.map(async (target) => {
    const configPath = requireTargetPath(target)
    const configDirectory = getParentPath(configPath)
    const paths = await storage.list(configDirectory)
    return paths.filter((path) => path.startsWith(`${configPath}.`) && path.endsWith(".backup"))
  }))).flat().sort()
  const lastBackupPath = backupPaths.at(-1)
  return {
    count: backupPaths.length,
    lastBackupTime: lastBackupPath ? lastBackupPath.slice(lastBackupPath.lastIndexOf(".", lastBackupPath.length - ".backup".length - 1) + 1, -".backup".length) : undefined,
    backupDirectory: targets[0]?.path ? getParentPath(targets[0].path) : defaultConfigDirectory,
    failureRecords: [...failureRecords],
    canManualBackup: targets.length > 0,
    canCleanup: false,
  }
}

async function getConfiguredTargets(config: AppConfig, storage: StorageAdapter): Promise<ConfigTarget[]> {
  const candidates = config.toolInstances.flatMap((tool): ConfigTarget[] => {
    const targets: ConfigTarget[] = []
    if (tool.configDirectory) {
      targets.push({ toolInstanceId: tool.id, kind: "opencode", path: joinConfigPath(tool.configDirectory, "opencode.json") })
    }
    const pluginConfig = config.pluginConfigs.find((plugin) => plugin.toolInstanceId === tool.id)
    if (pluginConfig?.configPath) {
      targets.push({ toolInstanceId: tool.id, kind: "oh-my-openagent", path: pluginConfig.configPath })
    }
    return targets
  })

  const existingTargets = await Promise.all(candidates.map(async (target) => ((target.path && await storage.exists(target.path)) ? target : null)))
  return existingTargets.filter((target): target is ConfigTarget => target !== null)
}

function redactDiagnosticText(value: string): string {
  return redactSensitiveText(value)
}

function redactDiagnostics(diagnostics: Diagnostics): Diagnostics {
  return redactValue(diagnostics)
}

function redactValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactDiagnosticText(value) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item)) as T
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, entryValue]) => {
      if (/password|token|secret|authorization/i.test(key) && entryValue !== undefined) {
        return [key, "[REDACTED]"]
      }
      return [key, redactValue(entryValue)]
    })
    return Object.fromEntries(entries) as T
  }

  return value
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

function createDefaultCloudflareConfig(config: AppConfig): CloudflareTunnelConfigRequest {
  const opencode = config.toolInstances.find((tool) => tool.kind === "opencode")
  return {
    mode: "quick",
    localHost: "127.0.0.1",
    localPort: opencode?.currentPort ?? opencode?.defaultPort ?? 4096,
  }
}

function createCloudflarePlan(config: CloudflareTunnelConfigRequest, tools: ToolInstance[]): CloudflareTunnelPlan {
  const cloudflared = tools.find((tool) => tool.kind === "cloudflared")
  const localUrl = buildCloudflareLocalUrl(config)
  const publicUrl = buildCloudflarePublicUrl(config)
  return {
    mode: config.mode,
    localUrl,
    publicUrl,
    tunnelName: config.mode === "named" ? config.tunnelName : undefined,
    hostname: config.mode === "named" ? config.hostname : undefined,
    dnsRoute: config.mode === "named" ? config.dnsRoute : undefined,
    commandSummary: buildCloudflareCommands(config),
    cloudflaredDetected: Boolean(cloudflared && cloudflared.installState !== "missing"),
    diagnostics: cloudflared && cloudflared.installState !== "missing" ? [] : [{
      code: "cloudflared-missing",
      severity: "error",
      message: "cloudflared was not found on PATH.",
      fix: "Install cloudflared before starting a Cloudflare Tunnel.",
    }],
    securityNotes: [
      "Never expose OpenCode without a strong OPENCODE_SERVER_PASSWORD.",
      "Quick tunnels are temporary; named tunnels should use a Cloudflare-managed hostname.",
    ],
    steps: config.mode === "named" ? createNamedCloudflareSteps() : [],
  }
}

function buildCloudflareCommands(config: CloudflareTunnelConfigRequest): string[] {
  if (config.mode === "quick") {
    return [`cloudflared tunnel --url ${buildCloudflareLocalUrl(config)}`]
  }
  const tunnelName = config.tunnelName ?? "opencode-local"
  const hostname = config.hostname ?? config.dnsRoute ?? "opencode.example.com"
  return [
    "cloudflared tunnel login",
    `cloudflared tunnel create ${tunnelName}`,
    `cloudflared tunnel route dns ${tunnelName} ${hostname}`,
    `cloudflared tunnel run --url ${buildCloudflareLocalUrl(config)} ${tunnelName}`,
  ]
}

function buildCloudflareLocalUrl(config: CloudflareTunnelConfigRequest): string {
  return `http://${config.localHost}:${config.localPort}`
}

function buildCloudflarePublicUrl(config: CloudflareTunnelConfigRequest): string {
  if (config.mode === "named" && config.hostname) {
    return `https://${config.hostname}`
  }
  return "https://<generated>.trycloudflare.com"
}

function createNamedCloudflareSteps(): CloudflareTunnelStep[] {
  return [
    { id: "login", label: "Login", status: "idle", retryable: true },
    { id: "create_tunnel", label: "Create tunnel", status: "idle", retryable: true },
    { id: "configure_dns", label: "Configure DNS", status: "idle", retryable: true },
    { id: "write_config", label: "Write config", status: "idle", retryable: true },
    { id: "start_tunnel", label: "Start tunnel", status: "idle", retryable: true },
    { id: "verify_public_access", label: "Verify public access", status: "idle", retryable: true },
  ]
}
