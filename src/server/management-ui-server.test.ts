import { afterEach, describe, expect, it } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { join } from "node:path"
import { tmpdir } from "node:os"
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

  it("uses persisted server runtime for default API requests", async () => {
    const staticRoot = await createStaticRoot({ "index.html": "<div>OpenCode Remote Platform</div>" })
    const stateRoot = await mkdtemp(join(tmpdir(), "omo-frp-ui-state-"))
    tempDirs.push(stateRoot)
    await mkdir(join(stateRoot, "config"), { recursive: true })
    await writeFile(join(stateRoot, "config", "app-config.json"), JSON.stringify({
      mode: "server",
      toolInstances: [],
      pluginConfigs: [],
      publicEndpoints: [],
      frpClients: [],
    }), "utf8")
    const server = createServer((_request, response) => {
      response.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/plain" })
      response.end("ok")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string") {
      throw new Error("HTTP test server did not expose a TCP port")
    }
    const previousRoot = process.env.OPENCODE_REMOTE_STATE_ROOT
    const previousUrl = process.env.OPENCODE_INTERNAL_URL
    const previousFrpPanelUrl = process.env.FRP_PANEL_INTERNAL_API_URL
    process.env.OPENCODE_REMOTE_STATE_ROOT = stateRoot
    process.env.OPENCODE_INTERNAL_URL = `http://127.0.0.1:${address.port}`
    process.env.FRP_PANEL_INTERNAL_API_URL = `http://127.0.0.1:${address.port}`

    try {
      const handler = await createManagementUiRequestHandler({ staticRoot })

      const detectResponse = await handler(new Request("http://localhost/api/system/detect"))
      const detectBody = await detectResponse.json()
      const frpResponse = await handler(new Request("http://localhost/api/frp/status"))
      const frpBody = await frpResponse.json()

      expect(detectResponse.status).toBe(200)
      expect(detectBody.some((tool: { kind?: string; detected?: boolean }) => tool.kind === "opencode" && tool.detected)).toBe(true)
      expect(frpResponse.status).toBe(200)
      expect(frpBody).toMatchObject({ mode: "server", running: true, status: "ready" })
    } finally {
      if (previousRoot === undefined) delete process.env.OPENCODE_REMOTE_STATE_ROOT
      else process.env.OPENCODE_REMOTE_STATE_ROOT = previousRoot
      if (previousUrl === undefined) delete process.env.OPENCODE_INTERNAL_URL
      else process.env.OPENCODE_INTERNAL_URL = previousUrl
      if (previousFrpPanelUrl === undefined) delete process.env.FRP_PANEL_INTERNAL_API_URL
      else process.env.FRP_PANEL_INTERNAL_API_URL = previousFrpPanelUrl
      server.close()
    }
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
