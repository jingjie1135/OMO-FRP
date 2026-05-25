import { afterEach, describe, expect, it } from "bun:test"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../../management-api/client"
import type { ConfigBackup, ConfigDocument, ConfigPreset, ConfigTarget, FrpConfigRequest, FrpStatus, InstallToolRequest, JobResult, LogLine, PublicEndpoint, RuntimeInfo, ToolDetection, ToolInstance } from "../../../management-api/types"
import { useToolsState, type ToolsState } from "./use-tools-state"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

const defaultRuntimeInfo: RuntimeInfo = {
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
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
  },
}

const successJob: JobResult = { jobId: "job-1", status: "succeeded", message: "Success" }

interface FakeClientControls {
  client: ManagementClient
  calls: {
    detectTools: number
    listToolInstances: number
    installTool: InstallToolRequest[]
    startTool: string[]
    stopTool: string[]
    restartTool: string[]
    getToolLogs: string[]
  }
  setRuntimeInfo(info: RuntimeInfo): void
  setInstances(instances: ToolInstance[]): void
  setDetections(detections: ToolDetection[]): void
  setLogs(instanceId: string, logs: LogLine[]): void
  rejectStartWith(error: unknown): void
  setStartHandler(handler: (instanceId: string) => Promise<JobResult>): void
}

function createFakeClient(): FakeClientControls {
  let runtimeInfo = defaultRuntimeInfo
  let instances: ToolInstance[] = []
  let detections: ToolDetection[] = []
  const logs = new Map<string, LogLine[]>()
  let startHandler: (instanceId: string) => Promise<JobResult> = async () => successJob

  const calls: FakeClientControls["calls"] = {
    detectTools: 0,
    listToolInstances: 0,
    installTool: [],
    startTool: [],
    stopTool: [],
    restartTool: [],
    getToolLogs: [],
  }

  const client: ManagementClient = {
    async getRuntimeInfo() {
      return runtimeInfo
    },
    async detectTools() {
      calls.detectTools += 1
      return detections
    },
    async listToolInstances() {
      calls.listToolInstances += 1
      return instances
    },
    async installTool(request: InstallToolRequest) {
      calls.installTool.push(request)
      return successJob
    },
    async startTool(instanceId: string) {
      calls.startTool.push(instanceId)
      return startHandler(instanceId)
    },
    async stopTool(instanceId: string) {
      calls.stopTool.push(instanceId)
      return successJob
    },
    async restartTool(instanceId: string) {
      calls.restartTool.push(instanceId)
      return successJob
    },
    async getToolLogs(instanceId: string) {
      calls.getToolLogs.push(instanceId)
      return logs.get(instanceId) ?? []
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
    async listEndpoints(): Promise<PublicEndpoint[]> {
      return []
    },
    async saveEndpoint() {},
    async enableEndpoint() {
      return successJob
    },
    async disableEndpoint() {
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
    async listDesktopTunnelDevices() { return [] },
    async provisionDesktopTunnel() { throw new Error("Desktop tunnel provisioning is not configured for this test client") },
    async sendDesktopTunnelHeartbeat() { throw new Error("Desktop tunnel heartbeat is not configured for this test client") },
    async deleteDesktopTunnelDevice() {},    async getCloudflareTunnelStatus() {
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
    async getDiagnostics() { return { runtime: runtimeInfo, tools: [], endpoints: [], frp: { mode: "server", running: false, message: "FRP server stopped." }, jobs: [], redactedLogs: [] } },
  }

  return {
    client,
    calls,
    setRuntimeInfo(info) {
      runtimeInfo = info
    },
    setInstances(nextInstances) {
      instances = nextInstances
    },
    setDetections(nextDetections) {
      detections = nextDetections
    },
    setLogs(instanceId, nextLogs) {
      logs.set(instanceId, nextLogs)
    },
    rejectStartWith(error) {
      startHandler = async () => {
        throw error
      }
    },
    setStartHandler(handler) {
      startHandler = handler
    },
  }
}

async function renderToolsState(client: ManagementClient): Promise<{ current(): ToolsState }> {
  let latestState: ToolsState | undefined

  function Probe() {
    latestState = useToolsState(client)
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
      if (!latestState) throw new Error("Tools state probe did not render.")
      return latestState
    },
  }
}

const opencodeInstance: ToolInstance = {
  id: "t1",
  kind: "opencode",
  displayName: "OpenCode",
  hostType: "server",
  installState: "installed",
  status: "running",
  defaultPort: 4096,
  currentPort: 4096,
  configDirectory: "/opt/opencode-remote-platform/config",
}

describe("useToolsState", () => {
  it("loads tool instances on initialization but not detections", async () => {
    const fake = createFakeClient()
    fake.setInstances([opencodeInstance])

    const probe = await renderToolsState(fake.client)

    expect(fake.calls.listToolInstances).toBe(1)
    expect(fake.calls.detectTools).toBe(0)
    expect(probe.current().instances).toEqual([opencodeInstance])
    expect(probe.current().isLoading).toBe(false)
  })

  it("detect calls detectTools and updates detections", async () => {
    const fake = createFakeClient()
    const detections: ToolDetection[] = [{ kind: "opencode", displayName: "OpenCode", detected: true }]
    fake.setDetections(detections)
    const probe = await renderToolsState(fake.client)

    await act(async () => {
      await probe.current().detect()
    })

    expect(fake.calls.detectTools).toBe(1)
    expect(probe.current().detections).toEqual(detections)
  })

  it("install calls installTool and refreshes instances and detections", async () => {
    const fake = createFakeClient()
    const probe = await renderToolsState(fake.client)
    fake.calls.listToolInstances = 0
    fake.setRuntimeInfo(defaultRuntimeInfo)

    await act(async () => {
      await probe.current().install({ kind: "bun" })
    })

    expect(fake.calls.installTool).toEqual([{ kind: "bun" }])
    expect(fake.calls.listToolInstances).toBe(1)
    expect(fake.calls.detectTools).toBe(1)
  })

  it("start, stop, and restart refresh instances and selected logs on success", async () => {
    const fake = createFakeClient()
    fake.setInstances([opencodeInstance])
    fake.setLogs("t1", [{ timestamp: "2024-01-01", level: "info", message: "token=secret123" }])
    const probe = await renderToolsState(fake.client)
    await act(async () => probe.current().selectInstance("t1"))
    fake.calls.listToolInstances = 0
    fake.calls.getToolLogs = []

    await act(async () => {
      await probe.current().start("t1")
      await probe.current().stop("t1")
      await probe.current().restart("t1")
    })

    expect(fake.calls.startTool).toEqual(["t1"])
    expect(fake.calls.stopTool).toEqual(["t1"])
    expect(fake.calls.restartTool).toEqual(["t1"])
    expect(fake.calls.listToolInstances).toBe(3)
    expect(fake.calls.getToolLogs).toEqual(["t1", "t1", "t1"])
    expect(probe.current().logs[0]?.message).toContain("[REDACTED]")
    expect(probe.current().logs[0]?.message).not.toContain("secret123")
  })

  it("refreshes runtime info after successful process actions", async () => {
    const fake = createFakeClient()
    let runtimeCalls = 0
    fake.setRuntimeInfo({
      ...defaultRuntimeInfo,
      capabilities: {
        ...defaultRuntimeInfo.capabilities,
        canManageLocalProcesses: true,
      },
    })
    const originalGetRuntimeInfo = fake.client.getRuntimeInfo
    fake.client.getRuntimeInfo = async () => {
      runtimeCalls += 1
      return originalGetRuntimeInfo()
    }

    const probe = await renderToolsState(fake.client)
    const baselineCalls = runtimeCalls

    await act(async () => {
      await probe.current().start("t1")
    })

    expect(runtimeCalls).toBeGreaterThan(baselineCalls)
  })

  it("prevents duplicate start submissions for the same instance while pending", async () => {
    const fake = createFakeClient()
    let resolveStart: (() => void) | undefined
    fake.setStartHandler(async () => {
      await new Promise<void>((resolve) => {
        resolveStart = resolve
      })
      return successJob
    })
    const probe = await renderToolsState(fake.client)

    let first: Promise<JobResult> | undefined
    let second: Promise<JobResult> | undefined
    await act(async () => {
      first = probe.current().start("t1")
      second = probe.current().start("t1")
    })
    await act(async () => resolveStart?.())
    await Promise.all([first, second])

    expect(fake.calls.startTool).toEqual(["t1"])
  })

  it("maps failure guidance for port occupied and missing password", async () => {
    const fake = createFakeClient()
    const probe = await renderToolsState(fake.client)
    fake.rejectStartWith(Object.assign(new Error("address already in use 0.0.0.0:4096"), { status: 500 }))

    await act(async () => {
      await probe.current().start("t1").catch(() => undefined)
    })

    expect(probe.current().getActionError("start:t1")?.message).toContain("Check if the port is already occupied")

    fake.rejectStartWith(Object.assign(new Error("password not configured"), { status: 400 }))
    await act(async () => {
      await probe.current().start("t1").catch(() => undefined)
    })

    expect(probe.current().getActionError("start:t1")?.message).toContain("Please configure a password in Settings")
  })
})
