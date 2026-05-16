import { useState, useEffect, useCallback, useRef } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { JobResult } from "../../../management-api/types"
import type { ActionError, ActionStatus } from "../../app/action-runner"
import { ActionRunner } from "../../app/action-runner"
import type { PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { checkEndpointSafety, formatEndpointPublicAddress, isValidEndpointAddress } from "../../../core/endpoints/endpoint-service"

export interface EndpointSafetyCheck {
  ok: boolean
  issues: string[]
  suggestion: string
}

export interface EndpointDiagnostics {
  targetRunning: boolean
  localPort: number | null
  providerAvailable: boolean
  authComplete: boolean
  publicAddressGeneratable: boolean
  conflictFree: boolean
  recentError: string | null
  fixSuggestion: string
}

export interface EndpointsState {
  endpoints: PublicEndpoint[]
  runtimeInfo?: RuntimeInfo
  loading: boolean
  error?: string
  refresh(): Promise<void>
  saveEndpoint(endpoint: PublicEndpoint): Promise<void>
  enableEndpoint(id: string): Promise<void>
  disableEndpoint(id: string): Promise<void>
  checkSafety(endpoint: PublicEndpoint): EndpointSafetyCheck
  getDiagnostics(endpoint: PublicEndpoint): EndpointDiagnostics
  getActionStatus(key: string): ActionStatus
  getActionError(key: string): ActionError | undefined
}

export function useEndpointsState(client: ManagementClient, runner: ActionRunner): EndpointsState {
  const [endpoints, setEndpoints] = useState<PublicEndpoint[]>([])
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | undefined>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>()
  const [, setRunnerVersion] = useState(0)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    return runner.subscribe(() => {
      if (mounted.current) setRunnerVersion((version) => version + 1)
    })
  }, [runner])

  const refresh = useCallback(async () => {
    try {
      const [newEndpoints, info] = await Promise.all([
        client.listEndpoints(),
        client.getRuntimeInfo(),
      ])
      if (mounted.current) {
        setEndpoints(newEndpoints)
        setRuntimeInfo(info)
        setError(undefined)
      }
    } catch (error: unknown) {
      if (mounted.current) setError(getErrorMessage(error, "Failed to fetch endpoints"))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [client])

  useEffect(() => {
    refresh()
  }, [refresh])

  const saveEndpoint = useCallback(
    async (endpoint: PublicEndpoint) => {
      await runner.run(`save-endpoint-${endpoint.id || "new"}`, async () => {
        await client.saveEndpoint(endpoint)
        await refresh()
      })
    },
    [client, refresh, runner]
  )

  const checkSafety = useCallback(
    (endpoint: PublicEndpoint): EndpointSafetyCheck => {
      const activeEndpoint = { ...endpoint, status: "active" as const }

      if (!runtimeInfo) {
        return createSafetyResult(["Runtime info not loaded."])
      }

      const safety = checkEndpointSafety(activeEndpoint, {
        capabilities: runtimeInfo.capabilities,
        toolInstances: runtimeInfo.config.toolInstances,
        endpoints,
      })
      return createSafetyResult(safety.issues.map((issue) => issue.message))
    },
    [endpoints, runtimeInfo]
  )

  const getDiagnostics = useCallback((endpoint: PublicEndpoint): EndpointDiagnostics => {
    const targetTool = runtimeInfo?.config.toolInstances.find((tool) => tool.id === endpoint.targetToolInstanceId)
    const safety = checkSafety(endpoint)
    return {
      targetRunning: targetTool?.status === "running",
      localPort: targetTool?.currentPort ?? targetTool?.defaultPort ?? null,
      providerAvailable: runtimeInfo ? !checkEndpointSafety({ ...endpoint, status: "active" }, { capabilities: runtimeInfo.capabilities, toolInstances: runtimeInfo.config.toolInstances, endpoints }).issues.some((issue) => issue.path === "targetType") : false,
      authComplete: !safety.issues.some((issue) => issue.includes("auth") || issue.includes("password") || issue.includes("OpenCode password")),
      publicAddressGeneratable: isValidEndpointAddress(endpoint),
      conflictFree: !endpoints.some((item) => item.id !== endpoint.id && item.status === "active" && formatEndpointPublicAddress(item) === formatEndpointPublicAddress(endpoint)),
      recentError: endpoint.status === "error" ? safety.issues.join(" ") || "Endpoint is in error state." : null,
      fixSuggestion: safety.suggestion,
    }
  }, [checkSafety, endpoints, runtimeInfo])

  const enableEndpoint = useCallback(
    async (id: string) => {
      const endpoint = endpoints.find((e) => e.id === id)
      if (!endpoint) throw new Error("Endpoint not found")

      const safety = checkSafety({ ...endpoint, status: "active" })
      if (!safety.ok) {
        throw new Error(`Endpoint safety check failed: ${safety.suggestion}`)
      }

      await runner.run(`enable-endpoint-${id}`, async () => {
        ensureSuccessfulJob(await client.enableEndpoint(id))
        await refresh()
      })
    },
    [client, endpoints, checkSafety, refresh, runner]
  )

  const disableEndpoint = useCallback(
    async (id: string) => {
      await runner.run(`disable-endpoint-${id}`, async () => {
        ensureSuccessfulJob(await client.disableEndpoint(id))
        await refresh()
      })
    },
    [client, refresh, runner]
  )

  return {
    endpoints,
    runtimeInfo,
    loading,
    error,
    refresh,
    saveEndpoint,
    enableEndpoint,
    disableEndpoint,
    checkSafety,
    getDiagnostics,
    getActionStatus: (key) => runner.getState(key),
    getActionError: (key) => runner.getError(key),
  }
}

function createSafetyResult(issues: string[]): EndpointSafetyCheck {
  const normalizedIssues = issues.filter((issue, index) => issue.trim() !== "" && issues.indexOf(issue) === index)
  return {
    ok: normalizedIssues.length === 0,
    issues: normalizedIssues,
    suggestion: normalizedIssues[0] ?? "Endpoint is ready to enable.",
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string") return message
  }
  return fallback
}

function ensureSuccessfulJob(job: JobResult): void {
  if (job.status === "failed") {
    throw Object.assign(new Error(job.message), { target: job.jobId })
  }
}
