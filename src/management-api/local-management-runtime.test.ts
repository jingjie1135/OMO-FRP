import { describe, expect, it } from "bun:test"
import { SERVER_CAPABILITIES } from "../core/app-config/types"
import type { AppConfig, PublicEndpoint, ToolInstance } from "../core/app-config/types"
import { createLocalManagementRuntime } from "./local-management-runtime"
import type { RuntimeExecutor } from "./runtime-executor"

const runningOpenCode: ToolInstance = {
  id: "opencode-server",
  kind: "opencode",
  displayName: "OpenCode",
  hostType: "server",
  installState: "configured",
  defaultPort: 4096,
  currentPort: 4096,
  status: "running",
}

const endpoint: PublicEndpoint = {
  id: "route-1",
  name: "Route 1",
  domain: "code.example.com",
  protocol: "https",
  targetType: "server-local",
  targetToolInstanceId: "opencode-server",
  authMode: "opencode-password",
  status: "disabled",
}

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    mode: "server",
    toolInstances: [runningOpenCode],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
    ...overrides,
  }
}

describe("local management runtime executor", () => {
  it("delegates tool start to the runtime executor", async () => {
    const calls: string[] = []
    const executor: RuntimeExecutor = {
      async detectTools() { return [] },
      async installTool() { throw new Error("not used") },
      async startTool(instanceId) {
        calls.push(instanceId)
        return { jobId: `start:${instanceId}`, status: "succeeded", message: "started by executor" }
      },
      async stopTool() { throw new Error("not used") },
      async restartTool() { throw new Error("not used") },
      async getToolLogs() { return [] },
      async getFrpStatus() { return { mode: "server", running: false, message: "not running" } },
      async saveFrpConfig() {},
      async startFrp() { throw new Error("not used") },
      async stopFrp() { throw new Error("not used") },
      async getCloudflareTunnelStatus() { return { mode: "unavailable", running: false, message: "not configured" } },
      async saveCloudflareTunnelConfig() {},
      async createCloudflareTunnelPlan() { throw new Error("not used") },
      async startCloudflareTunnel() { throw new Error("not used") },
      async stopCloudflareTunnel() { throw new Error("not used") },
      async retryCloudflareTunnelStep(stepId) {
        return { jobId: `retry:${stepId}`, status: "succeeded", message: "retried" }
      },
    }

    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/config",
      frpStatusMode: "server",
      executor,
      config: {
        mode: "server",
        toolInstances: [{
          id: "opencode-server",
          kind: "opencode",
          displayName: "OpenCode",
          hostType: "server",
          installState: "installed",
          defaultPort: 4096,
          status: "stopped",
        }],
        pluginConfigs: [],
        publicEndpoints: [],
        frpClients: [],
      },
    })

    const result = await runtime.startTool("opencode-server")

    expect(result.message).toBe("started by executor")
    expect(calls).toEqual(["opencode-server"])
  })

  it("delegates runtime execution and status methods to the runtime executor", async () => {
    const calls: string[] = []
    const executor: RuntimeExecutor = {
      async detectTools() {
        calls.push("detectTools")
        return [{ kind: "opencode", displayName: "OpenCode", detected: true }]
      },
      async installTool(request) {
        calls.push(`installTool:${request.kind}`)
        return { jobId: `install:${request.kind}`, status: "failed", message: "install delegated" }
      },
      async startTool(instanceId) {
        calls.push(`startTool:${instanceId}`)
        return { jobId: `start:${instanceId}`, status: "failed", message: "start delegated" }
      },
      async stopTool(instanceId) {
        calls.push(`stopTool:${instanceId}`)
        return { jobId: `stop:${instanceId}`, status: "failed", message: "stop delegated" }
      },
      async restartTool(instanceId) {
        calls.push(`restartTool:${instanceId}`)
        return { jobId: `restart:${instanceId}`, status: "failed", message: "restart delegated" }
      },
      async getToolLogs(instanceId) {
        calls.push(`getToolLogs:${instanceId}`)
        return [{ timestamp: "2026-05-20T00:00:00.000Z", level: "info", message: "logs delegated" }]
      },
      async getFrpStatus() {
        calls.push("getFrpStatus")
        return { mode: "server", running: false, message: "frp delegated" }
      },
      async saveFrpConfig() { calls.push("saveFrpConfig") },
      async startFrp() {
        calls.push("startFrp")
        return { jobId: "start-frp:server", status: "failed", message: "frp start delegated" }
      },
      async stopFrp() {
        calls.push("stopFrp")
        return { jobId: "stop-frp:server", status: "failed", message: "frp stop delegated" }
      },
      async getCloudflareTunnelStatus() {
        calls.push("getCloudflareTunnelStatus")
        return { mode: "unavailable", running: false, message: "cloudflare delegated" }
      },
      async saveCloudflareTunnelConfig() { calls.push("saveCloudflareTunnelConfig") },
      async createCloudflareTunnelPlan() { throw new Error("not used") },
      async startCloudflareTunnel() {
        calls.push("startCloudflareTunnel")
        return { jobId: "start-cloudflare:server", status: "failed", message: "cloudflare start delegated" }
      },
      async stopCloudflareTunnel() {
        calls.push("stopCloudflareTunnel")
        return { jobId: "stop-cloudflare:server", status: "failed", message: "cloudflare stop delegated" }
      },
      async retryCloudflareTunnelStep(stepId) {
        calls.push(`retryCloudflareTunnelStep:${stepId}`)
        return { jobId: `retry:${stepId}`, status: "failed", message: "retry delegated" }
      },
    }
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/config",
      frpStatusMode: "server",
      executor,
      config: createConfig({ toolInstances: [{ ...runningOpenCode, status: "stopped" }] }),
    })

    expect((await runtime.detectTools())[0]?.detected).toBe(true)
    expect((await runtime.installTool({ kind: "opencode" })).message).toBe("install delegated")
    expect((await runtime.stopTool("opencode-server")).message).toBe("stop delegated")
    expect((await runtime.restartTool("opencode-server")).message).toBe("restart delegated")
    expect((await runtime.getToolLogs("opencode-server"))[0]?.message).toBe("logs delegated")
    expect((await runtime.getFrpStatus()).message).toBe("frp delegated")
    expect((await runtime.startFrp()).message).toBe("frp start delegated")
    expect((await runtime.stopFrp()).message).toBe("frp stop delegated")
    expect((await runtime.getCloudflareTunnelStatus()).message).toBe("cloudflare delegated")
    expect((await runtime.startCloudflareTunnel({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })).message).toBe("cloudflare start delegated")
    expect((await runtime.stopCloudflareTunnel()).message).toBe("cloudflare stop delegated")
    expect((await runtime.retryCloudflareTunnelStep("start_tunnel")).message).toBe("retry delegated")

    expect(calls).toEqual([
      "detectTools",
      "installTool:opencode",
      "stopTool:opencode-server",
      "restartTool:opencode-server",
      "getToolLogs:opencode-server",
      "getFrpStatus",
      "startFrp",
      "stopFrp",
      "getCloudflareTunnelStatus",
      "startCloudflareTunnel",
      "stopCloudflareTunnel",
      "retryCloudflareTunnelStep:start_tunnel",
    ])
  })
})

describe("local management runtime endpoints", () => {
  it("normalizes saved endpoint URLs and forces client-supplied active status to disabled", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig(),
    })

    await runtime.saveEndpoint({ ...endpoint, domain: "https://code.example.com/path", status: "active" })

    const [saved] = await runtime.listEndpoints()
    expect(saved?.protocol).toBe("https")
    expect(saved?.domain).toBe("code.example.com")
    expect(saved?.status).toBe("disabled")
  })

  it("blocks enable when the target tool is not running", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig({ toolInstances: [{ ...runningOpenCode, status: "stopped" }], publicEndpoints: [endpoint] }),
    })

    const result = await runtime.enableEndpoint(endpoint.id)

    expect(result.status).toBe("failed")
    expect(result.message).toContain("not running")
    expect((await runtime.listEndpoints())[0]?.status).toBe("disabled")
  })

  it("blocks enable for duplicate active public addresses", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig({
        publicEndpoints: [
          { ...endpoint, id: "active-route", status: "active" },
          { ...endpoint, id: "next-route", domain: "https://code.example.com", status: "disabled" },
        ],
      }),
    })

    const result = await runtime.enableEndpoint("next-route")

    expect(result.status).toBe("failed")
    expect(result.message).toContain("already in use")
  })

  it("enables endpoints only after runtime safety checks pass", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig({ publicEndpoints: [endpoint] }),
    })

    const result = await runtime.enableEndpoint(endpoint.id)

    expect(result.status).toBe("succeeded")
    expect((await runtime.listEndpoints())[0]?.status).toBe("active")
  })
})

describe("local management runtime cloudflare tunnel", () => {
  it("blocks tunnel start when no cloudflare endpoint reports OpenCode password protection", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig({
        toolInstances: [
          runningOpenCode,
          {
            id: "cloudflared-server",
            kind: "cloudflared",
            displayName: "cloudflared",
            hostType: "server",
            installState: "installed",
            binaryPath: "cloudflared",
            defaultPort: 0,
            status: "stopped",
          },
        ],
        publicEndpoints: [
          {
            ...endpoint,
            id: "cloudflare-route",
            targetType: "cloudflare",
            authMode: "basic-auth",
          },
        ],
      }),
    })

    const result = await runtime.startCloudflareTunnel({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })

    expect(result.status).toBe("failed")
    expect(result.message).toContain("OpenCode password protection must be configured")
  })
})
