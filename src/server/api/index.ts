import type { PublicEndpoint } from "../../core/app-config/types"
import type { CloudflareTunnelConfigRequest, CloudflareTunnelStepId, ConfigTarget, DesktopTunnelHeartbeatRequest, DesktopTunnelProcessStatus, DesktopTunnelConnectionStatus, DesktopTunnelProvisionRequest, FrpConfigRequest, InstallToolRequest } from "../../management-api/types"
import { createServerRuntimeAdapter, type ServerRuntimeAdapter } from "../runtime-adapter"

export interface ServerApi {
  request(path: string, init?: RequestInit): Promise<Response>
}

export interface ServerApiOptions {
  adapter?: ServerRuntimeAdapter
  sessionToken?: string
  deviceToken?: string
}

const DESKTOP_TUNNEL_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,62}$/
const PROCESS_STATUSES = new Set<DesktopTunnelProcessStatus>(["unknown", "starting", "running", "stopped", "error"])
const TUNNEL_STATUSES = new Set<DesktopTunnelConnectionStatus>(["unknown", "provisioning", "connected", "disconnected", "error"])

export function createServerApi(options: ServerApiOptions = {}): ServerApi {
  const adapter = options.adapter ?? createServerRuntimeAdapter()

  return {
    async request(path: string, init: RequestInit = {}): Promise<Response> {
      const method = (init.method ?? "GET").toUpperCase()

      if (path === "/api/desktop-tunnels/provision" && method === "POST") {
        if (!isRequiredAuthorized(init.headers, options.deviceToken)) return jsonResponse({ error: "Unauthorized" }, 401)
        const body = await parseJsonBody(init.body)
        const validation = toDesktopTunnelProvisionRequest(body)
        if (!validation.ok) return jsonResponse({ error: validation.error }, 400)
        return jsonResponse(await adapter.provisionDesktopTunnel(validation.value))
      }

      if (path === "/api/desktop-tunnels/heartbeat" && method === "POST") {
        if (!isRequiredAuthorized(init.headers, options.deviceToken)) return jsonResponse({ error: "Unauthorized" }, 401)
        const body = await parseJsonBody(init.body)
        const validation = toDesktopTunnelHeartbeatRequest(body)
        if (!validation.ok) return jsonResponse({ error: validation.error }, 400)
        return jsonResponse(await adapter.sendDesktopTunnelHeartbeat(validation.value))
      }

      if (!isAuthorized(init.headers, options.sessionToken)) {
        return jsonResponse({ error: "Unauthorized" }, 401)
      }
      if (!isManagementUiRequest(method, init.headers)) {
        return jsonResponse({ error: "Forbidden" }, 403)
      }

      const body = init.body ? await parseJsonBody(init.body) : undefined

      if (path === "/api/runtime" && method === "GET") {
        return jsonResponse(await adapter.getRuntimeInfo())
      }

      if (path === "/api/system/detect" && method === "GET") {
        return jsonResponse(await adapter.detectTools())
      }

      if (path === "/api/tools" && method === "GET") {
        return jsonResponse(await adapter.listToolInstances())
      }

      if (path === "/api/tools/install" && method === "POST") {
        return jsonResponse(await adapter.installTool(body as InstallToolRequest))
      }

      if (path.startsWith("/api/tools/") && path.endsWith("/start") && method === "POST") {
        return jsonResponse(await adapter.startTool(getResourceId(path, "/api/tools/", "/start")))
      }

      if (path.startsWith("/api/tools/") && path.endsWith("/stop") && method === "POST") {
        return jsonResponse(await adapter.stopTool(getResourceId(path, "/api/tools/", "/stop")))
      }

      if (path.startsWith("/api/tools/") && path.endsWith("/restart") && method === "POST") {
        return jsonResponse(await adapter.restartTool(getResourceId(path, "/api/tools/", "/restart")))
      }

      if (path.startsWith("/api/tools/") && path.endsWith("/logs") && method === "GET") {
        return jsonResponse(await adapter.getToolLogs(getResourceId(path, "/api/tools/", "/logs")))
      }

      if (path === "/api/config/read" && method === "POST") {
        return jsonResponse(await adapter.readConfig(body as ConfigTarget))
      }

      if (path === "/api/config/validate" && method === "POST") {
        const payload = body as { target: ConfigTarget; content: string }
        return jsonResponse(await adapter.validateConfig(payload.target, payload.content))
      }

      if (path === "/api/config/save" && method === "POST") {
        const payload = body as { target: ConfigTarget; content: string }
        await adapter.saveConfig(payload.target, payload.content)
        return jsonResponse({ ok: true })
      }

      if (path === "/api/config/presets" && method === "POST") {
        return jsonResponse(await adapter.listPresets(body as ConfigTarget))
      }

      if (path === "/api/config/presets/apply" && method === "POST") {
        const payload = body as { target: ConfigTarget; presetId: string }
        await adapter.applyPreset(payload.target, payload.presetId)
        return jsonResponse({ ok: true })
      }

      if (path === "/api/config/backups" && method === "POST") {
        return jsonResponse(await adapter.listBackups(body as ConfigTarget))
      }

      if (path === "/api/config/backups/restore" && method === "POST") {
        const payload = body as { target: ConfigTarget; backupId: string }
        await adapter.restoreBackup(payload.target, payload.backupId)
        return jsonResponse({ ok: true })
      }

      if (path === "/api/endpoints" && method === "GET") {
        return jsonResponse(await adapter.listEndpoints() satisfies PublicEndpoint[])
      }

      if (path === "/api/endpoints" && method === "POST") {
        await adapter.saveEndpoint(body as PublicEndpoint)
        return jsonResponse({ ok: true })
      }

      if (path.startsWith("/api/endpoints/") && path.endsWith("/enable") && method === "POST") {
        return jsonResponse(await adapter.enableEndpoint(getResourceId(path, "/api/endpoints/", "/enable")))
      }

      if (path.startsWith("/api/endpoints/") && path.endsWith("/disable") && method === "POST") {
        return jsonResponse(await adapter.disableEndpoint(getResourceId(path, "/api/endpoints/", "/disable")))
      }

      if (path === "/api/desktop-tunnels/devices" && method === "GET") {
        return jsonResponse(await adapter.listDesktopTunnelDevices())
      }

      if (path.startsWith("/api/desktop-tunnels/") && method === "DELETE") {
        await adapter.deleteDesktopTunnelDevice(path.slice("/api/desktop-tunnels/".length))
        return jsonResponse({ ok: true })
      }

      if (path === "/api/frp/status" && method === "GET") {
        return jsonResponse(await adapter.getFrpStatus())
      }

      if (path === "/api/frp/config" && method === "POST") {
        await adapter.saveFrpConfig(body as FrpConfigRequest)
        return jsonResponse({ ok: true })
      }

      if (path === "/api/frp/start" && method === "POST") {
        return jsonResponse(await adapter.startFrp())
      }

      if (path === "/api/frp/stop" && method === "POST") {
        return jsonResponse(await adapter.stopFrp())
      }

      if (path === "/api/cloudflare-tunnel/status" && method === "GET") {
        return jsonResponse(await adapter.getCloudflareTunnelStatus())
      }

      if (path === "/api/cloudflare-tunnel/config" && method === "POST") {
        await adapter.saveCloudflareTunnelConfig(body as CloudflareTunnelConfigRequest)
        return jsonResponse({ ok: true })
      }

      if (path === "/api/cloudflare-tunnel/plan" && method === "POST") {
        return jsonResponse(await adapter.createCloudflareTunnelPlan(body as CloudflareTunnelConfigRequest))
      }

      if (path === "/api/cloudflare-tunnel/start" && method === "POST") {
        return jsonResponse(await adapter.startCloudflareTunnel(body as CloudflareTunnelConfigRequest))
      }

      if (path === "/api/cloudflare-tunnel/stop" && method === "POST") {
        return jsonResponse(await adapter.stopCloudflareTunnel())
      }

      if (path === "/api/cloudflare-tunnel/retry-step" && method === "POST") {
        const payload = body as { stepId: CloudflareTunnelStepId }
        return jsonResponse(await adapter.retryCloudflareTunnelStep(payload.stepId))
      }

      if (path === "/api/settings/security-checks" && method === "GET") {
        return jsonResponse(await adapter.getSecurityChecks())
      }

      if (path === "/api/settings/backup-summary" && method === "GET") {
        return jsonResponse(await adapter.getBackupSummary())
      }

      if (path === "/api/settings/backups/manual" && method === "POST") {
        return jsonResponse(await adapter.runManualBackup())
      }

      if (path === "/api/settings/backups/cleanup" && method === "POST") {
        return jsonResponse(await adapter.cleanupOldBackups())
      }

      if (path === "/api/settings/diagnostics" && method === "GET") {
        return jsonResponse(await adapter.getDiagnostics())
      }

      return jsonResponse({ error: "Not found" }, 404)

    },
  }
}

function isManagementUiRequest(method: string, headers: HeadersInit | undefined): boolean {
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true
  }

  const normalizedHeaders = new Headers(headers)
  return normalizedHeaders.get("x-management-ui-request") === "1"
}

function isAuthorized(headers: HeadersInit | undefined, token: string | undefined): boolean {
  if (!token) {
    return true
  }

  const normalizedHeaders = new Headers(headers)
  return normalizedHeaders.get("authorization") === `Bearer ${token}`
}

function isRequiredAuthorized(headers: HeadersInit | undefined, token: string | undefined): boolean {
  if (!token) {
    return false
  }

  return isAuthorized(headers, token)
}

async function parseJsonBody(body: BodyInit | null | undefined): Promise<unknown> {
  if (body === undefined || body === null) {
    return undefined
  }
  if (typeof body === "string") {
    return JSON.parse(body)
  }
  if (body instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(body))
  }
  if (body instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(new Uint8Array(body)))
  }
  return JSON.parse(String(body))
}

function toDesktopTunnelProvisionRequest(body: unknown): { ok: true; value: DesktopTunnelProvisionRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return invalid("body")
  const request = body as Partial<DesktopTunnelProvisionRequest>
  if (!isTunnelName(request.deviceId)) return invalid("deviceId")
  if (typeof request.deviceName !== "string" || request.deviceName.trim() === "") return invalid("deviceName")
  if (!isLocalLoopback(request.localHost)) return invalid("localHost")
  if (!isPort(request.localPort)) return invalid("localPort")
  if (request.proxyName !== undefined && !isTunnelName(request.proxyName)) return invalid("proxyName")
  if (request.preferredSubdomain !== undefined && !isTunnelName(request.preferredSubdomain)) return invalid("preferredSubdomain")
  return { ok: true, value: request as DesktopTunnelProvisionRequest }
}

function toDesktopTunnelHeartbeatRequest(body: unknown): { ok: true; value: DesktopTunnelHeartbeatRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return invalid("body")
  const request = body as Partial<DesktopTunnelHeartbeatRequest>
  if (!isTunnelName(request.deviceId)) return invalid("deviceId")
  if (!request.opencodeStatus || !PROCESS_STATUSES.has(request.opencodeStatus)) return invalid("opencodeStatus")
  if (!request.frpcStatus || !PROCESS_STATUSES.has(request.frpcStatus)) return invalid("frpcStatus")
  if (!request.tunnelStatus || !TUNNEL_STATUSES.has(request.tunnelStatus)) return invalid("tunnelStatus")
  if (request.publicUrl !== undefined && !isHttpUrl(request.publicUrl)) return invalid("publicUrl")
  if (request.lastError !== undefined && request.lastError !== null && typeof request.lastError !== "string") return invalid("lastError")
  return { ok: true, value: request as DesktopTunnelHeartbeatRequest }
}

function invalid(field: string): { ok: false; error: string } {
  return { ok: false, error: `Invalid desktop tunnel ${field}` }
}

function isTunnelName(value: unknown): value is string {
  return typeof value === "string" && DESKTOP_TUNNEL_NAME_PATTERN.test(value)
}

function isLocalLoopback(value: unknown): value is string {
  return value === "127.0.0.1" || value === "localhost"
}

function isPort(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65_535
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function getResourceId(path: string, prefix: string, suffix: string): string {
  return path.slice(prefix.length, path.length - suffix.length)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
