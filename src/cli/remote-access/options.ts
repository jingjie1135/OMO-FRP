import { DEFAULT_SERVER_PORT } from "../../shared/port-utils"
import type { FrpTransport, NormalizedRemoteAccessOptions, RemoteAccessOptions } from "./types"
import { assertStrongPassword } from "./password"

const DEFAULT_FRP_SERVER_PORT = 7000
const FRP_TRANSPORTS = new Set<FrpTransport>(["tcp", "kcp", "websocket", "quic"])

function normalizeHttpUrl(name: string, value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error(`${name} must use http or https`)
    }
    return url.toString().replace(/\/$/, "")
  } catch (error) {
    if (error instanceof Error && error.message === `${name} must use http or https`) {
      throw error
    }
    throw new Error(`${name} must be a valid URL`)
  }
}

function normalizeRpcUrl(value: string): string {
  try {
    const url = new URL(value)
    if (url.protocol !== "ws:" && url.protocol !== "wss:" && url.protocol !== "grpc:") {
      throw new Error("frp-panel RPC URL must use ws, wss, or grpc")
    }
    return url.toString().replace(/\/$/, "")
  } catch (error) {
    if (error instanceof Error && error.message === "frp-panel RPC URL must use ws, wss, or grpc") {
      throw error
    }
    throw new Error("frp-panel RPC URL must be a valid URL")
  }
}

function normalizePanelUrl(value: string): string {
  return normalizeHttpUrl("frp-panel URL", value)
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

function deriveClientId(): string {
  const user = process.env.USER ?? process.env.USERNAME ?? "desktop"
  return user.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-")
}

function deriveProxyName(): string {
  const user = process.env.USER ?? process.env.USERNAME ?? "desktop"
  return `opencode-${user}`.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-")
}

function derivePanelApiUrl(panelUrl: string, explicitApiUrl?: string): string {
  return explicitApiUrl ? normalizeHttpUrl("frp-panel API URL", explicitApiUrl) : panelUrl
}

function derivePanelRpcUrl(panelApiUrl: string, explicitRpcUrl?: string): string {
  if (explicitRpcUrl) {
    return normalizeRpcUrl(explicitRpcUrl)
  }

  const apiUrl = new URL(panelApiUrl)
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:"
  return `${protocol}//${apiUrl.host}/rpc`
}

export function normalizeRemoteAccessOptions(options: RemoteAccessOptions): NormalizedRemoteAccessOptions {
  const panelUrl = normalizePanelUrl(options.panelUrl)
  const panelApiUrl = derivePanelApiUrl(panelUrl, options.panelApiUrl)
  const panelRpcUrl = derivePanelRpcUrl(panelApiUrl, options.panelRpcUrl)
  const password = options.password ?? process.env.OPENCODE_SERVER_PASSWORD

  if (!password) {
    throw new Error("Set --password or OPENCODE_SERVER_PASSWORD before exposing OpenCode")
  }

  assertStrongPassword(password)

  if (!options.authToken) {
    throw new Error("frp-panel auth token is required")
  }

  if (options.remotePort !== undefined && (options.subdomain || options.customDomain)) {
    throw new Error("Use either --remote-port or domain routing, not both")
  }

  const proxyType = options.remotePort === undefined ? "http" : "tcp"

  return {
    panelUrl,
    panelApiUrl,
    panelRpcUrl,
    authToken: options.authToken,
    serverId: options.serverId,
    clientId: options.clientId ?? deriveClientId(),
    clientSecret: options.clientSecret,
    proxyName: options.proxyName ?? deriveProxyName(),
    frpBinary: options.frpBinary ?? (process.platform === "win32" ? "frp-panel.exe" : "frp-panel"),
    serverAddr: options.serverAddr ?? deriveServerAddr(panelUrl),
    serverPort: validatePort("server port", options.serverPort ?? DEFAULT_FRP_SERVER_PORT),
    transport: normalizeTransport(options.transport),
    proxyType,
    localHost: options.localHost ?? "127.0.0.1",
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
