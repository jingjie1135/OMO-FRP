import type { FrpFailureReason, FrpPanelClientResource, FrpPanelProxyResource } from "../../management-api/types"
import type { FrpRouteProvisioningOptions, RemoteAccessJoinCommand } from "./types"
import { buildPublicUrl } from "./public-url"

const API_PREFIX = "/api/v1"
const CLIENT_TYPE_FRPC = 1
const SUCCESS_CODE = 200
const NOT_FOUND_CODE = 404

interface FrpPanelBaseResponse<T> {
  code?: number
  msg?: string
  body?: T
}

interface FrpPanelClientRecord {
  id?: string
  secret?: string
  serverId?: string
  stopped?: boolean
  comment?: string
  frpsUrl?: string
  lastSeenAt?: number | bigint
}

interface FrpPanelServerRecord {
  id?: string
  ip?: string
  frpsUrls?: string[]
}

interface FrpPanelClientStatusRecord {
  status?: number
  ping?: number
  addr?: string
}

interface FrpPanelProxyConfigRecord {
  name?: string
  type?: string
  config?: string
  stopped?: boolean
}

interface FrpPanelProxyWorkingStatusRecord {
  name?: string
  type?: string
  status?: string
  err?: string
  remoteAddr?: string
}

interface FrpPanelProvisionResult {
  status: "idle" | "provisioning" | "ready" | "error"
  failureReason?: FrpFailureReason
  suggestion?: string
  clientSecret?: string
  client?: FrpPanelClientResource
  proxy?: FrpPanelProxyResource
  joinCommand?: RemoteAccessJoinCommand
  publicUrl: string
  serverAddr?: string
  serverPort?: number
}

class FrpPanelError extends Error {
  constructor(
    message: string,
    readonly reason: FrpFailureReason,
    readonly statusCode?: number,
    readonly notFound = false,
  ) {
    super(message)
  }
}

function normalizeBearerToken(token: string): string {
  return token.startsWith("Bearer ") ? token : `Bearer ${token}`
}

function isUnauthorized(message: string): boolean {
  return /unauthorized|invalid user|invalid token|forbidden/i.test(message)
}

function coerceLastSeen(value: number | bigint | undefined): string | undefined {
  if (value === undefined) {
    return undefined
  }

  const raw = typeof value === "bigint" ? Number(value) : value
  if (!Number.isFinite(raw) || raw <= 0) {
    return undefined
  }

  return new Date(raw).toISOString()
}

function encodeConfigBytes(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64")
}

function buildDesiredProxyConfig(options: FrpRouteProvisioningOptions): Record<string, unknown> {
  const config: Record<string, unknown> = {
    name: options.proxyName,
    type: options.proxyType,
    localIP: options.localHost,
    localPort: options.localPort,
  }

  if (options.proxyType === "http") {
    if (options.subdomain) {
      config.subdomain = options.subdomain
    }
    if (options.customDomain) {
      config.customDomains = [options.customDomain]
    }
  } else if (options.remotePort !== undefined) {
    config.remotePort = options.remotePort
  }

  return config
}

function configsEqual(existingConfig: string | undefined, desiredConfig: Record<string, unknown>): boolean {
  if (!existingConfig) {
    return false
  }

  try {
    const parsed = JSON.parse(existingConfig) as Record<string, unknown>
    return JSON.stringify(parsed) === JSON.stringify(desiredConfig)
  } catch {
    return false
  }
}

function buildJoinCommand(options: FrpRouteProvisioningOptions, client: FrpPanelClientRecord): RemoteAccessJoinCommand | undefined {
  if (!client.id || !client.secret) {
    return undefined
  }

  const args = [
    "client",
    "-s",
    client.secret,
    "-i",
    client.id,
    "--api-url",
    options.panelApiUrl,
    "--rpc-url",
    options.panelRpcUrl,
  ]

  return {
    command: options.frpBinary,
    args,
  }
}

function mapClientStatus(clientId: string, client: FrpPanelClientRecord, status: FrpPanelClientStatusRecord | undefined): FrpPanelClientResource {
  const state = status?.status === 1 ? "online" : status?.status === 2 ? "offline" : status?.status === 3 ? "error" : "unknown"
  return {
    id: client.id ?? clientId,
    status: state,
    lastSeenAt: coerceLastSeen(client.lastSeenAt),
    frpsUrl: client.frpsUrl,
  }
}

function mapProxyStatus(workingStatus: FrpPanelProxyWorkingStatusRecord | undefined, publicUrl: string): FrpPanelProxyResource | undefined {
  if (!workingStatus?.name && !workingStatus?.type && !workingStatus?.status) {
    return undefined
  }

  const state = workingStatus.status === "running"
    ? "running"
    : workingStatus.status === "stopped"
      ? "stopped"
      : workingStatus.status === "error"
        ? "error"
        : "unknown"

  return {
    name: workingStatus.name ?? "",
    type: workingStatus.type ?? "",
    status: state,
    remoteAddress: workingStatus.remoteAddr,
    publicUrl,
    error: workingStatus.err,
  }
}

async function postApi<T>(apiUrl: string, token: string, path: string, body: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiUrl}${API_PREFIX}${path}`, {
      method: "POST",
      headers: {
        authorization: normalizeBearerToken(token),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw new FrpPanelError(error instanceof Error ? error.message : String(error), "api_unreachable")
  }

  let payload: FrpPanelBaseResponse<T>
  try {
    payload = await response.json() as FrpPanelBaseResponse<T>
  } catch {
    payload = { code: response.status, msg: response.statusText }
  }

  const message = payload.msg ?? response.statusText ?? "frp-panel request failed"
  if (response.status === 401 || response.status === 403 || isUnauthorized(message)) {
    throw new FrpPanelError(message, "auth_failed", response.status)
  }
  if ((payload.code ?? response.status) === NOT_FOUND_CODE || /not found/i.test(message)) {
    throw new FrpPanelError(message, "unknown", response.status, true)
  }
  if (!response.ok || (payload.code !== undefined && payload.code !== SUCCESS_CODE)) {
    throw new FrpPanelError(message, "unknown", response.status)
  }

  return payload.body as T
}

async function probeApiUrl(apiUrl: string, token: string): Promise<void> {
  await postApi<{ userInfo?: { userName?: string } }>(apiUrl, token, "/user/get", {})
}

async function probeRpcUrl(rpcUrl: string): Promise<void> {
  const rpc = new URL(rpcUrl)
  const probe = new URL(rpc.pathname || "/", `${rpc.protocol === "wss:" ? "https:" : rpc.protocol === "ws:" || rpc.protocol === "grpc:" ? "http:" : rpc.protocol}//${rpc.host}`)
  let response: Response
  try {
    response = await fetch(probe.toString(), { method: "GET" })
  } catch (error) {
    throw new FrpPanelError(error instanceof Error ? error.message : String(error), "rpc_unreachable")
  }

  if (!response.ok && response.status >= 500) {
    throw new FrpPanelError(`frp-panel RPC probe failed: ${response.status}`, "rpc_unreachable", response.status)
  }
}

async function listServers(apiUrl: string, token: string): Promise<FrpPanelServerRecord[]> {
  const body = await postApi<{ servers?: FrpPanelServerRecord[] }>(apiUrl, token, "/server/list", {
    page: 1,
    pageSize: 100,
  })
  return body.servers ?? []
}

async function resolveServerId(options: FrpRouteProvisioningOptions): Promise<string> {
  if (options.serverId) {
    return options.serverId
  }

  const servers = await listServers(options.panelApiUrl, options.authToken)
  if (servers.length === 1 && servers[0]?.id) {
    return servers[0].id
  }
  if (servers.length === 0) {
    throw new FrpPanelError("No frp-panel server is configured for this account", "unknown")
  }
  throw new FrpPanelError("Multiple frp-panel servers are available; pass --server-id", "unknown")
}

async function getClient(apiUrl: string, token: string, clientId: string, serverId?: string): Promise<FrpPanelClientRecord | undefined> {
  try {
    const body = await postApi<{ client?: FrpPanelClientRecord }>(apiUrl, token, "/client/get", serverId ? { clientId, serverId } : { clientId })
    return body.client
  } catch (error) {
    if (error instanceof FrpPanelError && error.notFound) {
      return undefined
    }
    throw error
  }
}

async function initClient(apiUrl: string, token: string, clientId: string): Promise<string> {
  const body = await postApi<{ clientId?: string }>(apiUrl, token, "/client/init", {
    clientId,
    ephemeral: false,
  })
  if (!body.clientId) {
    throw new FrpPanelError("frp-panel did not return a client id", "unknown")
  }
  return body.clientId
}

async function getClientStatus(apiUrl: string, token: string, clientId: string): Promise<FrpPanelClientStatusRecord | undefined> {
  const body = await postApi<{ clients?: Record<string, FrpPanelClientStatusRecord> }>(apiUrl, token, "/platform/clientsstatus", {
    clientType: CLIENT_TYPE_FRPC,
    clientIds: [clientId],
  })
  return body.clients?.[clientId]
}

async function getProxyConfig(apiUrl: string, token: string, clientId: string, serverId: string, name: string): Promise<{ proxyConfig?: FrpPanelProxyConfigRecord, workingStatus?: FrpPanelProxyWorkingStatusRecord } | undefined> {
  try {
    const body = await postApi<{ proxyConfig?: FrpPanelProxyConfigRecord, workingStatus?: FrpPanelProxyWorkingStatusRecord }>(apiUrl, token, "/proxy/get_config", {
      clientId,
      serverId,
      name,
    })
    return body
  } catch (error) {
    if (error instanceof FrpPanelError && error.notFound) {
      return undefined
    }
    throw error
  }
}

async function createProxyConfig(apiUrl: string, token: string, clientId: string, serverId: string, proxyConfig: Record<string, unknown>): Promise<void> {
  await postApi(apiUrl, token, "/proxy/create_config", {
    clientId,
    serverId,
    overwrite: true,
    config: encodeConfigBytes({ proxies: [proxyConfig] }),
  })
}

async function updateProxyConfig(apiUrl: string, token: string, clientId: string, serverId: string, name: string, proxyConfig: Record<string, unknown>): Promise<void> {
  await postApi(apiUrl, token, "/proxy/update_config", {
    clientId,
    serverId,
    name,
    config: encodeConfigBytes({ proxies: [proxyConfig] }),
  })
}

async function startProxy(apiUrl: string, token: string, clientId: string, serverId: string, name: string): Promise<void> {
  await postApi(apiUrl, token, "/proxy/start_proxy", {
    clientId,
    serverId,
    name,
  })
}

function applyDerivedFrpsUrl(result: FrpPanelProvisionResult, serverScopedClient: FrpPanelClientRecord | undefined): void {
  const frpsUrl = serverScopedClient?.frpsUrl
  if (!frpsUrl) {
    return
  }

  try {
    const parsed = new URL(frpsUrl)
    result.serverAddr = parsed.hostname
    result.serverPort = parsed.port ? Number(parsed.port) : result.serverPort
  } catch {
    return
  }
}

export async function ensurePanelProvisioning(options: FrpRouteProvisioningOptions): Promise<FrpPanelProvisionResult> {
  const publicUrl = buildPublicUrl(options)

  try {
    await probeApiUrl(options.panelApiUrl, options.authToken)
    await probeRpcUrl(options.panelRpcUrl)

    const serverId = await resolveServerId(options)

    let client = await getClient(options.panelApiUrl, options.authToken, options.clientId)
    if (!client) {
      await initClient(options.panelApiUrl, options.authToken, options.clientId)
      client = await getClient(options.panelApiUrl, options.authToken, options.clientId)
    }
    if (!client?.id) {
      throw new FrpPanelError("frp-panel client was not created", "unknown")
    }

    const desiredProxyConfig = buildDesiredProxyConfig(options)
    const existingProxy = await getProxyConfig(options.panelApiUrl, options.authToken, options.clientId, serverId, options.proxyName)
    if (!existingProxy?.proxyConfig) {
      await createProxyConfig(options.panelApiUrl, options.authToken, options.clientId, serverId, desiredProxyConfig)
    } else if (!configsEqual(existingProxy.proxyConfig.config, desiredProxyConfig)) {
      await updateProxyConfig(options.panelApiUrl, options.authToken, options.clientId, serverId, options.proxyName, desiredProxyConfig)
    }

    const currentProxy = await getProxyConfig(options.panelApiUrl, options.authToken, options.clientId, serverId, options.proxyName)
    if (currentProxy?.proxyConfig?.stopped ?? true) {
      await startProxy(options.panelApiUrl, options.authToken, options.clientId, serverId, options.proxyName)
    }

    const serverScopedClient = await getClient(options.panelApiUrl, options.authToken, options.clientId, serverId)
    const clientStatus = await getClientStatus(options.panelApiUrl, options.authToken, client.id)
    const proxyStatus = await getProxyConfig(options.panelApiUrl, options.authToken, options.clientId, serverId, options.proxyName)

    const mappedClient = mapClientStatus(client.id, serverScopedClient ?? client, clientStatus)
    const mappedProxy = mapProxyStatus(proxyStatus?.workingStatus, publicUrl)
    const result: FrpPanelProvisionResult = {
      status: "provisioning",
      publicUrl,
      client: mappedClient,
      proxy: mappedProxy,
      clientSecret: client.secret,
      joinCommand: buildJoinCommand(options, client),
    }

    applyDerivedFrpsUrl(result, serverScopedClient)

    if (mappedClient.status !== "online") {
      return {
        ...result,
        status: "error",
        failureReason: "client_not_ready",
        suggestion: result.joinCommand
          ? `Start the local frp-panel client with: ${result.joinCommand.command} ${result.joinCommand.args.join(" ")}`
          : "Start the local frp-panel client with the restricted client secret from frp-panel.",
      }
    }

    if (!mappedProxy || mappedProxy.status === "stopped") {
      return {
        ...result,
        status: "error",
        failureReason: "proxy_not_ready",
        suggestion: "Wait for frp-panel to sync the proxy config and verify the local OpenCode service is reachable.",
      }
    }

    if (mappedProxy.status === "error" || mappedProxy.status === "unknown") {
      return {
        ...result,
        status: "error",
        failureReason: "proxy_not_ready",
        suggestion: mappedProxy.error || "Check the proxy config, local OpenCode service, and FRP route status in frp-panel.",
      }
    }

    return {
      ...result,
      status: "ready",
    }
  } catch (error) {
    if (error instanceof FrpPanelError) {
      return {
        status: "error",
        failureReason: error.reason,
        suggestion: error.reason === "auth_failed"
          ? "Use a restricted frp-panel token or restricted account credentials with client/proxy permissions."
          : error.reason === "api_unreachable"
            ? "Verify the frp-panel API URL and that the API endpoint is reachable from this machine."
            : error.reason === "rpc_unreachable"
              ? "Verify the frp-panel RPC URL, reverse proxy websocket/h2c settings, and TLS termination."
              : error.message,
        publicUrl,
      }
    }

    return {
      status: "error",
      failureReason: "unknown",
      suggestion: error instanceof Error ? error.message : String(error),
      publicUrl,
    }
  }
}
