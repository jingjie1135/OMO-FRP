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

  it("requires an administrator session for management endpoints", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    const response = await api.request("/api/runtime", { headers: {} })

    expect(response.status).toBe(401)
  })
})

function authenticated(): RequestInit {
  return { headers: { authorization: "Bearer session-secret" } }
}
