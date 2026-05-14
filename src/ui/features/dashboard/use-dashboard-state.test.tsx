import { afterEach, describe, expect, it } from "bun:test"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../../management-api/client"
import type { DashboardViewModel, LoadDashboardViewModel } from "./dashboard-view-model"
import { useDashboardState } from "./use-dashboard-state"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

function createDashboard(message: string): DashboardViewModel {
  return {
    runtimeInfo: {
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
        toolInstances: [
          {
            id: "opencode-server",
            kind: "opencode",
            displayName: "OpenCode",
            hostType: "server",
            installState: "configured",
            defaultPort: 4096,
            status: "running",
          },
        ],
        pluginConfigs: [],
        publicEndpoints: [],
        frpClients: [],
      },
    },
    frpStatus: { mode: "server", running: true, message },
    logs: [],
  }
}

function createClient(results: Array<DashboardViewModel | Error>): ManagementClient {
  let callIndex = 0

  return {
    async getRuntimeInfo() {
      const result = results[Math.min(callIndex, results.length - 1)]
      if (result instanceof Error) throw result
      return result.runtimeInfo
    },
    async getFrpStatus() {
      const result = results[Math.min(callIndex, results.length - 1)]
      if (result instanceof Error) throw result
      return result.frpStatus
    },
    async getToolLogs() {
      const result = results[Math.min(callIndex, results.length - 1)]
      callIndex += 1
      if (result instanceof Error) throw result
      return result.logs
    },
    async detectTools() {
      return []
    },
    async listToolInstances() {
      return []
    },
    async installTool() {
      return { jobId: "install", status: "succeeded", message: "installed" }
    },
    async startTool() {
      return { jobId: "start", status: "succeeded", message: "started" }
    },
    async stopTool() {
      return { jobId: "stop", status: "succeeded", message: "stopped" }
    },
    async restartTool() {
      return { jobId: "restart", status: "succeeded", message: "restarted" }
    },
    async readConfig() {
      return { target: { toolInstanceId: "opencode-server", kind: "opencode" }, content: "" }
    },
    async saveConfig() {},
    async listPresets() {
      return []
    },
    async applyPreset() {},
    async listBackups() {
      return []
    },
    async restoreBackup() {},
    async listEndpoints() {
      return []
    },
    async saveEndpoint() {},
    async enableEndpoint() {
      return { jobId: "enable", status: "succeeded", message: "enabled" }
    },
    async disableEndpoint() {
      return { jobId: "disable", status: "succeeded", message: "disabled" }
    },
    async saveFrpConfig() {},
    async startFrp() {
      return { jobId: "start-frp", status: "succeeded", message: "started" }
    },
    async stopFrp() {
      return { jobId: "stop-frp", status: "succeeded", message: "stopped" }
    },
  }
}

async function renderProbe(client: ManagementClient, loader?: LoadDashboardViewModel) {
  const container = document.createElement("div")
  document.body.append(container)
  const snapshots: string[] = []
  let refresh: () => Promise<void> = async () => {}

  function Probe() {
    const state = useDashboardState(client, loader)
    refresh = state.refresh
    snapshots.push(
      JSON.stringify({
        loading: state.isLoading,
        refreshing: state.isRefreshing,
        message: state.dashboard?.frpStatus.message ?? null,
        error: state.errorMessage,
        hasLastUpdated: Boolean(state.lastUpdated),
      }),
    )
    return null
  }

  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => root.render(<Probe />))
  await act(async () => {})

  return { snapshots, refresh: () => act(async () => refresh()), refreshWithoutAct: () => refresh() }
}

async function renderRerenderableProbe(client: ManagementClient, loader: LoadDashboardViewModel) {
  const container = document.createElement("div")
  document.body.append(container)
  const snapshots: string[] = []
  let refresh: () => Promise<void> = async () => {}

  function Probe({ currentClient, currentLoader }: { currentClient: ManagementClient; currentLoader: LoadDashboardViewModel }) {
    const state = useDashboardState(currentClient, currentLoader)
    refresh = state.refresh
    snapshots.push(
      JSON.stringify({
        loading: state.isLoading,
        refreshing: state.isRefreshing,
        message: state.dashboard?.frpStatus.message ?? null,
        error: state.errorMessage,
        hasLastUpdated: Boolean(state.lastUpdated),
      }),
    )
    return null
  }

  const root = createRoot(container)
  mountedRoots.push(root)
  await act(async () => root.render(<Probe currentClient={client} currentLoader={loader} />))
  await act(async () => {})

  return {
    snapshots,
    refreshWithoutAct: () => refresh(),
    rerender: (nextClient: ManagementClient, nextLoader: LoadDashboardViewModel) => act(async () => root.render(<Probe currentClient={nextClient} currentLoader={nextLoader} />)),
  }
}

describe("useDashboardState", () => {
  it("loads Dashboard data and records last updated time", async () => {
    const { snapshots } = await renderProbe(createClient([createDashboard("ready")]))

    expect(snapshots.some((snapshot) => snapshot.includes('"loading":true'))).toBe(true)
    expect(snapshots.at(-1)).toContain('"message":"ready"')
    expect(snapshots.at(-1)).toContain('"hasLastUpdated":true')
  })

  it("keeps previous data visible when refresh fails", async () => {
    const { snapshots, refresh } = await renderProbe(createClient([createDashboard("ready"), new Error("network down")]))

    await refresh()

    expect(snapshots.at(-1)).toContain('"message":"ready"')
    expect(snapshots.at(-1)).toContain('"error":"network down"')
  })

  it("ignores stale responses when an older refresh resolves after a newer refresh", async () => {
    let resolveOlderRefresh: ((value: DashboardViewModel) => void) | undefined
    let resolveNewerRefresh: ((value: DashboardViewModel) => void) | undefined
    let loadCount = 0
    const loader: LoadDashboardViewModel = async () => {
      loadCount += 1
      if (loadCount === 1) {
        return createDashboard("initial")
      }

      if (loadCount === 2) {
        return new Promise<DashboardViewModel>((resolve) => {
          resolveOlderRefresh = resolve
        })
      }

      return new Promise<DashboardViewModel>((resolve) => {
        resolveNewerRefresh = resolve
      })
    }
    const { snapshots, refreshWithoutAct } = await renderProbe(createClient([createDashboard("unused")]), loader)

    await act(async () => {
      const olderRefresh = refreshWithoutAct()
      const newerRefresh = refreshWithoutAct()
      resolveNewerRefresh?.(createDashboard("newer"))
      resolveOlderRefresh?.(createDashboard("stale"))
      await Promise.all([olderRefresh, newerRefresh])
    })

    expect(snapshots.at(-1)).toContain('"message":"newer"')
    expect(snapshots.at(-1)).not.toContain('"message":"stale"')
  })

  it("clears refreshing when an in-flight refresh is superseded by a new initial load", async () => {
    let resolveRefresh: ((value: DashboardViewModel) => void) | undefined
    let firstLoadCount = 0
    const firstLoader: LoadDashboardViewModel = async () => {
      firstLoadCount += 1
      if (firstLoadCount === 1) {
        return createDashboard("initial")
      }

      return new Promise<DashboardViewModel>((resolve) => {
        resolveRefresh = resolve
      })
    }
    const secondLoader: LoadDashboardViewModel = async () => createDashboard("new-client")
    const probe = await renderRerenderableProbe(createClient([createDashboard("unused")]), firstLoader)

    let staleRefresh: Promise<void> | undefined
    await act(async () => {
      staleRefresh = probe.refreshWithoutAct()
    })
    await probe.rerender(createClient([createDashboard("unused")]), secondLoader)
    await act(async () => resolveRefresh?.(createDashboard("stale-refresh")))
    await staleRefresh

    expect(probe.snapshots.at(-1)).toContain('"message":"new-client"')
    expect(probe.snapshots.at(-1)).toContain('"loading":false')
    expect(probe.snapshots.at(-1)).toContain('"refreshing":false')
  })
})
