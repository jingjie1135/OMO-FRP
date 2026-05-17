import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type {
  CloudflareTunnelConfigRequest,
  CloudflareTunnelFailureReason,
  CloudflareTunnelPlan,
  CloudflareTunnelStatus,
  CloudflareTunnelStepId,
  JobResult,
} from "../../../management-api/types"
import type { PublicEndpoint, RuntimeInfo, ToolInstance } from "../../../core/app-config/types"
import type { ActionError, ActionStatus } from "../../app/action-runner"
import { ActionRunner } from "../../app/action-runner"

export interface CloudflareTunnelValidationResult {
  ok: boolean
  issues: string[]
  suggestion: string
}

export interface CloudflareTunnelState {
  runtimeInfo?: RuntimeInfo
  status?: CloudflareTunnelStatus
  config: CloudflareTunnelConfigRequest
  plan?: CloudflareTunnelPlan
  loading: boolean
  error?: string
  refresh(): Promise<void>
  saveConfig(config: CloudflareTunnelConfigRequest): Promise<void>
  startTunnel(): Promise<void>
  stopTunnel(): Promise<void>
  retryStep(stepId: CloudflareTunnelStepId): Promise<void>
  validateConfig(config: CloudflareTunnelConfigRequest): CloudflareTunnelValidationResult
  getFailureGuidance(reason?: CloudflareTunnelFailureReason): string
  getActionStatus(key: string): ActionStatus
  getActionError(key: string): ActionError | undefined
}

export interface UseCloudflareTunnelInitialData {
  runtimeInfo?: RuntimeInfo
  status?: CloudflareTunnelStatus
  plan?: CloudflareTunnelPlan
  config?: CloudflareTunnelConfigRequest
}

export function useCloudflareTunnelState(client: ManagementClient, runner?: ActionRunner, initialData: UseCloudflareTunnelInitialData = {}): CloudflareTunnelState {
  const fallbackRunner = useMemo(() => new ActionRunner(), [])
  const actionRunner = runner ?? fallbackRunner
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | undefined>(initialData.runtimeInfo)
  const [status, setStatus] = useState<CloudflareTunnelStatus | undefined>(initialData.status)
  const [config, setConfig] = useState<CloudflareTunnelConfigRequest>(initialData.config ?? createDefaultCloudflareTunnelConfig(initialData.runtimeInfo))
  const [plan, setPlan] = useState<CloudflareTunnelPlan | undefined>(initialData.plan)
  const [loading, setLoading] = useState(!initialData.runtimeInfo || !initialData.status || !initialData.plan)
  const [error, setError] = useState<string | undefined>()
  const [, setRunnerVersion] = useState(0)
  const mounted = useRef(true)
  const configRef = useRef(config)
  const hasCompleteInitialData = Boolean(initialData.runtimeInfo && initialData.status && initialData.plan)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    configRef.current = config
  }, [config])

  useEffect(() => {
    return actionRunner.subscribe(() => {
      if (mounted.current) setRunnerVersion((version) => version + 1)
    })
  }, [actionRunner])

  const loadState = useCallback(async (draft: CloudflareTunnelConfigRequest | undefined) => {
    const [info, tunnelStatus] = await Promise.all([
      client.getRuntimeInfo(),
      client.getCloudflareTunnelStatus(),
    ])
    const nextConfig = draft ?? configRef.current ?? createDefaultCloudflareTunnelConfig(info)
    const nextPlan = await client.createCloudflareTunnelPlan(nextConfig)
    return { info, tunnelStatus, nextConfig, nextPlan }
  }, [client])

  const refresh = useCallback(async () => {
    try {
      const { info, tunnelStatus, nextConfig, nextPlan } = await loadState(configRef.current)
      if (mounted.current) {
        setRuntimeInfo(info)
        setStatus(tunnelStatus)
        setConfig(nextConfig)
        setPlan(redactPlan(nextPlan))
        setError(undefined)
      }
    } catch (error: unknown) {
      if (mounted.current) setError(getErrorMessage(error, "Failed to fetch Cloudflare Tunnel state"))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [loadState])

  useEffect(() => {
    if (hasCompleteInitialData) return
    void refresh()
  }, [hasCompleteInitialData, refresh])

  const saveConfig = useCallback(async (draft: CloudflareTunnelConfigRequest) => {
    const validation = validateCloudflareTunnelConfig(draft)
    if (!validation.ok) throw new Error(`Cloudflare tunnel config validation failed: ${validation.suggestion}`)

    await actionRunner.run("cloudflare:save-config", async () => {
      await client.saveCloudflareTunnelConfig(draft)
      const nextPlan = await client.createCloudflareTunnelPlan(draft)
      if (mounted.current) {
        setConfig(draft)
        setPlan(redactPlan(nextPlan))
      }
    })
  }, [actionRunner, client])

  const startTunnel = useCallback(async () => {
    const validation = validateCloudflareTunnelStart(configRef.current, runtimeInfo)
    if (!validation.ok) throw new Error(`Cloudflare tunnel start blocked: ${validation.issues.join(" ")}`)

    await actionRunner.run("cloudflare:start", async () => {
      const job = await client.startCloudflareTunnel(configRef.current)
      ensureSuccessfulJob(job, status?.failureReason)
      const nextStatus = await client.getCloudflareTunnelStatus()
      if (mounted.current) setStatus(nextStatus)
    })
  }, [actionRunner, client, runtimeInfo, status])

  const stopTunnel = useCallback(async () => {
    await actionRunner.run("cloudflare:stop", async () => {
      const job = await client.stopCloudflareTunnel()
      ensureSuccessfulJob(job, status?.failureReason)
      const nextStatus = await client.getCloudflareTunnelStatus()
      if (mounted.current) setStatus(nextStatus)
    })
  }, [actionRunner, client, status])

  const retryStep = useCallback(async (stepId: CloudflareTunnelStepId) => {
    await actionRunner.run(`cloudflare:retry:${stepId}`, async () => {
      const job = await client.retryCloudflareTunnelStep(stepId)
      ensureSuccessfulJob(job, status?.failureReason)
      const nextStatus = await client.getCloudflareTunnelStatus()
      if (mounted.current) setStatus(nextStatus)
    })
  }, [actionRunner, client, status])

  return {
    runtimeInfo,
    status,
    config,
    plan,
    loading,
    error,
    refresh,
    saveConfig,
    startTunnel,
    stopTunnel,
    retryStep,
    validateConfig: validateCloudflareTunnelConfig,
    getFailureGuidance: getCloudflareFailureGuidance,
    getActionStatus: (key) => actionRunner.getState(key),
    getActionError: (key) => actionRunner.getError(key),
  }
}

export function createDefaultCloudflareTunnelConfig(runtimeInfo?: RuntimeInfo, _endpoint?: PublicEndpoint): CloudflareTunnelConfigRequest {
  const opencode = runtimeInfo ? findTool(runtimeInfo, "opencode") : undefined
  return {
    mode: "quick",
    localHost: "127.0.0.1",
    localPort: opencode?.currentPort ?? opencode?.defaultPort ?? 4096,
  }
}

export function validateCloudflareTunnelConfig(config: CloudflareTunnelConfigRequest): CloudflareTunnelValidationResult {
  const issues: string[] = []
  if (!isValidHost(config.localHost)) issues.push("Local host is required.")
  if (!isValidPort(config.localPort)) issues.push("Local port must be between 1 and 65535.")
  if (config.mode === "named") {
    if (!config.hostname || !isValidHostname(config.hostname)) issues.push("Named tunnels require a valid hostname.")
    if (!config.tunnelName || !/^[-._a-zA-Z0-9]+$/.test(config.tunnelName.trim())) issues.push("Tunnel name can contain only letters, numbers, dots, underscores, and hyphens.")
    if (!config.dnsRoute || !isValidHostname(config.dnsRoute)) issues.push("DNS route is required for named tunnels.")
  }
  return createValidationResult(issues)
}

export function validateCloudflareTunnelStart(config: CloudflareTunnelConfigRequest, runtimeInfo?: RuntimeInfo): CloudflareTunnelValidationResult {
  const issues = [...validateCloudflareTunnelConfig(config).issues]
  if (runtimeInfo) {
    const opencode = findTool(runtimeInfo, "opencode")
    if (opencode?.status !== "running") issues.push("OpenCode must be running before cloudflared starts.")
    if (!opencodePortReachable(opencode, config.localPort)) issues.push("Local OpenCode port must match a reachable configured port.")
    const cloudflared = findTool(runtimeInfo, "cloudflared")
    if (!cloudflared || cloudflared.installState === "missing" || !cloudflared.binaryPath) issues.push("cloudflared binary must be installed before start.")
  }
  return createValidationResult(issues)
}

export function getCloudflareFailureGuidance(reason: CloudflareTunnelFailureReason | undefined): string {
  switch (reason) {
    case "cloudflared_missing":
      return "Install cloudflared and run detection again before starting a tunnel."
    case "opencode_not_running":
      return "Start OpenCode locally and verify the selected local port before exposing it."
    case "password_missing":
      return "Set a strong OPENCODE_SERVER_PASSWORD before exposing OpenCode through Cloudflare Tunnel."
    case "login_required":
      return "Run or retry Cloudflare login so cloudflared can create named tunnels for your account."
    case "tunnel_create_failed":
      return "Check the tunnel name, Cloudflare account access, and retry tunnel creation."
    case "dns_route_failed":
      return "DNS route setup failed. Check Cloudflare DNS permissions and that the hostname belongs to the account."
    case "config_write_failed":
      return "Writing the cloudflared config failed. Check filesystem permissions and config directory availability."
    case "public_access_failed":
      return "Public verification failed. Confirm DNS propagation, local service health, and password protection."
    case "timeout":
      return "The Cloudflare Tunnel operation timed out. Retry after checking cloudflared logs and network connectivity."
    case "unknown":
    default:
      return "Cloudflare Tunnel reported an unknown failure. Review the failed step, diagnostics, and logs before retrying."
  }
}

export function redactCloudflareTunnelText(value: string): string {
  return value
    .replace(/(--token\s+)([^\s]+)/gi, "$1<redacted>")
    .replace(/(Authorization:\s*Bearer\s+)([^\s]+)/gi, "$1<redacted>")
    .replace(/(OPENCODE_SERVER_PASSWORD\s*=\s*)([^\s]+)/gi, "$1<redacted>")
    .replace(/([?&](?:token|password|secret|authorization)=)([^&#\s]+)/gi, "$1<redacted>")
}

function redactPlan(plan: CloudflareTunnelPlan): CloudflareTunnelPlan {
  return {
    ...plan,
    commandSummary: plan.commandSummary.map(redactCloudflareTunnelText),
    diagnostics: plan.diagnostics.map((diagnostic) => ({
      ...diagnostic,
      message: redactCloudflareTunnelText(diagnostic.message),
      fix: redactCloudflareTunnelText(diagnostic.fix),
    })),
    securityNotes: plan.securityNotes.map(redactCloudflareTunnelText),
    steps: plan.steps.map((step) => ({ ...step, message: step.message ? redactCloudflareTunnelText(step.message) : undefined })),
  }
}

function createValidationResult(issues: string[]): CloudflareTunnelValidationResult {
  const uniqueIssues = issues.filter((issue, index) => issue.trim() !== "" && issues.indexOf(issue) === index)
  return {
    ok: uniqueIssues.length === 0,
    issues: uniqueIssues,
    suggestion: uniqueIssues[0] ?? "Cloudflare Tunnel configuration is ready.",
  }
}

function ensureSuccessfulJob(job: JobResult, failureReason?: CloudflareTunnelFailureReason): void {
  if (job.status === "failed") {
    throw Object.assign(new Error(`${job.message} ${getCloudflareFailureGuidance(failureReason)}`), { target: job.jobId })
  }
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535
}

function isValidHost(value: string): boolean {
  return value.trim().length > 0 && !/\s/.test(value)
}

function isValidHostname(value: string): boolean {
  const hostname = value.trim()
  if (!hostname.includes(".")) return false
  if (hostname.includes("_") || /\s/.test(hostname)) return false
  try {
    const parsed = new URL(`https://${hostname}`)
    return parsed.hostname === hostname.toLowerCase() || parsed.hostname === hostname
  } catch {
    return false
  }
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
