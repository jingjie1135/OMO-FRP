import { expect, test } from "bun:test"
import { createServer } from "node:http"
import type { CloudflaredProcessController } from "./cloudflared-process"
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

test("reports cloudflared when detection succeeds", async () => {
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
    const executor = createServerRuntimeExecutor({ opencodeUrl: `http://127.0.0.1:${address.port}`, cloudflaredDetected: true })

    const detections = await executor.detectTools()

    expect(detections.some((tool) => tool.kind === "cloudflared" && tool.detected && tool.binaryPath === "cloudflared")).toBe(true)
  } finally {
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
      async logs() {
        throw new Error("not used")
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
      async logs() {
        throw new Error("not used")
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

test("returns real OpenCode container logs when control is enabled", async () => {
  const executor = createServerRuntimeExecutor({
    opencodeContainerControlEnabled: true,
    opencodeContainerController: {
      async start() {
        throw new Error("not used")
      },
      async stop() {
        throw new Error("not used")
      },
      async restart() {
        throw new Error("not used")
      },
      async logs() {
        return {
          ok: true,
          logs: [{ timestamp: "2026-05-21T00:00:00.000Z", level: "info", message: "OpenCode listening" }],
        }
      },
    },
  })

  const logs = await executor.getToolLogs("opencode-server")

  expect(logs).toEqual([{ timestamp: "2026-05-21T00:00:00.000Z", level: "info", message: "OpenCode listening" }])
})

test("keeps FRP container control disabled unless explicitly enabled", async () => {
  const calls: string[] = []
  const executor = createServerRuntimeExecutor({
    frpContainerController: {
      async start() {
        calls.push("start")
        return { ok: true, message: "started" }
      },
      async stop() {
        calls.push("stop")
        return { ok: true, message: "stopped" }
      },
      async restart() {
        throw new Error("not used")
      },
      async logs() {
        throw new Error("not used")
      },
    },
  })

  const result = await executor.startFrp()

  expect(result).toEqual({
    jobId: "start-frp:server",
    status: "failed",
    message: "FRP container control is disabled. Set OPENCODE_CONTAINER_CONTROL_ENABLED=true and mount the Docker socket to enable it.",
  })
  expect(calls).toEqual([])
})

test("starts and stops the FRP container when Docker control is enabled", async () => {
  const calls: string[] = []
  const executor = createServerRuntimeExecutor({
    opencodeContainerControlEnabled: true,
    frpContainerController: {
      async start() {
        calls.push("start")
        return { ok: true, message: "FRP container started." }
      },
      async stop() {
        calls.push("stop")
        return { ok: true, message: "FRP container stopped." }
      },
      async restart() {
        throw new Error("not used")
      },
      async logs() {
        throw new Error("not used")
      },
    },
  })

  const start = await executor.startFrp()
  const stop = await executor.stopFrp()

  expect(start).toEqual({ jobId: "start-frp:server", status: "succeeded", message: "FRP container started." })
  expect(stop).toEqual({ jobId: "stop-frp:server", status: "succeeded", message: "FRP container stopped." })
  expect(calls).toEqual(["start", "stop"])
})

test("creates a Cloudflare quick tunnel plan with cloudflared detection", async () => {
  const executor = createServerRuntimeExecutor({ cloudflaredDetected: true })

  const plan = await executor.createCloudflareTunnelPlan({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })

  expect(plan).toMatchObject({
    mode: "quick",
    localUrl: "http://127.0.0.1:4096",
    publicUrl: "https://<generated>.trycloudflare.com",
    cloudflaredDetected: true,
    diagnostics: [],
    steps: [],
  })
  expect(plan.commandSummary).toEqual(["cloudflared tunnel --url http://127.0.0.1:4096"])
})

test("starts, reports, logs, and stops a managed Cloudflare quick tunnel", async () => {
  const calls: string[] = []
  let running = false
  let publicUrl: string | undefined
  const controller: CloudflaredProcessController = {
    async startQuickTunnel(localUrl) {
      calls.push(`start:${localUrl}`)
      running = true
      publicUrl = "https://alpha-beta.trycloudflare.com"
      return { ok: true, publicUrl, message: `Cloudflare quick tunnel is running at ${publicUrl}.` }
    },
    async stop() {
      calls.push("stop")
      running = false
      publicUrl = undefined
      return { ok: true, message: "Cloudflare quick tunnel stopped." }
    },
    status() {
      return { running, publicUrl }
    },
    logs() {
      return [{ timestamp: "2026-05-21T00:00:00.000Z", level: "info", message: "https://alpha-beta.trycloudflare.com" }]
    },
  }
  const executor = createServerRuntimeExecutor({ cloudflaredDetected: true, cloudflaredProcessController: controller })
  const config = { mode: "quick" as const, localHost: "127.0.0.1", localPort: 4096 }

  await executor.saveCloudflareTunnelConfig(config)
  const start = await executor.startCloudflareTunnel(config)
  const status = await executor.getCloudflareTunnelStatus()
  const logs = await executor.getToolLogs("cloudflared-server")
  const stop = await executor.stopCloudflareTunnel()

  expect(start).toEqual({ jobId: "start-cloudflare:server", status: "succeeded", message: "Cloudflare quick tunnel is running at https://alpha-beta.trycloudflare.com." })
  expect(status).toEqual({ mode: "quick", running: true, publicUrl: "https://alpha-beta.trycloudflare.com", currentStep: "verify_public_access", message: "Cloudflare quick tunnel is running at https://alpha-beta.trycloudflare.com." })
  expect(logs).toEqual([{ timestamp: "2026-05-21T00:00:00.000Z", level: "info", message: "https://alpha-beta.trycloudflare.com" }])
  expect(stop).toEqual({ jobId: "stop-cloudflare:server", status: "succeeded", message: "Cloudflare quick tunnel stopped." })
  expect(calls).toEqual(["start:http://127.0.0.1:4096", "stop"])
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
      async logs() {
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
      async logs() {
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
