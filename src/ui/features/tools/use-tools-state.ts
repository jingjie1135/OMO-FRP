import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { InstallToolRequest, JobResult, LogLine, RuntimeInfo, ToolDetection, ToolInstance } from "../../../management-api/types"
import { redactSensitiveText } from "../../../shared/redact-sensitive-text"
import { ActionRunner, type ActionError, type ActionStatus } from "../../app/action-runner"

export interface ToolsState {
  instances: ToolInstance[]
  detections: ToolDetection[]
  logs: LogLine[]
  isLoading: boolean
  selectedInstanceId: string | null
  canInstallTools: boolean
  canManageToolProcesses: boolean
  detect(): Promise<ToolDetection[]>
  install(request: InstallToolRequest): Promise<JobResult>
  start(instanceId: string): Promise<JobResult>
  stop(instanceId: string): Promise<JobResult>
  restart(instanceId: string): Promise<JobResult>
  selectInstance(instanceId: string | null): void
  refreshLogs(): Promise<void>
  getActionStatus(key: string): ActionStatus
  getActionError(key: string): ActionError | undefined
}

export function useToolsState(client: ManagementClient): ToolsState {
  const [instances, setInstances] = useState<ToolInstance[]>([])
  const [detections, setDetections] = useState<ToolDetection[]>([])
  const [logs, setLogs] = useState<LogLine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(null)
  const [, setRunnerVersion] = useState(0)

  const runner = useMemo(() => new ActionRunner(), [])
  const mounted = useRef(true)
  const selectedInstanceIdRef = useRef<string | null>(null)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    return runner.subscribe(() => {
      if (mounted.current) {
        setRunnerVersion((value) => value + 1)
      }
    })
  }, [runner])

  useEffect(() => {
    selectedInstanceIdRef.current = selectedInstanceId
  }, [selectedInstanceId])

  const refreshRuntimeInfo = useCallback(async () => {
    const info = await runner.run("tools:runtime", () => client.getRuntimeInfo(), { isRefresh: true })
    if (mounted.current) setRuntimeInfo(info)
    return info
  }, [client, runner])

  const refreshInstances = useCallback(async () => {
    const data = await runner.run("tools:instances", () => client.listToolInstances(), { isRefresh: true })
    if (mounted.current) setInstances(data)
    return data
  }, [client, runner])

  const refreshLogsFor = useCallback(async (instanceId: string) => {
    const data = await runner.run(
      `logs:${instanceId}`,
      async () => {
        const lines = await client.getToolLogs(instanceId)
        return lines.map((line) => ({
          ...line,
          message: redactSensitiveText(line.message),
        }))
      },
      { isRefresh: true },
    )

    if (mounted.current && selectedInstanceIdRef.current === instanceId) setLogs(data)
    return data
  }, [client, runner])

  const refreshLogs = useCallback(async () => {
    const instanceId = selectedInstanceIdRef.current
    if (!instanceId) {
      if (mounted.current) setLogs([])
      return
    }

    await refreshLogsFor(instanceId)
  }, [refreshLogsFor])

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        await Promise.all([refreshRuntimeInfo(), refreshInstances()])
      } catch {
        // ActionRunner stores the readable initialization errors for the UI.
      } finally {
        if (mounted.current) setIsLoading(false)
      }
    }

    void init()
  }, [refreshInstances, refreshRuntimeInfo])

  useEffect(() => {
    void refreshLogs().catch(() => undefined)
  }, [refreshLogs])

  const runToolAction = useCallback(async (key: string, instanceId: string, action: () => Promise<JobResult>, options?: { refreshDetections?: boolean }) => {
    const result = await runner.run(key, async () => {
      try {
        const job = await action()
        if (job.status === "failed") {
          throw enhanceToolError(Object.assign(new Error(job.message), { target: key }))
        }
        return job
      } catch (error: unknown) {
        throw enhanceToolError(error)
      }
    })

    await refreshRuntimeInfo().catch(() => undefined)
    await refreshInstances().catch(() => undefined)
    if (options?.refreshDetections) {
      await runner.run("detect", () => client.detectTools(), { isRefresh: true }).then((data) => {
        if (mounted.current) setDetections(data)
      }).catch(() => undefined)
    }
    if (selectedInstanceIdRef.current === instanceId) await refreshLogsFor(instanceId).catch(() => undefined)

    return result
  }, [client, refreshInstances, refreshLogsFor, refreshRuntimeInfo, runner])

  const canInstallTools = runtimeInfo?.capabilities.canInstallServerServices ?? false
  const canManageToolProcesses = runtimeInfo?.capabilities.canManageLocalProcesses ?? false

  return {
    instances,
    detections,
    logs,
    isLoading,
    selectedInstanceId,
    canInstallTools,
    canManageToolProcesses,
    detect: async () => {
      return runner.run("detect", async () => {
        const data = await client.detectTools()
        if (mounted.current) setDetections(data)
        return data
      })
    },
    install: (request) => runToolAction("install", request.kind, () => client.installTool(request), { refreshDetections: true }),
    start: (instanceId) => runToolAction(`start:${instanceId}`, instanceId, () => client.startTool(instanceId)),
    stop: (instanceId) => runToolAction(`stop:${instanceId}`, instanceId, () => client.stopTool(instanceId)),
    restart: (instanceId) => runToolAction(`restart:${instanceId}`, instanceId, () => client.restartTool(instanceId)),
    selectInstance: (instanceId) => setSelectedInstanceId(instanceId),
    refreshLogs,
    getActionStatus: (key) => runner.getState(key),
    getActionError: (key) => runner.getError(key),
  }
}

function enhanceToolError(error: unknown): Error {
  const message = getErrorMessage(error)
  let enhancedMessage = message
  if (message.includes("address already in use") || message.includes("port occupied")) {
    enhancedMessage = `Check if the port is already occupied. (${message})`
  } else if (message.includes("password not configured")) {
    enhancedMessage = `Please configure a password in Settings. (${message})`
  }

  const metadata: { status?: number; statusCode?: number; target?: string } = {}
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>
    if (typeof record.status === "number") metadata.status = record.status
    if (typeof record.statusCode === "number") metadata.statusCode = record.statusCode
    if (typeof record.target === "string") metadata.target = record.target
  }

  return Object.assign(new Error(enhancedMessage), metadata)
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message
    if (typeof message === "string") return message
  }
  return "Unknown error"
}
