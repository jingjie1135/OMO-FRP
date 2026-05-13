import type { RuntimeInfo } from "../../../management-api/types"

export function SettingsPage(info: RuntimeInfo): string {
  const toolsMissingPassword = info.config.toolInstances.filter((tool) => tool.status === "running").length > 0 && info.config.publicEndpoints.some((endpoint) => endpoint.authMode === "basic-auth")
  const backupCount = info.config.pluginConfigs.reduce((count, plugin) => count + plugin.presets.length, 0)
  return [
    `settings:mode=${info.capabilities.mode}`,
    `security:${toolsMissingPassword ? "warning" : "ok"}`,
    `backups:${backupCount}`,
    `logs:${info.config.toolInstances.length}`,
  ].join("\n")
}
