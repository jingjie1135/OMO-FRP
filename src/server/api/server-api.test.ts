import { describe, expect, it } from "bun:test"
import { createServerApi } from "./index"

describe("server api", () => {
  it("returns server runtime info", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })
    const response = await api.request("/api/runtime", authenticated())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.capabilities.mode).toBe("server")
    expect(body.capabilities.canManageFrpServer).toBe(true)
  })

  it("returns initial management collections", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    const detect = await (await api.request("/api/system/detect", authenticated())).json()
    const tools = await (await api.request("/api/tools", authenticated())).json()
    const endpoints = await (await api.request("/api/endpoints", authenticated())).json()
    const frpStatus = await (await api.request("/api/frp/status", authenticated())).json()

    expect(detect).toEqual([])
    expect(tools).toEqual([])
    expect(endpoints).toEqual([])
    expect(frpStatus).toMatchObject({ mode: "server", running: false })
  })

  it("supports management mutations through HTTP routes", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    const install = await (await api.request("/api/tools/install", postJson({ kind: "opencode" }))).json()
    const tools = await (await api.request("/api/tools", authenticated())).json()
    const configSave = await api.request(
      "/api/config/save",
      postJson({ target: { toolInstanceId: "opencode-server", kind: "opencode", path: "/tmp/opencode.json" }, content: "{}" }),
    )
    const configRead = await (await api.request("/api/config/read", postJson({ toolInstanceId: "opencode-server", kind: "opencode", path: "/tmp/opencode.json" }))).json()
    const frpSave = await api.request(
      "/api/frp/config",
      postJson({ enabled: true, panelUrl: "https://frp.example.com", rpcUrl: "https://frp.example.com/rpc", serverAddr: "frp.example.com", bindPort: 7000, authTokenRef: "FRP_TOKEN", dashboardEnabled: true }),
    )
    const frpStart = await (await api.request("/api/frp/start", postJson(undefined))).json()

    expect(install.status).toBe("succeeded")
    expect(tools).toHaveLength(1)
    expect(configSave.status).toBe(200)
    expect(configRead.content).toBe("{}")
    expect(frpSave.status).toBe(200)
    expect(frpStart.status).toBe("succeeded")
  })

  it("serves tool logs through the HTTP API", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    await api.request("/api/tools/install", postJson({ kind: "opencode" }))
    await (await api.request("/api/tools/opencode-server/start", postJson(undefined))).json()

    const logsResponse = await api.request("/api/tools/opencode-server/logs", authenticated())
    const logs = await logsResponse.json()

    expect(logsResponse.status).toBe(200)
    expect(Array.isArray(logs)).toBe(true)
    expect(logs.some((line: { message?: string }) => line.message?.includes("started"))).toBe(true)
  })

  it("requires an administrator session for management endpoints", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    const response = await api.request("/api/runtime", { headers: {} })

    expect(response.status).toBe(401)
  })
})

function authenticated(): RequestInit {
  return { headers: { authorization: "Bearer session-secret" } }
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { authorization: "Bearer session-secret", "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}
