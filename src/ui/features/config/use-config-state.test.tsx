import { afterEach, describe, expect, it, mock } from "bun:test"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { ManagementClient } from "../../../management-api/client"
import type { ConfigBackup, ConfigDocument, ConfigPreset, ConfigTarget, FrpConfigRequest, FrpStatus, JobResult, LogLine, PublicEndpoint, RuntimeInfo, ToolDetection, ToolInstance } from "../../../management-api/types"
import { ActionRunner } from "../../app/action-runner"
import { useConfigState } from "./use-config-state"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

interface MockConfigClientControls {
  client: ManagementClient
  readConfigMock: ReturnType<typeof mock>
  saveConfigMock: ReturnType<typeof mock>
  listPresetsMock: ReturnType<typeof mock>
  applyPresetMock: ReturnType<typeof mock>
  listBackupsMock: ReturnType<typeof mock>
  restoreBackupMock: ReturnType<typeof mock>
}

function createMockClient(): MockConfigClientControls {
  const readConfigMock = mock(async (target: ConfigTarget): Promise<ConfigDocument> => ({ target, content: "test" }))
  const saveConfigMock = mock(async () => {})
  const listPresetsMock = mock(async (): Promise<ConfigPreset[]> => [])
  const applyPresetMock = mock(async () => {})
  const listBackupsMock = mock(async (): Promise<ConfigBackup[]> => [])
  const restoreBackupMock = mock(async () => {})

  const successJob: JobResult = { jobId: "job", status: "succeeded", message: "ok" }
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
      toolInstances: [],
      pluginConfigs: [],
      publicEndpoints: [],
      frpClients: [],
    },
  }

  const client: ManagementClient = {
    async getRuntimeInfo(): Promise<RuntimeInfo> {
      return runtimeInfo
    },
    async detectTools(): Promise<ToolDetection[]> {
      return []
    },
    async listToolInstances(): Promise<ToolInstance[]> {
      return []
    },
    async installTool() {
      return successJob
    },
    async startTool() {
      return successJob
    },
    async stopTool() {
      return successJob
    },
    async restartTool() {
      return successJob
    },
    async getToolLogs(): Promise<LogLine[]> {
      return []
    },
    readConfig: readConfigMock,
    async validateConfig() {
      return { valid: true, fieldErrors: [] }
    },
    saveConfig: saveConfigMock,
    listPresets: listPresetsMock,
    applyPreset: applyPresetMock,
    listBackups: listBackupsMock,
    restoreBackup: restoreBackupMock,
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
      return { mode: "server", running: false, message: "FRP server is not configured yet." }
    },
    async saveFrpConfig(_config: FrpConfigRequest) {},
    async startFrp() {
      return successJob
    },
    async stopFrp() {
      return successJob
    },
  }

  return {
    client,
    readConfigMock,
    saveConfigMock,
    listPresetsMock,
    applyPresetMock,
    listBackupsMock,
    restoreBackupMock,
  }
}

async function renderConfigState(client: ManagementClient, runner: ActionRunner, initial: { initialOpencode?: ConfigDocument; initialOhMyOpenAgent?: ConfigDocument; initialPresets?: ConfigPreset[]; initialBackups?: ConfigBackup[] }) {
  let latestState: ReturnType<typeof useConfigState> | undefined

  function Probe() {
    latestState = useConfigState({
      client,
      runner,
      initialOpencode: initial.initialOpencode,
      initialOhMyOpenAgent: initial.initialOhMyOpenAgent,
      initialPresets: initial.initialPresets ?? [],
      initialBackups: initial.initialBackups ?? [],
    })
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
      if (!latestState) {
        throw new Error("Config state probe did not render.")
      }
      return latestState
    },
  }
}

describe("useConfigState", () => {
  const runner = new ActionRunner()
  const target: ConfigTarget = { toolInstanceId: "test-id", kind: "opencode" }

  it("initializes with provided data", async () => {
    const { client } = createMockClient()
    const initialConfig: ConfigDocument = { target, content: "initial" }

    const probe = await renderConfigState(client, runner, {
      initialOpencode: initialConfig,
    })

    expect(probe.current().content).toBe("initial")
    expect(probe.current().selectedTarget).toEqual(target)
  })

  it("switches targets and loads new config", async () => {
    const { client, readConfigMock } = createMockClient()
    const opencodeTarget: ConfigTarget = { toolInstanceId: "test-id", kind: "opencode" }
    const pluginTarget: ConfigTarget = { toolInstanceId: "test-id", kind: "oh-my-openagent" }

    const probe = await renderConfigState(client, runner, {
      initialOpencode: { target: opencodeTarget, content: "opencode" },
    })

    await act(async () => {
      await probe.current().selectTarget(pluginTarget)
    })

    expect(readConfigMock).toHaveBeenCalledWith(pluginTarget)
  })

  it("preserves draft across refresh failures", async () => {
    const { client, readConfigMock } = createMockClient()
    const probe = await renderConfigState(client, runner, {
      initialOpencode: { target, content: "initial" },
    })

    act(() => {
      probe.current().setContent("new draft")
    })

    readConfigMock.mockRejectedValueOnce(new Error("refresh failed"))

    await act(async () => {
      await probe.current().refresh().catch(() => undefined)
    })

    expect(probe.current().content).toBe("new draft")
  })

  it("validates content before save", async () => {
    const { client, saveConfigMock } = createMockClient()
    const probe = await renderConfigState(client, runner, {
      initialOpencode: { target, content: "initial" },
    })

    act(() => {
      probe.current().setContent("")
    })

    let capturedError: Error | undefined
    await act(async () => {
      try {
        await probe.current().save()
      } catch (error) {
        if (error instanceof Error) {
          capturedError = error
        }
      }
    })

    expect(capturedError?.message).toContain("cannot be empty")
    expect(saveConfigMock).not.toHaveBeenCalled()
  })
})
