import { DEFAULT_SERVER_PORT } from "../../shared/port-utils"
import type { FrpTransport, NormalizedRemoteAccessOptions, RemoteAccessOptions } from "./types"
import { assertStrongPassword } from "./password"

const DEFAULT_FRP_SERVER_PORT = 7000
const FRP_TRANSPORTS = new Set<FrpTransport>(["tcp", "kcp", "websocket", "quic"])

function normalizePanelUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("frp-panel URL must use http or https")
    }
    return url.toString().replace(/\/$/, "")
  } catch (error) {
    if (error instanceof Error && error.message === "frp-panel URL must use http or https") {
      throw error
    }
    throw new Error("frp-panel URL must be a valid URL")
  }
}

function validatePort(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} must be between 1 and 65535`)
  }
  return value
}

function normalizeTransport(value: string | undefined): FrpTransport {
  const transport = value ?? "tcp"
  if (!FRP_TRANSPORTS.has(transport as FrpTransport)) {
    throw new Error("transport must be one of: tcp, kcp, websocket, quic")
  }
  return transport as FrpTransport
}

function deriveServerAddr(panelUrl: string): string {
  return new URL(panelUrl).hostname
}

function deriveProxyName(): string {
  const user = process.env.USER ?? process.env.USERNAME ?? "desktop"
  return `opencode-${user}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-")
}

export function normalizeRemoteAccessOptions(options: RemoteAccessOptions): NormalizedRemoteAccessOptions {
  const panelUrl = normalizePanelUrl(options.panelUrl)
  const password = options.password ?? process.env.OPENCODE_SERVER_PASSWORD

  if (!password) {
    throw new Error("Set --password or OPENCODE_SERVER_PASSWORD before exposing OpenCode")
  }

  assertStrongPassword(password)

  if (!options.authToken) {
    throw new Error("frp auth token is required")
  }

  if (options.remotePort !== undefined && (options.subdomain || options.customDomain)) {
    throw new Error("Use either --remote-port or domain routing, not both")
  }

  const proxyType = options.remotePort === undefined ? "http" : "tcp"

  return {
    panelUrl,
    authToken: options.authToken,
    proxyName: options.proxyName ?? deriveProxyName(),
    serverAddr: options.serverAddr ?? deriveServerAddr(panelUrl),
    serverPort: validatePort("server port", options.serverPort ?? DEFAULT_FRP_SERVER_PORT),
    transport: normalizeTransport(options.transport),
    proxyType,
    localPort: validatePort("local port", options.localPort ?? DEFAULT_SERVER_PORT),
    remotePort: options.remotePort === undefined ? undefined : validatePort("remote port", options.remotePort),
    subdomain: options.subdomain,
    customDomain: options.customDomain,
    https: options.https ?? true,
    password,
    username: options.username ?? process.env.OPENCODE_SERVER_USERNAME ?? "opencode",
    outputConfig: options.outputConfig,
    frpcBin: options.frpcBin ?? "frpc",
    noStart: options.noStart ?? false,
    noFrpc: options.noFrpc ?? false,
    json: options.json ?? false,
  }
}
