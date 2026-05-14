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

    expect(calls.map((call) => call.input)).toEqual([
      "http://127.0.0.1:4098/api/tools/tool-1/start",
      "http://127.0.0.1:4098/api/tools/tool-1/stop",
      "http://127.0.0.1:4098/api/tools/tool-1/restart",
      "http://127.0.0.1:4098/api/endpoints/endpoint-1/enable",
      "http://127.0.0.1:4098/api/frp/start",
    ])
    expect(calls.every((call) => call.init?.method === "POST")).toBe(true)
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
