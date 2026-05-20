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

test("keeps OpenCode container control disabled unless explicitly enabled", async () => {
  const calls: string[] = []
  const executor = createServerRuntimeExecutor({
    opencodeContainerController: {
      async start() {
        calls.push("start")
        return { ok: true, message: "started" }
      },
      async stop() {
        calls.push("stop")
        return { ok: true, message: "stopped" }
      },
      async restart() {
        calls.push("restart")
        return { ok: true, message: "restarted" }
      },
    },
  })

  const result = await executor.startTool("opencode-server")

  expect(result).toEqual({
    jobId: "start:opencode-server",
    status: "failed",
    message: "OpenCode container control is disabled. Set OPENCODE_CONTAINER_CONTROL_ENABLED=true and mount the Docker socket to enable it.",
  })
  expect(calls).toEqual([])
})

test("starts, stops, and restarts the OpenCode container when control is enabled", async () => {
  const calls: string[] = []
  const executor = createServerRuntimeExecutor({
    opencodeContainerControlEnabled: true,
    opencodeContainerController: {
      async start() {
        calls.push("start")
        return { ok: true, message: "OpenCode container started." }
      },
      async stop() {
        calls.push("stop")
        return { ok: true, message: "OpenCode container stopped." }
      },
      async restart() {
        calls.push("restart")
        return { ok: true, message: "OpenCode container restarted." }
      },
    },
  })

  const start = await executor.startTool("opencode-server")
  const stop = await executor.stopTool("opencode-server")
  const restart = await executor.restartTool("opencode-server")

  expect(start).toEqual({ jobId: "start:opencode-server", status: "succeeded", message: "OpenCode container started." })
  expect(stop).toEqual({ jobId: "stop:opencode-server", status: "succeeded", message: "OpenCode container stopped." })
  expect(restart).toEqual({ jobId: "restart:opencode-server", status: "succeeded", message: "OpenCode container restarted." })
  expect(calls).toEqual(["start", "stop", "restart"])
})

test("fails OpenCode container control when Docker reports an error", async () => {
  const executor = createServerRuntimeExecutor({
    opencodeContainerControlEnabled: true,
    opencodeContainerController: {
      async start() {
        return { ok: false, message: "Docker returned HTTP 404: no such container" }
      },
      async stop() {
        throw new Error("not used")
      },
      async restart() {
        throw new Error("not used")
      },
    },
  })

  const result = await executor.startTool("opencode-server")

  expect(result).toEqual({
    jobId: "start:opencode-server",
    status: "failed",
    message: "Docker returned HTTP 404: no such container",
  })
})

test("reports Docker socket failures as failed OpenCode jobs", async () => {
  const executor = createServerRuntimeExecutor({
    opencodeContainerControlEnabled: true,
    opencodeContainerController: {
      async start() {
        throw new Error("connect ENOENT /var/run/docker.sock")
      },
      async stop() {
        throw new Error("not used")
      },
      async restart() {
        throw new Error("not used")
      },
    },
  })

  const result = await executor.startTool("opencode-server")

  expect(result).toEqual({
    jobId: "start:opencode-server",
    status: "failed",
    message: "Docker container control failed: connect ENOENT /var/run/docker.sock",
  })
})
