import { expect, test } from "bun:test"
import { createServer } from "node:http"
import { createServerRuntimeExecutor } from "./server-runtime-executor"

test("detects OpenCode as running when health endpoint responds", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/plain" })
    response.end("ok")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("HTTP test server did not expose a TCP port")
  }

  try {
    const executor = createServerRuntimeExecutor({
      opencodeUrl: `http://127.0.0.1:${address.port}`,
    })

    const detections = await executor.detectTools()

    expect(detections.some((tool) => tool.kind === "opencode" && tool.detected)).toBe(true)
  } finally {
    server.close()
  }
})

test("reports FRP server ready when frp-panel is reachable", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/plain" })
    response.end("ok")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("HTTP test server did not expose a TCP port")
  }

  try {
    const executor = createServerRuntimeExecutor({
      frpPanelUrl: `http://127.0.0.1:${address.port}`,
    })

    const status = await executor.getFrpStatus()

    expect(status).toEqual({
      mode: "server",
      running: true,
      status: "ready",
      message: "frp-panel is reachable at HTTP 200.",
    })
  } finally {
    server.close()
  }
})

test("reports FRP server API failure from frp-panel health", async () => {
  const executor = createServerRuntimeExecutor({
    frpPanelClient: {
      async health() {
        return { reachable: true, status: 503 }
      },
    },
  })

  const status = await executor.getFrpStatus()

  expect(status).toMatchObject({
    mode: "server",
    running: false,
    status: "error",
    failureReason: "api_unreachable",
    message: "frp-panel API returned HTTP 503.",
    suggestion: "Verify the frp-panel API URL and that the API endpoint is reachable from the management-ui container.",
  })
})

test("uses the FRP panel internal API environment URL", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "access-control-allow-origin": "*", "content-type": "text/plain" })
    response.end("ok")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("HTTP test server did not expose a TCP port")
  }
  const previousUrl = process.env.FRP_PANEL_INTERNAL_API_URL
  process.env.FRP_PANEL_INTERNAL_API_URL = `http://127.0.0.1:${address.port}`

  try {
    const executor = createServerRuntimeExecutor()

    const status = await executor.getFrpStatus()

    expect(status.running).toBe(true)
  } finally {
    if (previousUrl === undefined) delete process.env.FRP_PANEL_INTERNAL_API_URL
    else process.env.FRP_PANEL_INTERNAL_API_URL = previousUrl
    server.close()
  }
})
