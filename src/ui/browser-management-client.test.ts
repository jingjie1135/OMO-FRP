import { describe, expect, it } from "bun:test"
import { createBrowserManagementClient } from "./browser-management-client"

describe("createBrowserManagementClient", () => {
  it("uses the Tauri invoke bridge when it is available", async () => {
    const commands: string[] = []
    const client = createBrowserManagementClient({
      fetch: async () => new Response(null, { status: 500 }),
      tauri: {
        async invoke(command: string) {
          commands.push(command)
          return {
            capabilities: {
              mode: "desktop",
              canManageFrpServer: false,
              canManageFrpClient: true,
              canInstallServerServices: false,
              canAccessLocalFilesystem: true,
              canManageSystemd: false,
              canManageLocalProcesses: true,
            },
            config: {
              mode: "desktop",
              toolInstances: [],
              pluginConfigs: [],
              publicEndpoints: [],
              frpClients: [],
            },
          }
        },
      },
    })

    const info = await client.getRuntimeInfo()

    expect(info.capabilities.mode).toBe("desktop")
    expect(commands).toEqual(["get_runtime_info"])
  })

  it("uses the server HTTP client when Tauri is unavailable", async () => {
    const requests: string[] = []
    const client = createBrowserManagementClient({
      fetch: async (input) => {
        requests.push(String(input))
        return Response.json({
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
        })
      },
    })

    const info = await client.getRuntimeInfo()

    expect(info.capabilities.mode).toBe("server")
    expect(requests).toEqual(["/api/runtime"])
  })

  it("passes the session token to the server HTTP client", async () => {
    const authorizations: Array<string | null> = []
    const client = createBrowserManagementClient({
      sessionToken: "session-secret",
      fetch: async (_input, init) => {
        authorizations.push(new Headers(init?.headers).get("authorization"))
        return Response.json({ jobId: "start", status: "succeeded", message: "ok" })
      },
    })

    await client.startTool("opencode-server")

    expect(authorizations).toEqual(["Bearer session-secret"])
  })

  it("uses a browser-provided management session token", async () => {
    const previousWindow = globalThis.window
    const authorizations: Array<string | null> = []
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { __OPENCODE_MANAGEMENT_SESSION_TOKEN__: "browser-session" },
    })
    const client = createBrowserManagementClient({
      fetch: async (_input, init) => {
        authorizations.push(new Headers(init?.headers).get("authorization"))
        return Response.json({ jobId: "restart", status: "succeeded", message: "ok" })
      },
    })

    try {
      await client.restartTool("opencode-server")

      expect(authorizations).toEqual(["Bearer browser-session"])
    } finally {
      Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow })
    }
  })
})
