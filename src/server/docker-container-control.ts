import { request as httpRequest } from "node:http"

export interface DockerContainerActionResult {
  ok: boolean
  message: string
}

export interface DockerContainerController {
  start(): Promise<DockerContainerActionResult>
  stop(): Promise<DockerContainerActionResult>
  restart(): Promise<DockerContainerActionResult>
}

export interface DockerTransportRequest {
  method: "GET" | "POST"
  path: string
}

export interface DockerTransportResponse {
  statusCode: number
  body: string
}

export type DockerTransport = (request: DockerTransportRequest) => Promise<DockerTransportResponse>

interface DockerContainerTarget {
  ok: boolean
  containerName?: string
  message?: string
}

export interface CreateDockerContainerControllerOptions {
  containerName?: string
  composeProject?: string
  composeService?: string
  displayName?: string
  socketPath?: string
  transport?: DockerTransport
}

export function createDockerContainerController(options: CreateDockerContainerControllerOptions = {}): DockerContainerController {
  const containerName = options.containerName ?? process.env.OPENCODE_CONTAINER_NAME ?? "opencode"
  const composeProject = options.composeProject ?? process.env.OPENCODE_COMPOSE_PROJECT
  const composeService = options.composeService ?? process.env.OPENCODE_COMPOSE_SERVICE ?? "opencode"
  const displayName = options.displayName ?? "OpenCode"
  const transport = options.transport ?? createDockerSocketTransport(options.socketPath ?? getDefaultDockerSocketPath())

  return {
    start() {
      return runContainerAction(transport, getContainerTarget, "start", `${displayName} container started.`, `${displayName} container is already running.`)
    },
    stop() {
      return runContainerAction(transport, getContainerTarget, "stop", `${displayName} container stopped.`, `${displayName} container is already stopped.`)
    },
    restart() {
      return runContainerAction(transport, getContainerTarget, "restart", `${displayName} container restarted.`)
    },
  }

  async function getContainerTarget(): Promise<DockerContainerTarget> {
    if (!composeProject) {
      return { ok: true, containerName }
    }

    const filters = encodeURIComponent(JSON.stringify({
      label: [
        `com.docker.compose.project=${composeProject}`,
        `com.docker.compose.service=${composeService}`,
      ],
    }))
    const response = await transport({ method: "GET", path: `/containers/json?all=true&filters=${filters}` })
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return {
        ok: false,
        message: `Docker Compose service discovery failed: Docker returned HTTP ${response.statusCode}: ${getDockerErrorMessage(response.body)}`,
      }
    }

    let containers: Array<{ Id?: unknown }>
    try {
      const parsed = JSON.parse(response.body) as unknown
      if (!Array.isArray(parsed)) {
        return { ok: false, message: "Docker Compose service discovery failed: invalid Docker response body." }
      }
      containers = parsed as Array<{ Id?: unknown }>
    } catch {
      return { ok: false, message: "Docker Compose service discovery failed: invalid Docker response body." }
    }

    const containerIds = containers.flatMap((container) => typeof container.Id === "string" ? [container.Id] : [])
    if (containerIds.length === 0) {
      return { ok: false, message: `Docker Compose service discovery found no containers for ${composeProject}/${composeService}.` }
    }
    if (containerIds.length > 1) {
      return { ok: false, message: `Docker Compose service discovery found multiple containers for ${composeProject}/${composeService}.` }
    }

    return { ok: true, containerName: containerIds[0] }
  }
}

function createDockerSocketTransport(socketPath: string): DockerTransport {
  return (request) => new Promise((resolve, reject) => {
    const clientRequest = httpRequest({
      socketPath,
      method: request.method,
      path: request.path,
      headers: { host: "docker" },
    }, (response) => {
      let body = ""
      response.setEncoding("utf8")
      response.on("data", (chunk) => { body += chunk })
      response.on("end", () => {
        resolve({ statusCode: response.statusCode ?? 0, body })
      })
    })
    clientRequest.on("error", reject)
    clientRequest.end()
  })
}

async function runContainerAction(
  transport: DockerTransport,
  getContainerTarget: () => Promise<DockerContainerTarget>,
  action: "start" | "stop" | "restart",
  successMessage: string,
  alreadyDoneMessage?: string,
): Promise<DockerContainerActionResult> {
  const target = await getContainerTarget()
  if (!target.ok || !target.containerName) {
    return { ok: false, message: target.message ?? "Docker container target could not be resolved." }
  }

  const containerName = target.containerName
  const response = await transport({ method: "POST", path: `/containers/${encodeURIComponent(containerName)}/${action}` })
  if (response.statusCode === 204) {
    return { ok: true, message: successMessage }
  }
  if (response.statusCode === 304 && alreadyDoneMessage) {
    return { ok: true, message: alreadyDoneMessage }
  }

  return { ok: false, message: `Docker returned HTTP ${response.statusCode}: ${getDockerErrorMessage(response.body)}` }
}

function getDockerErrorMessage(body: string): string {
  if (!body.trim()) {
    return "empty response body"
  }

  try {
    const parsed = JSON.parse(body) as { message?: unknown }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message
    }
  } catch {
    return body.trim()
  }

  return body.trim()
}

function getDefaultDockerSocketPath(): string {
  const explicitSocket = process.env.OPENCODE_DOCKER_SOCKET
  if (explicitSocket) {
    return explicitSocket
  }

  const dockerHost = process.env.DOCKER_HOST
  if (dockerHost?.startsWith("unix://")) {
    return dockerHost.slice("unix://".length)
  }
  if (dockerHost?.startsWith("npipe://")) {
    return dockerHost.slice("npipe://".length).replaceAll("/", "\\")
  }

  return process.platform === "win32" ? "\\\\.\\pipe\\docker_engine" : "/var/run/docker.sock"
}
