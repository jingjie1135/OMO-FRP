import type { SettingsManagementClient } from "../../management-api/client"
import type { CloudflareTunnelConfigRequest, CloudflareTunnelStepId, ConfigTarget, FrpConfigRequest, InstallToolRequest } from "../../management-api/types"

export interface ServerManagementClientOptions {
  baseUrl: string
  fetch: (input: string, init?: RequestInit) => Promise<Response>
  sessionToken?: string
}

export function createServerManagementClient(options: ServerManagementClientOptions): SettingsManagementClient {
  return {
    getRuntimeInfo(): Promise<ReturnType<SettingsManagementClient["getRuntimeInfo"]> extends Promise<infer T> ? T : never> {
      return getJson(options, "/api/runtime")
    },
    detectTools(): Promise<ReturnType<SettingsManagementClient["detectTools"]> extends Promise<infer T> ? T : never> {
      return getJson(options, "/api/system/detect")
    },
    listToolInstances(): Promise<ReturnType<SettingsManagementClient["listToolInstances"]> extends Promise<infer T> ? T : never> {
      return getJson(options, "/api/tools")
    },
    installTool(request: InstallToolRequest) {
      return postJson(options, "/api/tools/install", request)
    },
    startTool(instanceId: string) {
      return postJson(options, `/api/tools/${instanceId}/start`)
    },
    stopTool(instanceId: string) {
      return postJson(options, `/api/tools/${instanceId}/stop`)
    },
    restartTool(instanceId: string) {
      return postJson(options, `/api/tools/${instanceId}/restart`)
    },
    getToolLogs(instanceId: string) {
      return getJson(options, `/api/tools/${instanceId}/logs`)
    },
    readConfig(target: ConfigTarget) {
      return postJson(options, "/api/config/read", target)
    },
    validateConfig(target: ConfigTarget, content: string) {
      return postJson(options, "/api/config/validate", { target, content })
    },
    saveConfig(target: ConfigTarget, content: string) {
      return postVoid(options, "/api/config/save", { target, content })
    },
    listPresets(target: ConfigTarget) {
      return postJson(options, "/api/config/presets", target)
    },
    applyPreset(target: ConfigTarget, presetId: string) {
      return postVoid(options, "/api/config/presets/apply", { target, presetId })
    },
    listBackups(target: ConfigTarget) {
      return postJson(options, "/api/config/backups", target)
    },
    restoreBackup(target: ConfigTarget, backupId: string) {
      return postVoid(options, "/api/config/backups/restore", { target, backupId })
    },
    listEndpoints() {
      return getJson(options, "/api/endpoints")
    },
    saveEndpoint(endpoint) {
      return postVoid(options, "/api/endpoints", endpoint)
    },
    enableEndpoint(id: string) {
      return postJson(options, `/api/endpoints/${id}/enable`)
    },
    disableEndpoint(id: string) {
      return postJson(options, `/api/endpoints/${id}/disable`)
    },
    getFrpStatus() {
      return getJson(options, "/api/frp/status")
    },
    saveFrpConfig(config: FrpConfigRequest) {
      return postVoid(options, "/api/frp/config", config)
    },
    startFrp() {
      return postJson(options, "/api/frp/start")
    },
    stopFrp() {
      return postJson(options, "/api/frp/stop")
    },
    getCloudflareTunnelStatus() {
      return getJson(options, "/api/cloudflare-tunnel/status")
    },
    saveCloudflareTunnelConfig(config: CloudflareTunnelConfigRequest) {
      return postVoid(options, "/api/cloudflare-tunnel/config", config)
    },
    createCloudflareTunnelPlan(config: CloudflareTunnelConfigRequest) {
      return postJson(options, "/api/cloudflare-tunnel/plan", config)
    },
    startCloudflareTunnel(config: CloudflareTunnelConfigRequest) {
      return postJson(options, "/api/cloudflare-tunnel/start", config)
    },
    stopCloudflareTunnel() {
      return postJson(options, "/api/cloudflare-tunnel/stop")
    },
    retryCloudflareTunnelStep(stepId: CloudflareTunnelStepId) {
      return postJson(options, "/api/cloudflare-tunnel/retry-step", { stepId })
    },
    getSecurityChecks() {
      return getJson(options, "/api/settings/security-checks")
    },
    getBackupSummary() {
      return getJson(options, "/api/settings/backup-summary")
    },
    runManualBackup() {
      return postJson(options, "/api/settings/backups/manual")
    },
    cleanupOldBackups() {
      return postJson(options, "/api/settings/backups/cleanup")
    },
    getDiagnostics() {
      return getJson(options, "/api/settings/diagnostics")
    },
  }
}


async function getJson<T>(options: ServerManagementClientOptions, path: string): Promise<T> {
  const response = await options.fetch(`${options.baseUrl}${path}`, { headers: createHeaders(options) })
  if (!response.ok) {
    throw new Error(`Management API request failed: ${response.status} ${path}`)
  }
  return response.json() as Promise<T>
}

async function postJson<T>(options: ServerManagementClientOptions, path: string, body?: unknown): Promise<T> {
  const response = await options.fetch(`${options.baseUrl}${path}`, {
    method: "POST",
    headers: createHeaders(options, { "content-type": "application/json" }),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Management API request failed: ${response.status} ${path}`)
  }
  return response.json() as Promise<T>
}

async function postVoid(options: ServerManagementClientOptions, path: string, body?: unknown): Promise<void> {
  await postJson<unknown>(options, path, body)
}

function createHeaders(options: ServerManagementClientOptions, headers: Record<string, string> = {}): HeadersInit {
  const nextHeaders: Record<string, string> = {
    ...headers,
    "x-management-ui-request": "1",
  }

  if (!options.sessionToken) {
    return nextHeaders
  }

  return { ...nextHeaders, authorization: `Bearer ${options.sessionToken}` }
}
