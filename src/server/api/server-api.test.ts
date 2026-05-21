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

  it("supports Cloudflare Tunnel planning and lifecycle routes", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })
    const config = { mode: "quick", localHost: "127.0.0.1", localPort: 4096 }

    const statusResponse = await api.request("/api/cloudflare-tunnel/status", authenticated())
    const status = await statusResponse.json()
    const saveResponse = await api.request("/api/cloudflare-tunnel/config", postJson(config))
    const planResponse = await api.request("/api/cloudflare-tunnel/plan", postJson(config))
    const plan = await planResponse.json()
    const start = await (await api.request("/api/cloudflare-tunnel/start", postJson(config))).json()
    const stop = await (await api.request("/api/cloudflare-tunnel/stop", postJson(undefined))).json()
    const retry = await (await api.request("/api/cloudflare-tunnel/retry-step", postJson({ stepId: "configure_dns" }))).json()

    expect(statusResponse.status).toBe(200)
    expect(status).toMatchObject({ mode: "quick", running: false })
    expect(saveResponse.status).toBe(200)
    expect(planResponse.status).toBe(200)
    expect(plan).toMatchObject({ mode: "quick", localUrl: "http://127.0.0.1:4096" })
    expect(Array.isArray(plan.commandSummary)).toBe(true)
    expect(start.jobId).toContain("start-cloudflare")
    expect(stop.status).toBe("succeeded")
    expect(retry.jobId).toContain("retry-cloudflare")
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

  it("supports settings, security and backup summary routes", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    const security = await api.request("/api/settings/security-checks", authenticated())
    const backup = await api.request("/api/settings/backup-summary", authenticated())
    const manualBackup = await api.request("/api/settings/backups/manual", postJson(undefined))
    const cleanup = await api.request("/api/settings/backups/cleanup", postJson(undefined))
    const diagnostics = await api.request("/api/settings/diagnostics", authenticated())

    expect(security.status).toBe(200)
    expect(backup.status).toBe(200)
    expect(manualBackup.status).toBe(200)
    expect(cleanup.status).toBe(200)
    expect(diagnostics.status).toBe(200)
  })

  it("redacts direct settings diagnostics API responses", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    await api.request("/api/tools/install", postJson({ kind: "opencode" }))
    await api.request("/api/tools/install", postJson({ kind: "cloudflared" }))
    await api.request("/api/tools/opencode-server/start", postJson(undefined))
    await api.request("/api/endpoints", postJson({ id: "secret-route", name: "Secret Route", domain: "token.example.com?token=SECRET_QUERY", protocol: "https", targetType: "server-local", targetToolInstanceId: "opencode-server", authMode: "opencode-password", status: "disabled" }))
    await api.request("/api/config/save", postJson({ target: { toolInstanceId: "opencode-server", kind: "opencode", path: "/tmp/opencode.json" }, content: "{\"token\":\"SECRET_JSON\",\"password\":\"SECRET_PASSWORD\"}" }))
    await api.request("/api/cloudflare-tunnel/config", postJson({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 }))
    await api.request("/api/cloudflare-tunnel/start", postJson({ mode: "quick", localHost: "token.example.com?token=SECRET_QUERY", localPort: 4096 }))

    const response = await api.request("/api/settings/diagnostics", authenticated())
    const bodyText = await response.text()

    expect(response.status).toBe(200)
    expect(bodyText).not.toContain("SECRET_QUERY")
    expect(bodyText).not.toContain("SECRET_JSON")
    expect(bodyText).not.toContain("SECRET_PASSWORD")
    expect(bodyText).not.toContain("OPENCODE_SERVER_PASSWORD=SECRET")
    expect(bodyText).toContain('"redactedLogs"')
    expect(bodyText).toContain('"runtime"')
  })

  it("requires an administrator session for management endpoints", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    const response = await api.request("/api/runtime", { headers: {} })

    expect(response.status).toBe(401)
  })

  it("requires an administrator session when Docker control mode is enabled", async () => {
    const api = createServerApi({ dockerControlRequiresSession: true })

    const response = await api.request("/api/tools/opencode-server/restart", {
      method: "POST",
      headers: { "content-type": "application/json", "x-management-ui-request": "1" },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Docker control requires an administrator session token." })
  })

  it("requires an administrator session for FRP Docker control mode", async () => {
    const api = createServerApi({ dockerControlRequiresSession: true })

    const response = await api.request("/api/frp/start", {
      method: "POST",
      headers: { "content-type": "application/json", "x-management-ui-request": "1" },
    })

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Docker control requires an administrator session token." })
  })

  it("rejects mutating requests without a management UI request header", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    const response = await api.request(
      "/api/frp/start",
      {
        method: "POST",
        headers: { authorization: "Bearer session-secret", "content-type": "application/json" },
      },
    )

    expect(response.status).toBe(403)
  })

  it("allows mutating requests from the management UI request header", async () => {
    const api = createServerApi({ sessionToken: "session-secret" })

    const response = await api.request(
      "/api/tools/install",
      {
        method: "POST",
        headers: {
          authorization: "Bearer session-secret",
          "content-type": "application/json",
          "x-management-ui-request": "1",
        },
        body: JSON.stringify({ kind: "opencode" }),
      },
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe("succeeded")
  })
})

function authenticated(): RequestInit {
  return { headers: { authorization: "Bearer session-secret" } }
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: {
      authorization: "Bearer session-secret",
      "content-type": "application/json",
      "x-management-ui-request": "1",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }
}
