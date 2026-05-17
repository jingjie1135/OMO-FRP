import type { PublicEndpoint } from "../../core/app-config/types"
import type { CloudflareTunnelConfigRequest, CloudflareTunnelStepId, ConfigTarget, FrpConfigRequest, InstallToolRequest } from "../../management-api/types"
import { createServerRuntimeAdapter, type ServerRuntimeAdapter } from "../runtime-adapter"

export interface ServerApi {
  request(path: string, init?: RequestInit): Promise<Response>
}

export interface ServerApiOptions {
  adapter?: ServerRuntimeAdapter
  sessionToken?: string
}

export function createServerApi(options: ServerApiOptions = {}): ServerApi {
  const adapter = options.adapter ?? createServerRuntimeAdapter()

  return {
    async request(path: string, init: RequestInit = {}): Promise<Response> {
      if (!isAuthorized(init.headers, options.sessionToken)) {
        return jsonResponse({ error: "Unauthorized" }, 401)
      }

      const method = (init.method ?? "GET").toUpperCase()
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

function isAuthorized(headers: HeadersInit | undefined, sessionToken: string | undefined): boolean {
  if (!sessionToken) {
    return true
  }

  const normalizedHeaders = new Headers(headers)
  return normalizedHeaders.get("authorization") === `Bearer ${sessionToken}`
}

async function parseJsonBody(body: BodyInit): Promise<unknown> {
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

function getResourceId(path: string, prefix: string, suffix: string): string {
  return path.slice(prefix.length, path.length - suffix.length)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
