import type { ManagementClient } from "../../management-api/client"
import type { FrpStatus, RuntimeInfo, ToolDetection } from "../../management-api/types"
import type { PublicEndpoint } from "../../core/app-config/types"

export interface ServerManagementClientOptions {
  baseUrl: string
  fetch: (input: string, init?: RequestInit) => Promise<Response>
}

export function createServerManagementClient(options: ServerManagementClientOptions): Pick<ManagementClient, "getRuntimeInfo" | "detectTools" | "listEndpoints" | "getFrpStatus"> {
  return {
    getRuntimeInfo(): Promise<RuntimeInfo> {
      return getJson<RuntimeInfo>(options, "/api/runtime")
    },
    detectTools(): Promise<ToolDetection[]> {
      return getJson<ToolDetection[]>(options, "/api/system/detect")
    },
    listEndpoints(): Promise<PublicEndpoint[]> {
      return getJson<PublicEndpoint[]>(options, "/api/endpoints")
    },
    getFrpStatus(): Promise<FrpStatus> {
      return getJson<FrpStatus>(options, "/api/frp/status")
    },
  }
}

async function getJson<T>(options: ServerManagementClientOptions, path: string): Promise<T> {
  const response = await options.fetch(`${options.baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`Management API request failed: ${response.status} ${path}`)
  }
  return response.json() as Promise<T>
}
