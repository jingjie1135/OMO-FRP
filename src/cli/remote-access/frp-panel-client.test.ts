import { beforeEach, describe, expect, it, mock } from "bun:test"
import { ensurePanelProvisioning } from "./frp-panel-client"
import { normalizeRemoteAccessOptions } from "./options"

const mockFetch = mock<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => new Response("{}"))

describe("frp-panel client adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  it("provisions client and proxy until ready", async () => {
    const calls: Array<{ path: string; body: Record<string, unknown> }> = []
    mockFetch.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}
      calls.push({ path: url, body })

      if (url.endsWith("/api/v1/user/get")) {
        return ok({ userInfo: { userName: "alice" } })
      }
      if (url.endsWith("/rpc")) {
        return new Response("ok", { status: 200 })
      }
      if (url.endsWith("/api/v1/server/list")) {
        return ok({ servers: [{ id: "server-a" }] })
      }
      if (url.endsWith("/api/v1/client/get") && !body.serverId) {
        return ok({ client: { id: "desktop-a", secret: "client-secret" } })
      }
      if (url.endsWith("/api/v1/client/get") && body.serverId) {
        return ok({ client: { id: "desktop-a", secret: "client-secret", frpsUrl: "tcp://frp.example.com:7000" } })
      }
      if (url.endsWith("/api/v1/proxy/get_config")) {
        return ok({
          proxyConfig: { name: "opencode-test", type: "http", config: JSON.stringify({ name: "opencode-test", type: "http", localIP: "127.0.0.1", localPort: 4096, subdomain: "alice-code" }), stopped: false },
          workingStatus: { name: "opencode-test", type: "http", status: "running", remoteAddr: "alice-code.example.com" },
        })
      }
      if (url.endsWith("/api/v1/platform/clientsstatus")) {
        return ok({ clients: { "desktop-a": { status: 1 } } })
      }
      if (url.endsWith("/api/v1/proxy/start_proxy") || url.endsWith("/api/v1/proxy/create_config") || url.endsWith("/api/v1/proxy/update_config")) {
        return ok({})
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    const result = await ensurePanelProvisioning(normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com",
      authToken: "restricted-token",
      password: "Strong-password-123!",
      proxyName: "opencode-test",
      subdomain: "alice-code",
      noFrpc: true,
    }))

    expect(result.status).toBe("ready")
    expect(result.client).toMatchObject({ id: "desktop-a", status: "online" })
    expect(result.proxy).toMatchObject({ name: "opencode-test", status: "running" })
    expect(result.publicUrl).toBe("https://alice-code.frp.example.com")
    expect(calls.some((call) => call.path.endsWith("/api/v1/server/list"))).toBe(true)
  })

  it("uses the requested local host in frp-panel proxy config", async () => {
    const createdConfigs: Record<string, unknown>[] = []
    mockFetch.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}

      if (url.endsWith("/api/v1/user/get")) return ok({ userInfo: { userName: "alice" } })
      if (url.endsWith("/rpc")) return new Response("ok", { status: 200 })
      if (url.endsWith("/api/v1/server/list")) return ok({ servers: [{ id: "server-a" }] })
      if (url.endsWith("/api/v1/client/get")) return ok({ client: { id: "desktop-a", secret: "client-secret", frpsUrl: "tcp://frp.example.com:7000" } })
      if (url.endsWith("/api/v1/proxy/get_config")) return ok({ workingStatus: { name: "opencode-test", type: "http", status: "running" } })
      if (url.endsWith("/api/v1/proxy/create_config")) {
        const decoded = JSON.parse(Buffer.from(body.config as string, "base64").toString("utf8")) as { proxies: Record<string, unknown>[] }
        createdConfigs.push(decoded.proxies[0]!)
        return ok({})
      }
      if (url.endsWith("/api/v1/platform/clientsstatus")) return ok({ clients: { "desktop-a": { status: 1 } } })
      if (url.endsWith("/api/v1/proxy/start_proxy")) return ok({})
      throw new Error(`Unexpected request: ${url}`)
    })

    await ensurePanelProvisioning({
      panelUrl: "https://frp.example.com",
      panelApiUrl: "https://frp.example.com",
      panelRpcUrl: "wss://frp.example.com/rpc",
      authToken: "restricted-token",
      clientId: "desktop-a",
      proxyName: "opencode-test",
      frpBinary: "frp-panel",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      transport: "tcp",
      proxyType: "http",
      localHost: "127.0.0.2",
      localPort: 4096,
      subdomain: "alice-code",
      https: true,
    })

    expect(createdConfigs[0]).toMatchObject({ localIP: "127.0.0.2" })
  })
  it("classifies authentication failures", async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("/api/v1/user/get")) {
        return new Response(JSON.stringify({ code: 401, msg: "unauthorized" }), { status: 401, headers: { "content-type": "application/json" } })
      }
      return new Response("ok", { status: 200 })
    })

    const result = await ensurePanelProvisioning(normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com",
      authToken: "bad-token",
      password: "Strong-password-123!",
      proxyName: "opencode-test",
      subdomain: "alice-code",
      noFrpc: true,
    }))

    expect(result.status).toBe("error")
    expect(result.failureReason).toBe("auth_failed")
  })

  it("returns client_not_ready with join command when client is offline", async () => {
    mockFetch.mockImplementation(async (input, init) => {
      const url = String(input)
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}

      if (url.endsWith("/api/v1/user/get")) {
        return ok({ userInfo: { userName: "alice" } })
      }
      if (url.endsWith("/rpc")) {
        return new Response("ok", { status: 200 })
      }
      if (url.endsWith("/api/v1/server/list")) {
        return ok({ servers: [{ id: "server-a" }] })
      }
      if (url.endsWith("/api/v1/client/get") && !body.serverId) {
        return ok({ client: { id: "desktop-a", secret: "client-secret" } })
      }
      if (url.endsWith("/api/v1/client/get") && body.serverId) {
        return ok({ client: { id: "desktop-a", secret: "client-secret", frpsUrl: "tcp://frp.example.com:7000" } })
      }
      if (url.endsWith("/api/v1/proxy/get_config")) {
        return ok({
          proxyConfig: { name: "opencode-test", type: "http", config: JSON.stringify({ name: "opencode-test", type: "http", localIP: "127.0.0.1", localPort: 4096, subdomain: "alice-code" }), stopped: false },
          workingStatus: { name: "opencode-test", type: "http", status: "stopped" },
        })
      }
      if (url.endsWith("/api/v1/platform/clientsstatus")) {
        return ok({ clients: { "desktop-a": { status: 2 } } })
      }
      if (url.endsWith("/api/v1/proxy/start_proxy")) {
        return ok({})
      }

      throw new Error(`Unexpected request: ${url}`)
    })

    const result = await ensurePanelProvisioning(normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com",
      authToken: "restricted-token",
      password: "Strong-password-123!",
      clientId: "desktop-a",
      proxyName: "opencode-test",
      subdomain: "alice-code",
      noFrpc: true,
    }))

    expect(result.status).toBe("error")
    expect(result.failureReason).toBe("client_not_ready")
    expect(result.joinCommand?.args).toContain("desktop-a")
  })

  it("classifies rpc probe failures", async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("/api/v1/user/get")) {
        return ok({ userInfo: { userName: "alice" } })
      }
      throw new Error(`network error for ${url}`)
    })

    const result = await ensurePanelProvisioning(normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com",
      authToken: "restricted-token",
      password: "Strong-password-123!",
      proxyName: "opencode-test",
      subdomain: "alice-code",
      noFrpc: true,
    }))

    expect(result.failureReason === "api_unreachable" || result.failureReason === "rpc_unreachable").toBe(true)
  })
})

function ok(body: unknown): Response {
  return new Response(JSON.stringify({ code: 200, msg: "ok", body }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })
}
