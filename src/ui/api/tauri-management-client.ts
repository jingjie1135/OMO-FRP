import type { SettingsManagementClient } from "../../management-api/client"
import type { CloudflareTunnelConfigRequest, CloudflareTunnelStepId, ConfigTarget, DesktopTunnelHeartbeatRequest, DesktopTunnelProvisionRequest, DesktopTunnelState, FrpConfigRequest, InstallToolRequest } from "../../management-api/types"
import { createDesktopAutoTunnelOrchestrator } from "../../desktop/auto-tunnel-orchestrator"

export interface TauriInvokeBridge {
  invoke(command: string, args?: Record<string, unknown>): Promise<unknown>
}

export interface TauriManagementClient extends SettingsManagementClient {
  startDesktopAutoTunnel(): Promise<DesktopTunnelState>
}

export function createTauriManagementClient(bridge: TauriInvokeBridge): TauriManagementClient {
  const client: TauriManagementClient = {
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
    async saveFrpConfig(config: FrpConfigRequest, rawConfig?: string) {
      const result = await invokeTyped<unknown>(bridge, "save_frp_config", { config, raw_config: rawConfig })
      if (isFailedJobResult(result)) {
        throw new Error(result.message)
      }
    },
    startFrp() {
      return invokeTyped(bridge, "start_frp")
    },
    stopFrp() {
      return invokeTyped(bridge, "stop_frp")
    },
    listDesktopTunnelDevices() {
      return invokeTyped(bridge, "list_desktop_tunnel_devices")
    },
    provisionDesktopTunnel(request: DesktopTunnelProvisionRequest) {
      return invokeTyped(bridge, "provision_desktop_tunnel", { request })
    },
    sendDesktopTunnelHeartbeat(request: DesktopTunnelHeartbeatRequest) {
      return invokeTyped(bridge, "send_desktop_tunnel_heartbeat", { request })
    },
    deleteDesktopTunnelDevice(deviceId: string) {
      return invokeTyped(bridge, "delete_desktop_tunnel_device", { device_id: deviceId })
    },
    startDesktopAutoTunnel() {
      return createDesktopAutoTunnelOrchestrator({
        runtime: client,
        client,
        deviceId: "desktop-local",
        deviceName: "Desktop Local",
        localHost: "127.0.0.1",
        localPort: 4096,
        preferredSubdomain: "desktop-local",
      }).connect()
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

  return client
}


async function invokeTyped<T>(bridge: TauriInvokeBridge, command: string, args?: Record<string, unknown>): Promise<T> {
  const result = await bridge.invoke(command, args)
  if (isErrorPayload(result)) {
    throw new Error(result.error)
  }
  return result as T
}

function isErrorPayload(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error?: unknown }).error === "string"
}

function isFailedJobResult(value: unknown): value is { status: "failed"; message: string } {
  return typeof value === "object" && value !== null && (value as { status?: unknown }).status === "failed" && typeof (value as { message?: unknown }).message === "string"
}
