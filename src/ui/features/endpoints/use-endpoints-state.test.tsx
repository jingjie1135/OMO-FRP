import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../../management-api/client"
import type { ConfigBackup, ConfigDocument, ConfigPreset, ConfigTarget, FrpConfigRequest, FrpStatus, InstallToolRequest, JobResult, LogLine, PublicEndpoint, RuntimeInfo, ToolDetection, ToolInstance } from "../../../management-api/types"
import { ActionRunner } from "../../app/action-runner"
import { useEndpointsState, type EndpointsState } from "./use-endpoints-state"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

const successJob: JobResult = { jobId: "job-1", status: "succeeded", message: "Success" }

const endpoint: PublicEndpoint = {
  id: "ep1",
  name: "Test Endpoint",
  domain: "test.example.com",
  protocol: "https",
  targetType: "server-local",
  targetToolInstanceId: "tool1",
  authMode: "opencode-password",
  status: "disabled",
}

const runningTool: ToolInstance = {
  id: "tool1",
  kind: "opencode",
  displayName: "OpenCode",
  hostType: "server",
  installState: "configured",
  defaultPort: 4096,
  currentPort: 4096,
  status: "running",
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
  },
  config: {
    mode: "server",
    toolInstances: [runningTool],
    pluginConfigs: [],
    publicEndpoints: [endpoint],
    frpClients: [],
  },
}

interface FakeClientControls {
  client: ManagementClient
  calls: {
    getRuntimeInfo: number
    listEndpoints: number
    saveEndpoint: PublicEndpoint[]
    enableEndpoint: string[]
    disableEndpoint: string[]
  }
  setEndpoints(nextEndpoints: PublicEndpoint[]): void
  setRuntimeInfo(nextRuntimeInfo: RuntimeInfo): void
  setEnableHandler(handler: (id: string) => Promise<JobResult>): void
}

function createFakeClient(): FakeClientControls {
  let endpoints = [endpoint]
  let info = runtimeInfo
  let enableHandler: (id: string) => Promise<JobResult> = async () => successJob
  const calls: FakeClientControls["calls"] = {
    getRuntimeInfo: 0,
    listEndpoints: 0,
    saveEndpoint: [],
    enableEndpoint: [],
    disableEndpoint: [],
  }

  const client: ManagementClient = {
    async getRuntimeInfo() {
      calls.getRuntimeInfo += 1
      return info
    },
    async detectTools(): Promise<ToolDetection[]> {
      return []
    },
    async listToolInstances(): Promise<ToolInstance[]> {
      return info.config.toolInstances
    },
    async installTool(_request: InstallToolRequest) {
      return successJob
    },
    async startTool(_instanceId: string) {
      return successJob
    },
    async stopTool(_instanceId: string) {
      return successJob
    },
    async restartTool(_instanceId: string) {
      return successJob
    },
    async getToolLogs(_instanceId: string): Promise<LogLine[]> {
      return []
    },
    async readConfig(target: ConfigTarget): Promise<ConfigDocument> {
      return { target, content: "{}" }
    },
    async validateConfig() {
      return { valid: true, fieldErrors: [] }
    },
    async saveConfig() {},
    async listPresets(): Promise<ConfigPreset[]> {
      return []
    },
    async applyPreset() {},
    async listBackups(): Promise<ConfigBackup[]> {
      return []
    },
    async restoreBackup() {},
    async listEndpoints() {
      calls.listEndpoints += 1
      return endpoints
    },
    async saveEndpoint(nextEndpoint: PublicEndpoint) {
      calls.saveEndpoint.push(nextEndpoint)
    },
    async enableEndpoint(id: string) {
      calls.enableEndpoint.push(id)
      return enableHandler(id)
    },
    async disableEndpoint(id: string) {
      calls.disableEndpoint.push(id)
      return successJob
    },
    async getFrpStatus(): Promise<FrpStatus> {
      return { mode: "server", running: true, message: "FRP server is running." }
    },
    async saveFrpConfig(_config: FrpConfigRequest) {},
    async startFrp() {
      return successJob
    },
    async stopFrp() {
      return successJob
    },
    async getCloudflareTunnelStatus() {
      return { mode: "quick", running: false, message: "Cloudflare Tunnel stopped" }
    },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() {
      return { mode: "quick", localUrl: "http://127.0.0.1:4096", commandSummary: [], cloudflaredDetected: false, diagnostics: [], securityNotes: [], steps: [] }
    },
    async startCloudflareTunnel() {
      return successJob
    },
    async stopCloudflareTunnel() {
      return successJob
    },
    async retryCloudflareTunnelStep() {
      return { jobId: "retry-cloudflare", status: "succeeded", message: "ok" }
    },
    async getSecurityChecks() { return [] },
    async getBackupSummary() { return { count: 0, backupDirectory: "", failureRecords: [], canManualBackup: false, canCleanup: false } },
    async runManualBackup() { return successJob },
    async cleanupOldBackups() { return successJob },
    async getDiagnostics() { return { runtime: info, tools: [], endpoints, frp: { mode: "server", running: false, message: "FRP server stopped." }, jobs: [], redactedLogs: [] } },
  }

  return {
    client,
    calls,
    setEndpoints(nextEndpoints) {
      endpoints = nextEndpoints
    },
    setRuntimeInfo(nextRuntimeInfo) {
      info = nextRuntimeInfo
    },
    setEnableHandler(handler) {
      enableHandler = handler
    },
  }
}

async function renderEndpointsState(client: ManagementClient): Promise<{ current(): EndpointsState }> {
  const runner = new ActionRunner()
  let latestState: EndpointsState | undefined

  function Probe() {
    latestState = useEndpointsState(client, runner)
    return null
  }

  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => root.render(<Probe />))
  await act(async () => {})

  return {
    current() {
      if (!latestState) throw new Error("Endpoints state probe did not render.")
      return latestState
    },
  }
}

describe("useEndpointsState", () => {
  it("initializes with endpoints and runtime info", async () => {
    const fake = createFakeClient()
    const probe = await renderEndpointsState(fake.client)

    expect(probe.current().loading).toBe(false)
    expect(probe.current().endpoints).toEqual([endpoint])
    expect(probe.current().runtimeInfo).toEqual(runtimeInfo)
  })

  it("saves an endpoint and refreshes", async () => {
    const fake = createFakeClient()
    const probe = await renderEndpointsState(fake.client)
    fake.calls.listEndpoints = 0

    await act(async () => {
      await probe.current().saveEndpoint(endpoint)
    })

    expect(fake.calls.saveEndpoint).toEqual([endpoint])
    expect(fake.calls.listEndpoints).toBe(1)
  })

  it("blocks enable if safety checks fail", async () => {
    const fake = createFakeClient()
    const unsafeEndpoint: PublicEndpoint = { ...endpoint, authMode: "basic-auth" }
    fake.setEndpoints([unsafeEndpoint])
    const probe = await renderEndpointsState(fake.client)

    const safety = probe.current().checkSafety({ ...unsafeEndpoint, status: "active" })
    expect(safety.ok).toBe(false)
    expect(safety.issues.join(" ")).toContain("Active public OpenCode endpoints")

    let message = ""
    await act(async () => {
      await probe.current().enableEndpoint(unsafeEndpoint.id).catch((error: unknown) => {
        message = error instanceof Error ? error.message : String(error)
      })
    })

    expect(message).toContain("safety check")
    expect(fake.calls.enableEndpoint).toEqual([])
  })

  it("enables an endpoint after safety checks and does not optimistically flip status", async () => {
    const fake = createFakeClient()
    let resolveEnable: (() => void) | undefined
    fake.setEnableHandler(async () => {
      await new Promise<void>((resolve) => {
        resolveEnable = resolve
      })
      fake.setEndpoints([{ ...endpoint, status: "active" }])
      return successJob
    })
    const probe = await renderEndpointsState(fake.client)

    let pending: Promise<void> | undefined
    await act(async () => {
      pending = probe.current().enableEndpoint(endpoint.id)
    })

    expect(probe.current().endpoints[0]?.status).toBe("disabled")
    await act(async () => resolveEnable?.())
    await pending

    expect(fake.calls.enableEndpoint).toEqual([endpoint.id])
    expect(probe.current().endpoints[0]?.status).toBe("active")
  })

  it("treats failed enable jobs as errors and preserves disabled state", async () => {
    const fake = createFakeClient()
    fake.setEnableHandler(async () => ({ jobId: "job-failed", status: "failed", message: "Port is unreachable" }))
    const probe = await renderEndpointsState(fake.client)

    let message = ""
    await act(async () => {
      await probe.current().enableEndpoint(endpoint.id).catch((error: unknown) => {
        message = error instanceof Error ? error.message : String(error)
      })
    })

    expect(message).toContain("Port is unreachable")
    expect(fake.calls.enableEndpoint).toEqual([endpoint.id])
    expect(probe.current().endpoints[0]?.status).toBe("disabled")
  })

  it("prevents duplicate enable submissions for the same endpoint", async () => {
    const fake = createFakeClient()
    let resolveEnable: (() => void) | undefined
    fake.setEnableHandler(async () => {
      await new Promise<void>((resolve) => {
        resolveEnable = resolve
      })
      return successJob
    })
    const probe = await renderEndpointsState(fake.client)

    let first: Promise<void> | undefined
    let second: Promise<void> | undefined
    await act(async () => {
      first = probe.current().enableEndpoint(endpoint.id)
      second = probe.current().enableEndpoint(endpoint.id)
    })
    await act(async () => resolveEnable?.())
    await Promise.all([first, second])

    expect(fake.calls.enableEndpoint).toEqual([endpoint.id])
  })

  it("disables an endpoint and refreshes while preserving endpoint fields", async () => {
    const fake = createFakeClient()
    const probe = await renderEndpointsState(fake.client)
    fake.calls.listEndpoints = 0

    await act(async () => {
      await probe.current().disableEndpoint(endpoint.id)
    })

    expect(fake.calls.disableEndpoint).toEqual([endpoint.id])
    expect(fake.calls.listEndpoints).toBe(1)
    expect(probe.current().endpoints[0]?.domain).toBe(endpoint.domain)
  })
})
