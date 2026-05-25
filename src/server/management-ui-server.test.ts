import { afterEach, describe, expect, it } from "bun:test"
import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { FrpRouteProvisioningOptions } from "../cli/remote-access/types"
import { createManagementUiRequestHandler } from "./management-ui-server"

const tempDirs: string[] = []

afterEach(async () => {
  for (const directory of tempDirs.splice(0)) {
    await rm(directory, { force: true, recursive: true })
  }
})

describe("management UI HTTP server", () => {
  it("serves built index.html for app routes", async () => {
    const staticRoot = await createStaticRoot({ "index.html": "<div>OpenCode Remote Platform</div>" })
    const handler = createManagementUiRequestHandler({ staticRoot })

    const rootResponse = await handler(new Request("http://localhost/"))
    const nestedResponse = await handler(new Request("http://localhost/settings"))

    expect(rootResponse.status).toBe(200)
    expect(rootResponse.headers.get("content-type")).toContain("text/html")
    expect(await rootResponse.text()).toContain("OpenCode Remote Platform")
    expect(nestedResponse.status).toBe(200)
    expect(await nestedResponse.text()).toContain("OpenCode Remote Platform")
  })

  it("serves static assets with content type and returns 404 for missing assets", async () => {
    const staticRoot = await createStaticRoot({
      "index.html": "<div>OpenCode Remote Platform</div>",
      "assets/app.js": "console.log('management-ui')",
    })
    const handler = createManagementUiRequestHandler({ staticRoot })

    const assetResponse = await handler(new Request("http://localhost/assets/app.js"))
    const missingResponse = await handler(new Request("http://localhost/assets/missing.js"))

    expect(assetResponse.status).toBe(200)
    expect(assetResponse.headers.get("content-type")).toContain("text/javascript")
    expect(await assetResponse.text()).toContain("management-ui")
    expect(missingResponse.status).toBe(404)
  })

  it("routes API requests to the management API", async () => {
    const staticRoot = await createStaticRoot({ "index.html": "<div>OpenCode Remote Platform</div>" })
    const handler = createManagementUiRequestHandler({ staticRoot })

    const response = await handler(new Request("http://localhost/api/runtime"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.capabilities.mode).toBe("server")
  })


  it("wires desktop tunnel provisioning and device auth from server env", async () => {
    const staticRoot = await createStaticRoot({ "index.html": "<div>OpenCode Remote Platform</div>" })
    const routeOptions: FrpRouteProvisioningOptions[] = []
    const handler = createManagementUiRequestHandler({
      staticRoot,
      env: {
        ...process.env,
        MANAGEMENT_API_SESSION_TOKEN: "session-secret",
        DESKTOP_TUNNEL_DEVICE_TOKEN: "device-secret",
        DESKTOP_TUNNEL_PANEL_URL: "https://frp.example.com",
        DESKTOP_TUNNEL_PANEL_API_URL: "https://frp.example.com",
        DESKTOP_TUNNEL_PANEL_RPC_URL: "wss://frp.example.com/rpc",
        DESKTOP_TUNNEL_PANEL_AUTH_TOKEN: "restricted-frp-token",
        DESKTOP_TUNNEL_FRP_SERVER_ADDR: "frp.example.com",
        DESKTOP_TUNNEL_FRP_SERVER_PORT: "7000",
      },
      desktopTunnelProvisionRoute: async (options) => {
        routeOptions.push(options)
        return { status: "ready", publicUrl: "https://alice.frp.example.com", serverAddr: options.serverAddr, serverPort: options.serverPort, clientSecret: "desktop-client-secret" }
      },
    })

    const unauthorized = await handler(new Request("http://localhost/api/desktop-tunnels/provision", {
      method: "POST",
      body: JSON.stringify({ deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096 }),
    }))
    const provisionResponse = await handler(new Request("http://localhost/api/desktop-tunnels/provision", {
      method: "POST",
      headers: { authorization: "Bearer device-secret" },
      body: JSON.stringify({ deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, preferredSubdomain: "alice" }),
    }))
    const adminDenied = await handler(new Request("http://localhost/api/runtime"))
    const directBasicAuth = await handler(new Request("http://localhost/api/runtime", { headers: { authorization: "Basic b3BlbmNvZGU6cGFzc3dvcmQ=" } }))
    const adminResponse = await handler(new Request("http://localhost/api/runtime", { headers: { authorization: "Bearer session-secret" } }))
    const body = await provisionResponse.json()

    expect(unauthorized.status).toBe(401)
    expect(provisionResponse.status).toBe(200)
    expect(adminDenied.status).toBe(401)
    expect(directBasicAuth.status).toBe(401)
    expect(adminResponse.status).toBe(200)
    expect(routeOptions[0]?.authToken).toBe("restricted-frp-token")
    expect(routeOptions[0]?.panelRpcUrl).toBe("wss://frp.example.com/rpc")
    expect(routeOptions[0]?.serverAddr).toBe("frp.example.com")
    expect(routeOptions[0]?.serverPort).toBe(7000)
    expect(routeOptions[0]?.localHost).toBe("127.0.0.1")
    expect(body.frpcConfig).toContain('serverAddr = "frp.example.com"')
  })
  it("returns 400 for malformed encoded asset paths instead of crashing", async () => {
    const staticRoot = await createStaticRoot({ "index.html": "<div>OpenCode Remote Platform</div>" })
    const handler = createManagementUiRequestHandler({ staticRoot })

    const response = await handler(new Request("http://localhost/assets/%GG.js"))

    expect(response.status).toBe(400)
  })

  it("rejects path traversal asset requests", async () => {
    const staticRoot = await createStaticRoot({ "index.html": "<div>OpenCode Remote Platform</div>" })
    const handler = createManagementUiRequestHandler({ staticRoot })

    const response = await handler(new Request("http://localhost/..%2F..%2Fsecret.txt"))

    expect(response.status).toBe(404)
  })
})

async function createStaticRoot(files: Record<string, string>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "omo-frp-ui-"))
  tempDirs.push(directory)

  for (const [path, content] of Object.entries(files)) {
    const filePath = join(directory, path)
    await mkdir(join(filePath, ".."), { recursive: true })
    await Bun.write(filePath, content)
  }

  return directory
}
