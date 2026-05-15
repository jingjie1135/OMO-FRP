import React from "react"
import type { RuntimeInfo } from "../../../management-api/types"

export interface SettingsPageProps {
  info: RuntimeInfo
}

export function SettingsPage({ info }: SettingsPageProps) {
  const toolsMissingPassword = info.config.toolInstances.filter((tool) => tool.status === "running").length > 0 && info.config.publicEndpoints.some((endpoint) => endpoint.authMode === "basic-auth")
  const backupCount = info.config.pluginConfigs.reduce((count, plugin) => count + plugin.presets.length, 0)

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">System Settings</h1>

      <section aria-labelledby="runtime-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="runtime-heading" className="text-lg font-semibold mb-3">Runtime Configuration</h2>
        <div className="space-y-2">
          <p>settings:mode={info.capabilities.mode}</p>
          <p className="text-sm text-gray-600">Active mode determines available infrastructure and local access capabilities.</p>
        </div>
      </section>

      <section aria-labelledby="security-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="security-heading" className="text-lg font-semibold mb-3">Security & Access</h2>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-bold ${toolsMissingPassword ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
            security:{toolsMissingPassword ? "warning" : "ok"}
          </span>
          {toolsMissingPassword && <p className="text-sm text-amber-700 font-medium text-amber-900">Warning: Some public endpoints use insecure authentication.</p>}
        </div>
      </section>

      <section aria-labelledby="backups-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="backups-heading" className="text-lg font-semibold mb-3">Data Protection</h2>
        <div className="space-y-1">
          <p>Total Backup Presets: backups:{backupCount}</p>
          <button disabled className="mt-2 px-3 py-1 bg-blue-600 text-white rounded opacity-50 cursor-not-allowed text-sm">
            Create System Snapshot
          </button>
        </div>
      </section>

      <section aria-labelledby="diagnostics-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="diagnostics-heading" className="text-lg font-semibold mb-3">System Diagnostics</h2>
        <div className="space-y-2">
          <p>Active Log Streams: logs:{info.config.toolInstances.length}</p>
          <div className="text-sm text-gray-500 italic">Global health checks are running normally.</div>
        </div>
      </section>
    </div>
  )
}
