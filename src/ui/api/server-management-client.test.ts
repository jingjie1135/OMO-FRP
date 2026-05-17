import { describe, expect, it } from "bun:test"
import { createServerManagementClient } from "./server-management-client"

describe("server management client", () => {
  it("loads runtime info from HTTP API", async () => {
    const client = createServerManagementClient({
      fetch: async () => new Response(JSON.stringify({ capabilities: { mode: "server" } }), { status: 200 }),
      baseUrl: "http://127.0.0.1:4098",
    })

    const info = await client.getRuntimeInfo()
    expect(info.capabilities.mode).toBe("server")
  })

  it("maps mutating requests to the management API", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = []
    const client = createServerManagementClient({
      baseUrl: "http://127.0.0.1:4098",
      fetch: async (input, init) => {
        calls.push({ input, init })
        return new Response(JSON.stringify({ jobId: "start:tool", status: "succeeded", message: "ok" }), { status: 200 })
      },
    })

    await client.startTool("tool-1")
    await client.stopTool("tool-1")
    await client.restartTool("tool-1")
    await client.enableEndpoint("endpoint-1")
    await client.startFrp()
    await client.startCloudflareTunnel({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })
    await client.stopCloudflareTunnel()
    await client.retryCloudflareTunnelStep("configure_dns")

    expect(calls.map((call) => call.input)).toEqual([
      "http://127.0.0.1:4098/api/tools/tool-1/start",
      "http://127.0.0.1:4098/api/tools/tool-1/stop",
      "http://127.0.0.1:4098/api/tools/tool-1/restart",
      "http://127.0.0.1:4098/api/endpoints/endpoint-1/enable",
      "http://127.0.0.1:4098/api/frp/start",
      "http://127.0.0.1:4098/api/cloudflare-tunnel/start",
      "http://127.0.0.1:4098/api/cloudflare-tunnel/stop",
      "http://127.0.0.1:4098/api/cloudflare-tunnel/retry-step",
    ])
    expect(calls.every((call) => call.init?.method === "POST")).toBe(true)
  })

  it("maps Cloudflare Tunnel read and config requests to HTTP API", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = []
    const client = createServerManagementClient({
      baseUrl: "http://127.0.0.1:4098",
      fetch: async (input, init) => {
        calls.push({ input, init })
        if (String(input).endsWith("/status")) {
          return new Response(JSON.stringify({ mode: "quick", running: false, message: "stopped" }), { status: 200 })
        }
        if (String(input).endsWith("/plan")) {
          return new Response(JSON.stringify({ mode: "quick", localUrl: "http://127.0.0.1:4096", commandSummary: [], cloudflaredDetected: true, diagnostics: [], securityNotes: [], steps: [] }), { status: 200 })
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    await client.getCloudflareTunnelStatus()
    await client.saveCloudflareTunnelConfig({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })
    await client.createCloudflareTunnelPlan({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })

    expect(calls.map((call) => call.input)).toEqual([
      "http://127.0.0.1:4098/api/cloudflare-tunnel/status",
      "http://127.0.0.1:4098/api/cloudflare-tunnel/config",
      "http://127.0.0.1:4098/api/cloudflare-tunnel/plan",
    ])
    expect(calls[0]?.init?.method).toBeUndefined()
    expect(calls[1]?.init?.method).toBe("POST")
    expect(calls[2]?.init?.method).toBe("POST")
  })

  it("maps security, backup and diagnostics requests to HTTP API", async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = []
    const client = createServerManagementClient({
      baseUrl: "http://127.0.0.1:4098",
      fetch: async (input, init) => {
        calls.push({ input, init })
        return new Response(JSON.stringify({}), { status: 200 })
      },
    })

    await client.getSecurityChecks()
    await client.getBackupSummary()
    await client.runManualBackup()
    await client.cleanupOldBackups()
    await client.getDiagnostics()

    expect(calls.map((call) => call.input)).toEqual([
      "http://127.0.0.1:4098/api/settings/security-checks",
      "http://127.0.0.1:4098/api/settings/backup-summary",
      "http://127.0.0.1:4098/api/settings/backups/manual",
      "http://127.0.0.1:4098/api/settings/backups/cleanup",
      "http://127.0.0.1:4098/api/settings/diagnostics",
    ])
    expect(calls[0]?.init?.method).toBeUndefined()
    expect(calls[1]?.init?.method).toBeUndefined()
    expect(calls[2]?.init?.method).toBe("POST")
    expect(calls[3]?.init?.method).toBe("POST")
    expect(calls[4]?.init?.method).toBeUndefined()
  })

  it("sends bearer authorization when a session token is configured", async () => {

    const calls: Array<{ input: string; init?: RequestInit }> = []
    const client = createServerManagementClient({
      baseUrl: "http://127.0.0.1:4098",
      sessionToken: "session-secret",
      fetch: async (input, init) => {
        calls.push({ input, init })
        return new Response(JSON.stringify({ jobId: "start:tool", status: "succeeded", message: "ok" }), { status: 200 })
      },
    })

    await client.startTool("tool-1")

    const headers = new Headers(calls[0]?.init?.headers)
    expect(headers.get("authorization")).toBe("Bearer session-secret")
    expect(headers.get("content-type")).toBe("application/json")
  })
})
