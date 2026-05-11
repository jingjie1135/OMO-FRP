import { DESKTOP_CAPABILITIES, type AppConfig, type RuntimeInfo } from "../core/app-config/types"
import type { ToolDetection } from "../management-api/types"

export async function getDesktopRuntimeInfo(config: AppConfig = createEmptyDesktopConfig()): Promise<RuntimeInfo> {
  return {
    capabilities: DESKTOP_CAPABILITIES,
    config,
  }
}

export async function detectDesktopTools(): Promise<ToolDetection[]> {
  return []
}

export function createEmptyDesktopConfig(): AppConfig {
  return {
    mode: "desktop",
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
  }
}
