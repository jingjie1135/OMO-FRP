import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "bun:test"
import type { PublicEndpoint } from "../core/app-config/types"
import { createServerRuntimePaths } from "./server-runtime-paths"
import { saveServerAppConfig } from "./server-runtime-state"
import { loadServerAppConfig } from "./server-runtime-state"
import { createPersistedServerRuntimeAdapter } from "./runtime-adapter"

const roots: string[] = []

afterEach(async () => {
  for (const root of roots.splice(0)) {
    await rm(root, { recursive: true, force: true })
  }
})

describe("persisted server runtime adapter", () => {
  it("loads real OpenCode detection from the server executor", async () => {
    const { root, restore } = await useTempStateRoot()
    const server = createServer((_request, response) => {
      response.writeHead(200, {
        "access-control-allow-origin": "*",
        connection: "close",
        "content-type": "text/plain",
      })
      response.end("ok")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("HTTP test server did not expose a TCP port")
    }
    const previousUrl = process.env.OPENCODE_INTERNAL_URL

    try {
      process.env.OPENCODE_INTERNAL_URL = `http://127.0.0.1:${address.port}`
      const adapter = await createPersistedServerRuntimeAdapter()

      const detections = await adapter.detectTools()

      expect(root).toBeTruthy()
      expect(detections.some((tool) => tool.kind === "opencode" && tool.detected)).toBe(true)
    } finally {
      if (previousUrl === undefined) delete process.env.OPENCODE_INTERNAL_URL
      else process.env.OPENCODE_INTERNAL_URL = previousUrl
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      restore()
    }
  })

  it("persists endpoint changes across adapter instances", async () => {
    const { restore } = await useTempStateRoot()
    try {
      const endpoint: PublicEndpoint = {
        id: "route-1",
        name: "Route 1",
        domain: "https://code.example.com/path",
        protocol: "https",
        targetType: "server-local",
        targetToolInstanceId: "opencode-server",
        authMode: "opencode-password",
        status: "active",
      }

      const first = await createPersistedServerRuntimeAdapter()
      await first.saveEndpoint(endpoint)
      const second = await createPersistedServerRuntimeAdapter()

      expect((await second.listEndpoints())[0]).toMatchObject({
        id: "route-1",
        domain: "code.example.com",
        status: "disabled",
      })
    } finally {
      restore()
    }
  })

  it("records jobs and logs for server executor actions", async () => {
    const { restore } = await useTempStateRoot()
    const server = createServer((_request, response) => {
      response.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/plain" })
      response.end("ok")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("HTTP test server did not expose a TCP port")
    }
    const previousUrl = process.env.OPENCODE_INTERNAL_URL
    const previousFrpPanelUrl = process.env.FRP_PANEL_INTERNAL_API_URL
    try {
      process.env.OPENCODE_INTERNAL_URL = `http://127.0.0.1:${address.port}`
      process.env.FRP_PANEL_INTERNAL_API_URL = `http://127.0.0.1:${address.port}`
      const adapter = await createPersistedServerRuntimeAdapter()

      const result = await adapter.startFrp()
      const diagnostics = await adapter.getDiagnostics()
      const logs = await adapter.getToolLogs("frp")

      expect(result.status).toBe("failed")
      expect(diagnostics.jobs.some((job) => job.jobId === result.jobId)).toBe(true)
      expect(logs.some((line) => line.message.includes("FRP server execution is not connected yet"))).toBe(true)
    } finally {
      if (previousUrl === undefined) delete process.env.OPENCODE_INTERNAL_URL
      else process.env.OPENCODE_INTERNAL_URL = previousUrl
      if (previousFrpPanelUrl === undefined) delete process.env.FRP_PANEL_INTERNAL_API_URL
      else process.env.FRP_PANEL_INTERNAL_API_URL = previousFrpPanelUrl
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      restore()
    }
  })

  it("loads config files from server storage", async () => {
    const { restore } = await useTempStateRoot()
    try {
      const paths = createServerRuntimePaths()
      await saveServerAppConfig(paths.appConfigPath, {
        mode: "server",
        toolInstances: [{
          id: "opencode-server",
          kind: "opencode",
          displayName: "OpenCode",
          hostType: "server",
          installState: "installed",
          configDirectory: paths.configDirectory,
          defaultPort: 4096,
          status: "stopped",
        }],
        pluginConfigs: [],
        publicEndpoints: [],
        frpClients: [],
      })
      const adapter = await createPersistedServerRuntimeAdapter()
      await adapter.saveConfig({ toolInstanceId: "opencode-server", kind: "opencode" }, "{}")

      const reloaded = await createPersistedServerRuntimeAdapter()
      const config = await loadServerAppConfig(paths.appConfigPath)
      const document = await reloaded.readConfig({ toolInstanceId: "opencode-server", kind: "opencode" })

      expect(config.toolInstances[0]?.installState).toBe("configured")
      expect(document.content).toBe("{}")
    } finally {
      restore()
    }
  })
})

async function useTempStateRoot(): Promise<{ root: string; restore: () => void }> {
  const root = await mkdtemp(join(tmpdir(), "omo-frp-runtime-"))
  roots.push(root)
  const previousRoot = process.env.OPENCODE_REMOTE_STATE_ROOT
  process.env.OPENCODE_REMOTE_STATE_ROOT = root

  return {
    root,
    restore() {
      if (previousRoot === undefined) delete process.env.OPENCODE_REMOTE_STATE_ROOT
      else process.env.OPENCODE_REMOTE_STATE_ROOT = previousRoot
    },
  }
}
