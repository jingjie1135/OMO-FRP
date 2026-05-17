import type { SettingsManagementClient } from "../../management-api/client"
import type { CloudflareTunnelConfigRequest, CloudflareTunnelStepId, ConfigTarget, FrpConfigRequest, InstallToolRequest } from "../../management-api/types"

export interface TauriInvokeBridge {
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>
}

export function createTauriManagementClient(bridge: TauriInvokeBridge): SettingsManagementClient {
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
      return invokeTyped(bridge, "start_tool", { instance_id: instanceId })
    },
    stopTool(instanceId: string) {
      return invokeTyped(bridge, "stop_tool", { instance_id: instanceId })
    },
    restartTool(instanceId: string) {
      return invokeTyped(bridge, "restart_tool", { instance_id: instanceId })
    },
    getToolLogs(instanceId: string) {
      return invokeTyped(bridge, "get_tool_logs", { instance_id: instanceId })
    },
    readConfig(target: ConfigTarget) {
      return invokeTyped(bridge, "read_config", { target })
    },
    validateConfig(target: ConfigTarget, content: string) {
      return invokeTyped(bridge, "validate_config", { target, content })
    },
    saveConfig(target: ConfigTarget, content: string) {
      return invokeTyped(bridge, "save_config", { target, content })
    },
    listPresets(target: ConfigTarget) {
      return invokeTyped(bridge, "list_presets", { target })
    },
    applyPreset(target: ConfigTarget, presetId: string) {
      return invokeTyped(bridge, "apply_preset", { target, preset_id: presetId })
    },
    listBackups(target: ConfigTarget) {
      return invokeTyped(bridge, "list_backups", { target })
    },
    restoreBackup(target: ConfigTarget, backupId: string) {
      return invokeTyped(bridge, "restore_backup", { target, backup_id: backupId })
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
    getCloudflareTunnelStatus() {
      return invokeTyped(bridge, "get_cloudflare_tunnel_status")
    },
    saveCloudflareTunnelConfig(config: CloudflareTunnelConfigRequest) {
      return invokeTyped(bridge, "save_cloudflare_tunnel_config", { config })
    },
    createCloudflareTunnelPlan(config: CloudflareTunnelConfigRequest) {
      return invokeTyped(bridge, "create_cloudflare_tunnel_plan", { config })
    },
    startCloudflareTunnel(config: CloudflareTunnelConfigRequest) {
      return invokeTyped(bridge, "start_cloudflare_tunnel", { config })
    },
    stopCloudflareTunnel() {
      return invokeTyped(bridge, "stop_cloudflare_tunnel")
    },
    retryCloudflareTunnelStep(stepId: CloudflareTunnelStepId) {
      return invokeTyped(bridge, "retry_cloudflare_tunnel_step", { step_id: stepId })
    },
    getSecurityChecks() {
      return invokeTyped(bridge, "get_security_checks")
    },
    getBackupSummary() {
      return invokeTyped(bridge, "get_backup_summary")
    },
    runManualBackup() {
      return invokeTyped(bridge, "run_manual_backup")
    },
    cleanupOldBackups() {
      return invokeTyped(bridge, "cleanup_old_backups")
    },
    getDiagnostics() {
      return invokeTyped(bridge, "get_diagnostics")
    },
  }
}


async function invokeTyped<T>(bridge: TauriInvokeBridge, command: string, args?: Record<string, unknown>): Promise<T> {
  return (await bridge.invoke(command, args)) as T
}
