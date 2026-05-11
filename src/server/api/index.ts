import type { PublicEndpoint } from "../../core/app-config/types"
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

      if (path === "/api/runtime") {
        return jsonResponse(await adapter.getRuntimeInfo())
      }

      if (path === "/api/system/detect") {
        return jsonResponse(await adapter.detectTools())
      }

      if (path === "/api/tools") {
        const info = await adapter.getRuntimeInfo()
        return jsonResponse(info.config.toolInstances)
      }

      if (path === "/api/endpoints") {
        const info = await adapter.getRuntimeInfo()
        return jsonResponse(info.config.publicEndpoints satisfies PublicEndpoint[])
      }

      if (path === "/api/frp/status") {
        return jsonResponse(await adapter.getFrpStatus())
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}
