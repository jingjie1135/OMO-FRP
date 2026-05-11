import type { ManagementClient } from "../../management-api/client"
import type { FrpStatus, RuntimeInfo, ToolDetection } from "../../management-api/types"
import type { PublicEndpoint } from "../../core/app-config/types"

export interface TauriInvokeBridge {
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>
}

export function createTauriManagementClient(bridge: TauriInvokeBridge): Pick<ManagementClient, "getRuntimeInfo" | "detectTools" | "listEndpoints" | "getFrpStatus"> {
  return {
    getRuntimeInfo(): Promise<RuntimeInfo> {
      return invokeTyped<RuntimeInfo>(bridge, "get_runtime_info")
    },
    detectTools(): Promise<ToolDetection[]> {
      return invokeTyped<ToolDetection[]>(bridge, "detect_tools")
    },
    listEndpoints(): Promise<PublicEndpoint[]> {
      return invokeTyped<PublicEndpoint[]>(bridge, "list_endpoints")
    },
    getFrpStatus(): Promise<FrpStatus> {
      return invokeTyped<FrpStatus>(bridge, "get_frp_status")
    },
  }
}

async function invokeTyped<T>(bridge: TauriInvokeBridge, command: string, args?: Record<string, unknown>): Promise<T> {
  return (await bridge.invoke(command, args)) as T
}
