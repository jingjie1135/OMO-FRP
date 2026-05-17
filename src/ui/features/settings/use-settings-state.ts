import { useCallback, useEffect, useRef, useState } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { BackupSummary, SecurityCheck, Diagnostics, JobResult } from "../../../management-api/types"
import type { RuntimeInfo } from "../../../core/app-config/types"
import type { ActionError } from "../../app/action-runner"

export interface SettingsInitialData {
  runtimeInfo?: RuntimeInfo
  securityChecks?: SecurityCheck[]
  backupSummary?: BackupSummary
}

export interface SettingsState {
  runtimeInfo: RuntimeInfo | null
  securityChecks: SecurityCheck[]
  backupSummary: BackupSummary | null
  isLoading: boolean
  errorMessage: ActionError | null
  refresh(): Promise<void>
  runManualBackup(): Promise<void>
  cleanupOldBackups(): Promise<void>
  exportDiagnostics(): Promise<void>
}

export function useSettingsState(client: ManagementClient, initialData: SettingsInitialData = {}): SettingsState {
  const hasCompleteInitialData = Boolean(initialData.runtimeInfo && initialData.securityChecks && initialData.backupSummary)
  const [runtimeInfo, setRuntimeInfo] = useState<RuntimeInfo | null>(initialData.runtimeInfo ?? null)
  const [securityChecks, setSecurityChecks] = useState<SecurityCheck[]>(initialData.securityChecks ?? [])
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(initialData.backupSummary ?? null)
  const [isLoading, setIsLoading] = useState(!initialData.runtimeInfo)
  const [errorMessage, setErrorMessage] = useState<ActionError | null>(null)
  const mounted = useRef(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const info = await client.getRuntimeInfo()
      const [checks, summary] = await Promise.all([
        client.getSecurityChecks?.() ?? Promise.resolve(createFallbackSecurityChecks(info)),
        client.getBackupSummary?.() ?? Promise.resolve(createFallbackBackupSummary(info)),
      ])
      if (!mounted.current) return
      setRuntimeInfo(info)
      setSecurityChecks(checks)
      setBackupSummary(summary)
      setErrorMessage(null)
    } catch (error: unknown) {
      if (!mounted.current) return
      setErrorMessage(normalizeError(error))
    } finally {
      if (mounted.current) setIsLoading(false)
    }
  }, [client])

  useEffect(() => {
    mounted.current = true
    if (!hasCompleteInitialData) {
      void load()
    }
    return () => {
      mounted.current = false
    }
  }, [hasCompleteInitialData, load])

  const runManualBackup = async () => {
    try {
      if (!client.runManualBackup) {
        throw new Error("Manual backup is not supported by this runtime.")
      }
      const result = await client.runManualBackup()
      assertSucceededJob(result)
      await load()
    } catch (error: unknown) {
      setErrorMessage(normalizeError(error))
    }
  }

  const cleanupOldBackups = async () => {
    try {
      if (!client.cleanupOldBackups) {
        throw new Error("Backup cleanup is not supported by this runtime.")
      }
      const result = await client.cleanupOldBackups()
      assertSucceededJob(result)
      await load()
    } catch (error: unknown) {
      setErrorMessage(normalizeError(error))
    }
  }

  const exportDiagnostics = async () => {
    try {
      const diagnostics = client.getDiagnostics ? await client.getDiagnostics() : await createFallbackDiagnostics(client)
      const diagnosticsExport = await import("./diagnostics-export")
      diagnosticsExport.downloadDiagnostics(diagnostics)
    } catch (error: unknown) {
      setErrorMessage(normalizeError(error))
    }
  }

  return {
    runtimeInfo,
    securityChecks,
    backupSummary,
    isLoading,
    errorMessage,
    refresh: load,
    runManualBackup,
    cleanupOldBackups,
    exportDiagnostics,
  }
}

export function createFallbackBackupSummary(info: RuntimeInfo): BackupSummary {
  const backupDirectory = info.config.toolInstances.find((tool) => tool.configDirectory)?.configDirectory ?? "not reported"
  return {
    count: 0,
    backupDirectory,
    failureRecords: [],
    canManualBackup: false,
    canCleanup: false,
  }
}

export function createFallbackSecurityChecks(info: RuntimeInfo): SecurityCheck[] {
  const hasOpencodePasswordEndpoint = info.config.publicEndpoints.some((endpoint) => endpoint.authMode === "opencode-password" || endpoint.authMode === "both")
  const hasBasicOnlyEndpoint = info.config.publicEndpoints.some((endpoint) => endpoint.authMode === "basic-auth")
  const hasFrpTokenRef = Boolean(info.config.frpServer?.authTokenRef || info.config.frpClients.some((client) => client.authTokenRef))
  const cleartextSecretRisk = info.config.publicEndpoints.some((endpoint) => /password|token|secret|authorization/i.test(endpoint.domain))
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
      status: info.capabilities.canAccessLocalFilesystem ? "pass" : "warn",
      message: info.capabilities.canAccessLocalFilesystem ? "Runtime can inspect local backup files." : "Runtime cannot access local backup files.",
    },
  ]
}

async function createFallbackDiagnostics(client: ManagementClient): Promise<Diagnostics> {
  const [runtime, tools, endpoints, frp] = await Promise.all([
    client.getRuntimeInfo(),
    client.detectTools(),
    client.listEndpoints(),
    client.getFrpStatus(),
  ])

  const logGroups = await Promise.all(runtime.config.toolInstances.map((tool) => client.getToolLogs(tool.id).catch(() => [])))
  const diagnosticsExport = await import("./diagnostics-export")
  return {
    runtime,
    tools,
    endpoints,
    frp,
    jobs: [],
    redactedLogs: diagnosticsExport.redactLogLines(logGroups.flat()),
  }
}

function normalizeError(error: unknown): ActionError {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>
    const message = typeof err.message === "string" ? err.message : "Unknown error"
    const status = typeof err.status === "number" ? err.status : undefined
    const target = typeof err.target === "string" ? err.target : undefined
    const retryable = typeof err.retryable === "boolean" ? err.retryable : true
    return {
      message,
      target,
      status,
      needsReauth: status === 401 || status === 403,
      retryable,
    }
  }
  return {
    message: String(error),
    retryable: true,
  }
}

function assertSucceededJob(result: JobResult): void {
  if (result.status === "failed") {
    throw Object.assign(new Error(result.message), { target: result.jobId, retryable: true })
  }
}
