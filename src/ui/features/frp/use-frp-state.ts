import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { FrpConfigRequest, FrpFailureReason, FrpStatus, JobResult } from "../../../management-api/types"
import type { FrpClientConfig, FrpServerConfig, PublicEndpoint, RuntimeInfo, ToolInstance } from "../../../core/app-config/types"
import type { ActionError, ActionStatus } from "../../app/action-runner"
import { ActionRunner } from "../../app/action-runner"
import { redactSensitiveText } from "../../../shared/redact-sensitive-text"

export interface FrpValidationResult {
  ok: boolean
  issues: string[]
  suggestion: string
}

export interface FrpState {
  runtimeInfo?: RuntimeInfo
  status?: FrpStatus
  endpoints: PublicEndpoint[]
  serverConfig?: FrpServerConfig
  clientConfig?: FrpClientConfig
  loading: boolean
  error?: string
  refresh(): Promise<void>
  saveServerConfig(config: FrpServerConfig): Promise<void>
  saveClientConfig(config: FrpClientConfig): Promise<void>
  startFrp(): Promise<void>
  stopFrp(): Promise<void>
  validateServerConfig(config: FrpServerConfig): FrpValidationResult
  validateClientConfig(config: FrpClientConfig): FrpValidationResult
  getFailureGuidance(reason?: FrpFailureReason): string
  getActionStatus(key: string): ActionStatus
  getActionError(key: string): ActionError | undefined
}

export interface UseFrpStateInitialData {
  runtimeInfo?: RuntimeInfo
  status?: FrpStatus
  endpoints?: PublicEndpoint[]
}

export function useFrpState(client: ManagementClient, runner?: ActionRunner, initialData: UseFrpStateInitialData = {}): FrpState {
  const fallbackRunner = useMemo(() => new ActionRunner(), [])
  const actionRunner = runner ?? fallbackRunner
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | undefined>(initialData.runtimeInfo)
  const [status, setStatus] = useState<FrpStatus | undefined>(initialData.status)
  const [endpoints, setEndpoints] = useState<PublicEndpoint[]>(initialData.endpoints ?? [])
  const [loading, setLoading] = useState(!initialData.runtimeInfo || !initialData.status || !initialData.endpoints)
  const [error, setError] = useState<string | undefined>()
  const [, setRunnerVersion] = useState(0)
  const mounted = useRef(true)
  const hasCompleteInitialData = Boolean(initialData.runtimeInfo && initialData.status && initialData.endpoints)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    return actionRunner.subscribe(() => {
      if (mounted.current) setRunnerVersion((version) => version + 1)
    })
  }, [actionRunner])

  const refresh = useCallback(async () => {
    try {
      const [info, frpStatus, publicEndpoints] = await Promise.all([
        client.getRuntimeInfo(),
        client.getFrpStatus(),
        client.listEndpoints(),
      ])
      if (mounted.current) {
        setRuntimeInfo(info)
        setStatus(frpStatus)
        setEndpoints(publicEndpoints)
        setError(undefined)
      }
    } catch (error: unknown) {
      if (mounted.current) setError(redactSensitiveText(getErrorMessage(error, "Failed to fetch FRP state")))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [client])

  useEffect(() => {
    if (hasCompleteInitialData) return
    void refresh()
  }, [hasCompleteInitialData, refresh])

  const serverConfig = runtimeInfo?.config.frpServer
  const clientConfig = useMemo(
    () => runtimeInfo ? selectFrpClientConfig(runtimeInfo, endpoints) : undefined,
    [endpoints, runtimeInfo],
  )

  const validateServer = useCallback((config: FrpServerConfig) => validateFrpServerConfig(config), [])
  const validateClient = useCallback(
    (config: FrpClientConfig) => validateFrpClientStartConfig(config, runtimeInfo),
    [runtimeInfo],
  )

  const saveServerConfig = useCallback(async (config: FrpServerConfig) => {
    const validation = validateFrpServerConfig(config)
    if (!validation.ok) throw new Error(`FRP server config validation failed: ${validation.suggestion}`)

    await actionRunner.run("frp:save-server", async () => {
      await client.saveFrpConfig(config)
      await refresh()
    })
  }, [actionRunner, client, refresh])

  const saveClientConfig = useCallback(async (config: FrpClientConfig) => {
    const validation = validateFrpClientConfig(config)
    if (!validation.ok) throw new Error(`FRP client config validation failed: ${validation.suggestion}`)

    await actionRunner.run("frp:save-client", async () => {
      await client.saveFrpConfig(config)
      await refresh()
    })
  }, [actionRunner, client, refresh])

  const startFrp = useCallback(async () => {
    const currentMode = status?.mode ?? runtimeInfo?.capabilities.mode
    if (currentMode === "server") {
      const validation = serverConfig ? validateFrpServerConfig(serverConfig) : createValidationResult(["FRP server configuration is missing."])
      if (!validation.ok) throw new Error(`FRP server start blocked: ${validation.suggestion}`)
    }
    if (currentMode === "client") {
      const validation = clientConfig ? validateFrpClientStartConfig(clientConfig, runtimeInfo) : createValidationResult(["FRP client configuration is missing."])
      if (!validation.ok) throw new Error(`FRP client start blocked: ${validation.suggestion}`)
    }

    await actionRunner.run("frp:start", async () => {
      const job = await client.startFrp()
      ensureSuccessfulJob(job, status?.failureReason)
      await refresh()
    })
  }, [actionRunner, client, clientConfig, refresh, runtimeInfo, serverConfig, status])

  const stopFrp = useCallback(async () => {
    await actionRunner.run("frp:stop", async () => {
      const job = await client.stopFrp()
      ensureSuccessfulJob(job, status?.failureReason)
      await refresh()
    })
  }, [actionRunner, client, refresh, status])

  return {
    runtimeInfo,
    status,
    endpoints,
    serverConfig,
    clientConfig,
    loading,
    error,
    refresh,
    saveServerConfig,
    saveClientConfig,
    startFrp,
    stopFrp,
    validateServerConfig: validateServer,
    validateClientConfig: validateClient,
    getFailureGuidance: getFrpFailureGuidance,
    getActionStatus: (key) => actionRunner.getState(key),
    getActionError: (key) => actionRunner.getError(key),
  }
}

export function validateFrpServerConfig(config: FrpServerConfig): FrpValidationResult {
  const issues: string[] = []
  if (!isHttpUrl(config.panelUrl)) issues.push("Panel URL must be a valid URL.")
  if (!config.rpcUrl.trim()) {
    issues.push("RPC URL is required.")
  } else if (!isHttpUrl(config.rpcUrl)) {
    issues.push("RPC URL must be a valid URL.")
  }
  if (!config.serverAddr.trim()) issues.push("Server address is required.")
  if (!isValidPort(config.bindPort)) issues.push("Bind port must be between 1 and 65535.")
  if (!config.authTokenRef.trim()) issues.push("Token reference is required.")
  if (isMaskedTokenPlaceholder(config.authTokenRef)) issues.push("Replace the masked FRP token placeholder before saving.")
  if (config.authTokenRef.trim() && !isMaskedTokenPlaceholder(config.authTokenRef) && !isTokenReferenceName(config.authTokenRef)) {
    issues.push("Token reference must use an environment-style name such as FRP_TOKEN.")
  }
  return createValidationResult(issues)
}

export function validateFrpClientConfig(config: FrpClientConfig, runtimeInfo?: RuntimeInfo): FrpValidationResult {
  const issues: string[] = []
  if (!config.serverAddr.trim()) issues.push("Server address is required.")
  if (!isValidPort(config.serverPort)) issues.push("Server port must be between 1 and 65535.")
  if (!config.authTokenRef.trim()) issues.push("Token reference is required.")
  if (isMaskedTokenPlaceholder(config.authTokenRef)) issues.push("Replace the masked FRP token placeholder before saving.")
  if (config.authTokenRef.trim() && !isMaskedTokenPlaceholder(config.authTokenRef) && !isTokenReferenceName(config.authTokenRef)) {
    issues.push("Token reference must use an environment-style name such as FRP_TOKEN.")
  }
  if (!isValidPort(config.localPort)) issues.push("Local port must be between 1 and 65535.")
  if (!/^[-._a-zA-Z0-9]+$/.test(config.proxyName.trim())) {
    issues.push("Proxy name can contain only letters, numbers, dots, underscores, and hyphens.")
  }
  if (config.subdomain && !/^[-a-zA-Z0-9]+$/.test(config.subdomain)) {
    issues.push("Subdomain can contain only letters, numbers, and hyphens.")
  }

  return createValidationResult(issues)
}

export function validateFrpClientStartConfig(config: FrpClientConfig, runtimeInfo?: RuntimeInfo): FrpValidationResult {
  const draftValidation = validateFrpClientConfig(config)
  const issues = [...draftValidation.issues]

  if (runtimeInfo) {
    const opencode = findTool(runtimeInfo, "opencode")
    if (opencode?.status !== "running") issues.push("OpenCode must be running before frpc starts.")
    if (!opencodePortReachable(opencode, config.localPort)) issues.push("Local OpenCode port must match a reachable configured port.")
    const frpc = findTool(runtimeInfo, "frpc")
    if (!frpc || frpc.installState === "missing" || !frpc.binaryPath) issues.push("frpc binary must be installed before start.")
  }

  return createValidationResult(issues)
}

export function maskFrpTokenRef(tokenRef: string | undefined): string {
  const value = tokenRef?.trim()
  if (!value) return "missing"
  if (isMaskedTokenPlaceholder(value)) return "masked placeholder"
  if (!isTokenReferenceName(value)) return "configured secret (masked)"
  return `${value} (masked)`
}

export function getFrpFailureGuidance(reason: FrpFailureReason | undefined): string {
  switch (reason) {
    case "auth_failed":
      return "Authentication failed. Verify the server and client use the same token reference and rotate the secret if needed."
    case "api_unreachable":
      return "FRP panel API is unreachable. Check the panel URL, firewall rules, and service health."
    case "rpc_unreachable":
      return "FRP RPC endpoint is unreachable. Check the RPC URL, bind port, and network route."
    case "proxy_not_ready":
      return "The FRP proxy is not ready. Confirm the proxy name, public route, and remote port are available."
    case "local_service_unreachable":
      return "The local OpenCode service is unreachable. Start OpenCode and verify the configured local port."
    case "client_not_ready":
      return "The desktop frpc client is not ready. Check the frpc binary, saved config, and client logs."
    case "timeout":
      return "The FRP operation timed out. Retry after checking network latency and service startup logs."
    case "unknown":
    default:
      return "FRP reported an unknown failure. Review the latest status message and logs before retrying."
  }
}

export function buildGeneratedFrpcConfig(config: FrpClientConfig): string {
  const lines = [
    "serverAddr = \"" + config.serverAddr + "\"",
    `serverPort = ${config.serverPort}`,
    "auth.method = \"token\"",
    "token = \"${" + formatFrpTokenReference(config.authTokenRef) + "}\"",
    "",
    "[[proxies]]",
    "name = \"" + config.proxyName + "\"",
    "type = \"http\"",
    "localIP = \"" + config.localHost + "\"",
    `localPort = ${config.localPort}`,
  ]
  if (config.subdomain) lines.push("subdomain = \"" + config.subdomain + "\"")
  if (config.customDomain) lines.push("customDomains = [\"" + config.customDomain + "\"]")
  if (config.remotePort) lines.push(`remotePort = ${config.remotePort}`)
  return lines.join("\n")
}

export function createDefaultServerConfig(): FrpServerConfig {
  return {
    enabled: false,
    panelUrl: "",
    rpcUrl: "",
    serverAddr: "",
    bindPort: 7000,
    authTokenRef: "",
    dashboardEnabled: false,
  }
}

export function createDefaultClientConfig(endpoint?: PublicEndpoint, runtimeInfo?: RuntimeInfo): FrpClientConfig {
  const opencode = runtimeInfo ? findTool(runtimeInfo, "opencode") : undefined
  return {
    endpointId: endpoint?.id ?? "desktop-frp",
    serverAddr: "",
    serverPort: 7000,
    authTokenRef: "",
    localHost: "127.0.0.1",
    localPort: opencode?.currentPort ?? opencode?.defaultPort ?? 4096,
    proxyName: endpoint?.id ?? "desktop-opencode",
    subdomain: endpoint?.domain.split(".")[0],
    transport: "tcp",
  }
}

function selectFrpClientConfig(runtimeInfo: RuntimeInfo, endpoints: PublicEndpoint[]): FrpClientConfig {
  const configured = runtimeInfo.config.frpClients[0]
  if (configured) return configured
  return createDefaultClientConfig(endpoints.find((endpoint) => endpoint.targetType === "desktop-frp"), runtimeInfo)
}

function createValidationResult(issues: string[]): FrpValidationResult {
  const uniqueIssues = issues.filter((issue, index) => issue.trim() !== "" && issues.indexOf(issue) === index)
  return {
    ok: uniqueIssues.length === 0,
    issues: uniqueIssues,
    suggestion: uniqueIssues[0] ?? "FRP configuration is ready.",
  }
}

function ensureSuccessfulJob(job: JobResult, failureReason?: FrpFailureReason): void {
  if (job.status === "failed") {
    throw Object.assign(new Error(`${job.message} ${getFrpFailureGuidance(failureReason)}`), { target: job.jobId })
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

function isMaskedTokenPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized === "••••••" || normalized === "******" || normalized.includes("masked")
}

function isTokenReferenceName(value: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(value.trim())
}

function formatFrpTokenReference(tokenRef: string): string {
  const value = tokenRef.trim()
  return isTokenReferenceName(value) ? value : "FRP_TOKEN"
}

function findTool(runtimeInfo: RuntimeInfo, kind: ToolInstance["kind"]): ToolInstance | undefined {
  return runtimeInfo.config.toolInstances.find((tool) => tool.kind === kind)
}

function opencodePortReachable(tool: ToolInstance | undefined, localPort: number): boolean {
  if (!tool || tool.status !== "running") return false
  return tool.currentPort === localPort || tool.defaultPort === localPort
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message
    if (typeof message === "string") return message
  }
  return fallback
}
