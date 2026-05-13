import type { ManagementClient } from "../../management-api/client"
import type { ConfigTarget, FrpConfigRequest, InstallToolRequest } from "../../management-api/types"

export interface TauriInvokeBridge {
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>
}

export function createTauriManagementClient(bridge: TauriInvokeBridge): ManagementClient {
  return {
    getRuntimeInfo() {
      return invokeTyped(bridge, "get_runtime_info")
    },
    detectTools() {
      return invokeTyped(bridge, "detect_tools")
    },
    listToolInstances() {
      return invokeTyped(bridge, "list_tool_instances")
    },
    installTool(request: InstallToolRequest) {
      return invokeTyped(bridge, "install_tool", { request })
    },
    startTool(instanceId: string) {
      return invokeTyped(bridge, "start_tool", { instanceId })
    },
    stopTool(instanceId: string) {
      return invokeTyped(bridge, "stop_tool", { instanceId })
    },
    restartTool(instanceId: string) {
      return invokeTyped(bridge, "restart_tool", { instanceId })
    },
    getToolLogs(instanceId: string) {
      return invokeTyped(bridge, "get_tool_logs", { instanceId })
    },
    readConfig(target: ConfigTarget) {
      return invokeTyped(bridge, "read_config", { target })
    },
    saveConfig(target: ConfigTarget, content: string) {
      return invokeTyped(bridge, "save_config", { target, content })
    },
    listPresets(target: ConfigTarget) {
      return invokeTyped(bridge, "list_presets", { target })
    },
    applyPreset(target: ConfigTarget, presetId: string) {
      return invokeTyped(bridge, "apply_preset", { target, presetId })
    },
    listBackups(target: ConfigTarget) {
      return invokeTyped(bridge, "list_backups", { target })
    },
    restoreBackup(target: ConfigTarget, backupId: string) {
      return invokeTyped(bridge, "restore_backup", { target, backupId })
    },
    listEndpoints() {
      return invokeTyped(bridge, "list_endpoints")
    },
    saveEndpoint(endpoint) {
      return invokeTyped(bridge, "save_endpoint", { endpoint })
    },
    enableEndpoint(id: string) {
      return invokeTyped(bridge, "enable_endpoint", { id })
    },
    disableEndpoint(id: string) {
      return invokeTyped(bridge, "disable_endpoint", { id })
    },
    getFrpStatus() {
      return invokeTyped(bridge, "get_frp_status")
    },
    saveFrpConfig(config: FrpConfigRequest) {
      return invokeTyped(bridge, "save_frp_config", { config })
    },
    startFrp() {
      return invokeTyped(bridge, "start_frp")
    },
    stopFrp() {
      return invokeTyped(bridge, "stop_frp")
    },
  }
}

async function invokeTyped<T>(bridge: TauriInvokeBridge, command: string, args?: Record<string, unknown>): Promise<T> {
  return (await bridge.invoke(command, args)) as T
}
