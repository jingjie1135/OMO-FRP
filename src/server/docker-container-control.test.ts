import { expect, test } from "bun:test"
import { createDockerContainerController } from "./docker-container-control"

test("starts a Docker container through the socket API", async () => {
  const requests: Array<{ method: string; path: string }> = []
  const controller = createDockerContainerController({
    containerName: "opencode-remote-opencode",
    transport: async (request) => {
      requests.push(request)
      return { statusCode: 204, body: "" }
    },
  })

  const result = await controller.start()

  expect(result).toEqual({ ok: true, message: "OpenCode container started." })
  expect(requests).toEqual([{ method: "POST", path: "/containers/opencode-remote-opencode/start" }])
})

test("discovers the OpenCode Docker Compose service when no container name is fixed", async () => {
  const requests: Array<{ method: string; path: string }> = []
  const controller = createDockerContainerController({
    composeProject: "omo-frp",
    composeService: "opencode",
    transport: async (request) => {
      requests.push(request)
      if (request.method === "GET") {
        return { statusCode: 200, body: JSON.stringify([{ Id: "container-123", State: "running" }]) }
      }
      return { statusCode: 204, body: "" }
    },
  })

  const result = await controller.restart()

  expect(result).toEqual({ ok: true, message: "OpenCode container restarted." })
  expect(requests[0]?.method).toBe("GET")
  expect(requests[0]?.path).toContain("/containers/json")
  expect(decodeURIComponent(requests[0]?.path ?? "")).toContain("com.docker.compose.project=omo-frp")
  expect(decodeURIComponent(requests[0]?.path ?? "")).toContain("com.docker.compose.service=opencode")
  expect(requests[1]).toEqual({ method: "POST", path: "/containers/container-123/restart" })
})

test("treats already running and already stopped Docker responses as successful", async () => {
  const controller = createDockerContainerController({
    containerName: "opencode-remote-opencode",
    transport: async () => ({ statusCode: 304, body: "" }),
  })

  await expect(controller.start()).resolves.toEqual({ ok: true, message: "OpenCode container is already running." })
  await expect(controller.stop()).resolves.toEqual({ ok: true, message: "OpenCode container is already stopped." })
})

test("reports Docker API errors without throwing", async () => {
  const controller = createDockerContainerController({
    containerName: "missing-opencode",
    transport: async () => ({ statusCode: 404, body: "no such container" }),
  })

  const result = await controller.restart()

  expect(result).toEqual({ ok: false, message: "Docker returned HTTP 404: no such container" })
})

test("reads timestamped Docker container logs and redacts secrets", async () => {
  const requests: Array<{ method: string; path: string }> = []
  const controller = createDockerContainerController({
    containerName: "opencode-remote-opencode",
    transport: async (request) => {
      requests.push(request)
      return { statusCode: 200, body: "2026-05-21T00:00:00.000000000Z started token=secret-token\n" }
    },
  })

  const result = await controller.logs()

  expect(result).toEqual({
    ok: true,
    logs: [{ timestamp: "2026-05-21T00:00:00.000000000Z", level: "info", message: "started token=[REDACTED]" }],
  })
  expect(requests).toEqual([{ method: "GET", path: "/containers/opencode-remote-opencode/logs?stdout=true&stderr=true&timestamps=true&tail=200" }])
})

test("decodes Docker multiplexed log frames before parsing timestamps", async () => {
  const controller = createDockerContainerController({
    containerName: "opencode-remote-opencode",
    transport: async () => ({
      statusCode: 200,
      body: createDockerLogFrame(1, "2026-05-21T00:00:00.000000000Z opencode server listening\n"),
    }),
  })

  const result = await controller.logs()

  expect(result).toEqual({
    ok: true,
    logs: [{ timestamp: "2026-05-21T00:00:00.000000000Z", level: "info", message: "opencode server listening" }],
  })
})

test("fails closed when compose discovery finds no OpenCode container", async () => {
  const requests: Array<{ method: string; path: string }> = []
  const controller = createDockerContainerController({
    composeProject: "omo-frp",
    composeService: "opencode",
    transport: async (request) => {
      requests.push(request)
      return { statusCode: 200, body: "[]" }
    },
  })

  const result = await controller.start()

  expect(result).toEqual({ ok: false, message: "Docker Compose service discovery found no containers for omo-frp/opencode." })
  expect(requests).toHaveLength(1)
})

test("fails closed when compose discovery finds multiple OpenCode containers", async () => {
  const requests: Array<{ method: string; path: string }> = []
  const controller = createDockerContainerController({
    composeProject: "omo-frp",
    composeService: "opencode",
    transport: async (request) => {
      requests.push(request)
      return { statusCode: 200, body: JSON.stringify([{ Id: "one" }, { Id: "two" }]) }
    },
  })

  const result = await controller.restart()

  expect(result).toEqual({ ok: false, message: "Docker Compose service discovery found multiple containers for omo-frp/opencode." })
  expect(requests).toHaveLength(1)
})

test("fails closed when compose discovery returns an API error", async () => {
  const requests: Array<{ method: string; path: string }> = []
  const controller = createDockerContainerController({
    composeProject: "omo-frp",
    composeService: "opencode",
    transport: async (request) => {
      requests.push(request)
      return { statusCode: 500, body: "daemon unavailable" }
    },
  })

  const result = await controller.stop()

  expect(result).toEqual({ ok: false, message: "Docker Compose service discovery failed: Docker returned HTTP 500: daemon unavailable" })
  expect(requests).toHaveLength(1)
})

test("fails closed when compose discovery returns invalid JSON", async () => {
  const requests: Array<{ method: string; path: string }> = []
  const controller = createDockerContainerController({
    composeProject: "omo-frp",
    composeService: "opencode",
    transport: async (request) => {
      requests.push(request)
      return { statusCode: 200, body: "not-json" }
    },
  })

  const result = await controller.restart()

  expect(result).toEqual({ ok: false, message: "Docker Compose service discovery failed: invalid Docker response body." })
  expect(requests).toHaveLength(1)
})

function createDockerLogFrame(stream: 1 | 2, payload: string): string {
  const header = new Uint8Array(8)
  header[0] = stream
  header[4] = (payload.length >>> 24) & 0xff
  header[5] = (payload.length >>> 16) & 0xff
  header[6] = (payload.length >>> 8) & 0xff
  header[7] = payload.length & 0xff
  return `${String.fromCharCode(...header)}${payload}`
}
