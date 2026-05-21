import { mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "bun:test"
import type { PublicEndpoint } from "../core/app-config/types"
import type { RuntimeExecutor } from "../management-api/runtime-executor"
import type { LogLine } from "../management-api/types"
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

  it("surfaces managed server tool instances on a clean state root", async () => {
    const { restore } = await useTempStateRoot()
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

      const runtime = await adapter.getRuntimeInfo()
      const instances = await adapter.listToolInstances()

      expect(runtime.config.toolInstances.some((tool) => tool.id === "opencode-server")).toBe(true)
      expect(instances.some((tool) => tool.id === "opencode-server" && tool.kind === "opencode")).toBe(true)
      expect(instances.some((tool) => tool.id === "cloudflared-server" && tool.kind === "cloudflared")).toBe(true)
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

  it("fails server endpoint enablement with an actionable route provisioning message", async () => {
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
          installState: "configured",
          defaultPort: 4096,
          currentPort: 4096,
          status: "running",
        }],
        pluginConfigs: [],
        publicEndpoints: [{
          id: "route-1",
          name: "Route 1",
          domain: "code.example.com",
          protocol: "https",
          targetType: "server-local",
          targetToolInstanceId: "opencode-server",
          authMode: "opencode-password",
          status: "disabled",
        }],
        frpClients: [],
      })
      const adapter = await createPersistedServerRuntimeAdapter()

      const result = await adapter.enableEndpoint("route-1")
      const [endpoint] = await adapter.listEndpoints()

      expect(result).toEqual({
        jobId: "enable-endpoint:route-1",
        status: "failed",
        message: "Server endpoint route provisioning is not connected yet. Configure Caddy/frp-panel route for code.example.com, then retry.",
      })
      expect(endpoint?.status).toBe("disabled")
    } finally {
      restore()
    }
  })

  it("enables the existing deployed OpenCode server-local route", async () => {
    const { restore } = await useTempStateRoot()
    const previousDomain = process.env.OPENCODE_REMOTE_DOMAIN
    try {
      process.env.OPENCODE_REMOTE_DOMAIN = "example.com"
      const paths = createServerRuntimePaths()
      await saveServerAppConfig(paths.appConfigPath, {
        mode: "server",
        toolInstances: [{
          id: "opencode-server",
          kind: "opencode",
          displayName: "OpenCode",
          hostType: "server",
          installState: "configured",
          defaultPort: 4096,
          currentPort: 4096,
          status: "running",
        }],
        pluginConfigs: [],
        publicEndpoints: [{
          id: "route-1",
          name: "OpenCode Route",
          domain: "opencode.example.com",
          protocol: "https",
          targetType: "server-local",
          targetToolInstanceId: "opencode-server",
          authMode: "opencode-password",
          status: "disabled",
        }],
        frpClients: [],
      })
      const adapter = await createPersistedServerRuntimeAdapter()

      const result = await adapter.enableEndpoint("route-1")
      const [endpoint] = await adapter.listEndpoints()

      expect(result).toEqual({
        jobId: "enable-endpoint:route-1",
        status: "succeeded",
        message: "OpenCode Route is now active.",
      })
      expect(endpoint?.status).toBe("active")
    } finally {
      if (previousDomain === undefined) delete process.env.OPENCODE_REMOTE_DOMAIN
      else process.env.OPENCODE_REMOTE_DOMAIN = previousDomain
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
      expect(logs.some((line) => line.message.includes("FRP container control is disabled"))).toBe(true)
    } finally {
      if (previousUrl === undefined) delete process.env.OPENCODE_INTERNAL_URL
      else process.env.OPENCODE_INTERNAL_URL = previousUrl
      if (previousFrpPanelUrl === undefined) delete process.env.FRP_PANEL_INTERNAL_API_URL
      else process.env.FRP_PANEL_INTERNAL_API_URL = previousFrpPanelUrl
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
      restore()
    }
  })

  it("combines durable runtime logs with live executor tool logs", async () => {
    const { restore } = await useTempStateRoot()
    try {
      const adapter = await createPersistedServerRuntimeAdapter({
        executor: createExecutorWithLogs([{ timestamp: "2026-05-21T00:00:00.000Z", level: "info", message: "OpenCode listening" }]),
      })

      const logs = await adapter.getToolLogs("opencode-server")

      expect(logs).toEqual([{ timestamp: "2026-05-21T00:00:00.000Z", level: "info", message: "OpenCode listening" }])
    } finally {
      restore()
    }
  })

  it("loads config files from server storage", async () => {
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
    try {
      process.env.OPENCODE_INTERNAL_URL = `http://127.0.0.1:${address.port}`
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
      if (previousUrl === undefined) delete process.env.OPENCODE_INTERNAL_URL
      else process.env.OPENCODE_INTERNAL_URL = previousUrl
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
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

function createExecutorWithLogs(logs: LogLine[]): RuntimeExecutor {
  return {
    async detectTools() { return [] },
    async installTool() { throw new Error("not used") },
    async startTool() { throw new Error("not used") },
    async stopTool() { throw new Error("not used") },
    async restartTool() { throw new Error("not used") },
    async getToolLogs() { return logs },
    async getFrpStatus() { return { mode: "server", running: false, message: "not used" } },
    async saveFrpConfig() {},
    async startFrp() { throw new Error("not used") },
    async stopFrp() { throw new Error("not used") },
    async getCloudflareTunnelStatus() { return { mode: "unavailable", running: false, message: "not used" } },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() { throw new Error("not used") },
    async startCloudflareTunnel() { throw new Error("not used") },
    async stopCloudflareTunnel() { throw new Error("not used") },
    async retryCloudflareTunnelStep() { throw new Error("not used") },
  }
}
