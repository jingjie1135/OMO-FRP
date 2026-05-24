import { afterEach, describe, expect, it } from "bun:test"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../../management-api/client"
import { useSettingsState } from "./use-settings-state"
import type { BackupSummary, SecurityCheck, Diagnostics, JobResult, RuntimeInfo, FrpStatus } from "../../../management-api/types"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

interface SettingsMockClient extends ManagementClient {
  setManualBackupResult(result: JobResult): void
  setCleanupResult(result: JobResult): void
}

const runtimeInfo: RuntimeInfo = {
  capabilities: {
    mode: "server",
    canManageFrpServer: true,
    canManageFrpClient: false,
    canInstallServerServices: true,
    canAccessLocalFilesystem: true,
    canManageSystemd: true,
    canManageLocalProcesses: true,
    canManageCloudflareTunnel: true,
  },
  config: {
    mode: "server",
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
  },
}

const frpStatus: FrpStatus = { mode: "server", running: false, message: "FRP server stopped." }

function createMockClient(): SettingsMockClient {
  let manualBackupResult: JobResult = { jobId: "manual-backup", status: "succeeded", message: "ok" }
  let cleanupResult: JobResult = { jobId: "cleanup-backups", status: "succeeded", message: "ok" }
  return {
    getRuntimeInfo: async () => runtimeInfo,
    getSecurityChecks: async () => [{ id: "test", label: "Test", status: "pass", message: "OK" } as SecurityCheck],
    getBackupSummary: async () => ({ count: 1, backupDirectory: "/backups", failureRecords: [], canManualBackup: true, canCleanup: true } as BackupSummary),
    getDiagnostics: async (): Promise<Diagnostics> => ({ runtime: runtimeInfo, tools: [], endpoints: [], frp: frpStatus, jobs: [], redactedLogs: [] }),
    runManualBackup: async () => manualBackupResult,
    cleanupOldBackups: async () => cleanupResult,
    detectTools: async () => [],
    listToolInstances: async () => [],
    installTool: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    startTool: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    stopTool: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    restartTool: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    getToolLogs: async () => [],
    readConfig: async () => ({ target: { toolInstanceId: "1", kind: "opencode" }, content: "" }),
    validateConfig: async () => ({ valid: true, fieldErrors: [] }),
    saveConfig: async () => {},
    listPresets: async () => [],
    applyPreset: async () => {},
    listBackups: async () => [],
    restoreBackup: async () => {},
    listEndpoints: async () => [],
    saveEndpoint: async () => {},
    enableEndpoint: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    disableEndpoint: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    getFrpStatus: async () => frpStatus,
    saveFrpConfig: async () => {},
    startFrp: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    stopFrp: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    getCloudflareTunnelStatus: async () => ({ mode: "quick", running: false, message: "" }),
    saveCloudflareTunnelConfig: async () => {},
    createCloudflareTunnelPlan: async () => ({ mode: "quick", localUrl: "", commandSummary: [], cloudflaredDetected: true, diagnostics: [], securityNotes: [], steps: [] }),
    startCloudflareTunnel: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    stopCloudflareTunnel: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    retryCloudflareTunnelStep: async () => ({ jobId: "1", status: "succeeded", message: "ok" }),
    setManualBackupResult(result: typeof manualBackupResult) {
      manualBackupResult = result
    },
    setCleanupResult(result: typeof cleanupResult) {
      cleanupResult = result
    },
  }
}

async function renderProbe(client: ManagementClient) {
  const container = document.createElement("div")
  document.body.append(container)
  const snapshots: string[] = []
  let latestState: ReturnType<typeof useSettingsState> | undefined

  function Probe() {
    const state = useSettingsState(client)
    latestState = state
    snapshots.push(
      JSON.stringify({
        loading: state.isLoading,
        hasRuntimeInfo: !!state.runtimeInfo,
        securityChecksCount: state.securityChecks.length,
        hasBackupSummary: !!state.backupSummary,
      }),
    )
    return null
  }

  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => root.render(<Probe />))
  await act(async () => {})

  return {
    snapshots,
    current() {
      if (!latestState) throw new Error("Settings state probe did not render.")
      return latestState
    },
  }
}

describe("useSettingsState", () => {
  it("loads settings data on mount", async () => {
    const client = createMockClient()
    const { snapshots } = await renderProbe(client)

    expect(snapshots.some((s) => s.includes('"loading":true'))).toBe(true)
    expect(snapshots.at(-1)).toContain('"hasRuntimeInfo":true')
    expect(snapshots.at(-1)).toContain('"securityChecksCount":1')
    expect(snapshots.at(-1)).toContain('"hasBackupSummary":true')
  })

  it("surfaces failed manual backup and cleanup jobs", async () => {
    const client = createMockClient()
    client.setManualBackupResult({ jobId: "manual-backup", status: "failed", message: "backup failed" })
    client.setCleanupResult({ jobId: "cleanup-backups", status: "failed", message: "cleanup failed" })
    const probe = await renderProbe(client)

    await act(async () => {
      await probe.current().runManualBackup()
    })
    expect(probe.current().errorMessage?.message).toBe("backup failed")
    expect(probe.current().errorMessage?.target).toBe("manual-backup")

    await act(async () => {
      await probe.current().cleanupOldBackups()
    })
    expect(probe.current().errorMessage?.message).toBe("cleanup failed")
    expect(probe.current().errorMessage?.target).toBe("cleanup-backups")
  })
})
