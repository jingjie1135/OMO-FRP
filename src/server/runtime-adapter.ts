import { SERVER_CAPABILITIES, type AppConfig, type RuntimeInfo } from "../core/app-config/types"
import type { FrpStatus, ToolDetection } from "../management-api/types"

export interface ServerRuntimeAdapter {
  getRuntimeInfo(): Promise<RuntimeInfo>
  detectTools(): Promise<ToolDetection[]>
  getFrpStatus(): Promise<FrpStatus>
}

export function createServerRuntimeAdapter(config: AppConfig = createEmptyServerConfig()): ServerRuntimeAdapter {
  return {
    async getRuntimeInfo(): Promise<RuntimeInfo> {
      return { capabilities: SERVER_CAPABILITIES, config }
    },
    async detectTools(): Promise<ToolDetection[]> {
      return []
    },
    async getFrpStatus(): Promise<FrpStatus> {
      return { mode: "server", running: false, message: "FRP server is not running yet." }
    },
  }
}

export function createEmptyServerConfig(): AppConfig {
  return {
    mode: "server",
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
  }
}
