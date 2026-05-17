import React, { useState } from "react"
import { createFallbackBackupSummary, createFallbackSecurityChecks, useSettingsState, type SettingsInitialData } from "./use-settings-state"
import type { ManagementClient } from "../../../management-api/client"
import type { RuntimeInfo } from "../../../management-api/types"
import { ErrorState } from "../../components/ErrorState"

export interface SettingsPageProps {
  client?: ManagementClient
  info?: RuntimeInfo
  initialData?: SettingsInitialData
}

export function SettingsPage({ client, info, initialData }: SettingsPageProps) {
  const resolvedInitialData = initialData ?? (info ? {
    runtimeInfo: info,
    securityChecks: createFallbackSecurityChecks(info),
    backupSummary: createFallbackBackupSummary(info),
  } : {})
  const resolvedClient = client ?? createStaticSettingsClient(resolvedInitialData)
  const state = useSettingsState(resolvedClient, resolvedInitialData)
  const [confirmBackup, setConfirmBackup] = useState(false)
  const [confirmCleanup, setConfirmCleanup] = useState(false)

  if (state.isLoading && !state.runtimeInfo) {
    return (
      <div className="p-4 flex items-center justify-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        <span>Loading settings...</span>
      </div>
    )
  }

  const runtimeInfo = state.runtimeInfo
  if (!runtimeInfo) {
    return (
      <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
        Settings runtime information is unavailable.
      </div>
    )
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">System Settings</h1>
        <button
          onClick={() => state.refresh()}
          className="text-sm text-blue-600 hover:underline"
        >
          Refresh
        </button>
      </div>

      {state.errorMessage && <ErrorState error={state.errorMessage} onRetry={() => state.refresh()} />}

      <section aria-labelledby="runtime-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="runtime-heading" className="text-lg font-semibold mb-3">Runtime Configuration</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold">Mode</p>
              <p>settings:mode={runtimeInfo.capabilities.mode}</p>
            </div>
            <div>
              <p className="font-semibold">Config Root</p>
              <p>{runtimeInfo.config.toolInstances.find(t => t.kind === "opencode")?.configDirectory || "Unknown"}</p>
            </div>
            {runtimeInfo.capabilities.mode === "server" && (
              <div>
                <p className="font-semibold">Management API</p>
                <p>{getManagementApiAddress()}</p>
              </div>
            )}
            {runtimeInfo.capabilities.mode === "desktop" && (
              <div>
                <p className="font-semibold">Tauri Bridge</p>
                <p>Connected</p>
              </div>
            )}
          </div>
          <details className="text-sm border rounded p-2">
            <summary className="cursor-pointer font-medium">Capability Matrix</summary>
            <ul className="mt-2 space-y-1 list-disc list-inside text-gray-600">
              {Object.entries(runtimeInfo.capabilities).map(([cap, enabled]) => (
                <li key={cap} className={enabled ? "text-green-700" : "text-gray-400"}>
                  {cap}: {enabled ? "Yes" : "No"}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>

      <section aria-labelledby="security-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="security-heading" className="text-lg font-semibold mb-3">Security Posture</h2>
        <div className="space-y-3">
          {state.securityChecks.map((check) => (
            <div key={check.id} className="flex items-start gap-3 p-2 border rounded bg-gray-50">
              <span className={`mt-0.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                check.status === "pass" ? "bg-green-100 text-green-800" :
                check.status === "warn" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"
              }`}>
                {check.status}
              </span>
              <div>
                <p className="text-sm font-medium">{check.label}</p>
                <p className="text-xs text-gray-600">{check.message}</p>
                {check.fix && <p className="text-xs text-blue-600 mt-1 font-medium">Suggestion: {check.fix}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="backups-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="backups-heading" className="text-lg font-semibold mb-3">Data Protection</h2>
        {state.backupSummary && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold">Total Backups</p>
                <p>backups:count={state.backupSummary.count}</p>
              </div>
              <div>
                <p className="font-semibold">Last Backup</p>
                <p>{state.backupSummary.lastBackupTime || "Never"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="font-semibold">Backup Directory</p>
                <p className="font-mono text-xs break-all">{state.backupSummary.backupDirectory}</p>
              </div>
            </div>

            {state.backupSummary.failureRecords.length > 0 && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                <p className="font-bold mb-1">Recent Failures:</p>
                <ul className="list-disc list-inside">
                  {state.backupSummary.failureRecords.map((rec, i) => <li key={i}>{rec}</li>)}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t">
              {confirmBackup ? (
                <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                  <span className="text-xs font-medium">Confirm manual backup?</span>
                  <button
                    onClick={() => { state.runManualBackup(); setConfirmBackup(false); }}
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmBackup(false)}
                    className="px-2 py-1 bg-white border rounded text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmBackup(true)}
                  disabled={!state.backupSummary.canManualBackup}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  Run Manual Backup
                </button>
              )}

              {state.backupSummary.canCleanup && (
                confirmCleanup ? (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded">
                    <span className="text-xs font-medium">Cleanup old backups?</span>
                    <button
                      onClick={() => { state.cleanupOldBackups(); setConfirmCleanup(false); }}
                      className="px-2 py-1 bg-red-600 text-white rounded text-xs"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmCleanup(false)}
                      className="px-2 py-1 bg-white border rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmCleanup(true)}
                    className="px-3 py-1 border border-red-200 text-red-600 rounded text-sm hover:bg-red-50"
                  >
                    Cleanup Old Backups
                  </button>
                )
              )}

              <a
                href="/config"
                className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50 flex items-center"
              >
                Restore Config Flow
              </a>
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="diagnostics-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="diagnostics-heading" className="text-lg font-semibold mb-3">System Diagnostics</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Export a full report of runtime status, tool detections, and redacted logs for debugging.
            All sensitive information like passwords and tokens will be redacted.
          </p>
          <button
            onClick={() => state.exportDiagnostics()}
            className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 text-sm"
          >
            Export Redacted Diagnostics (.json)
          </button>
        </div>
      </section>
    </div>
  )
}

function getManagementApiAddress(): string {
  if (typeof window === "undefined") {
    return "same-origin management API"
  }
  return window.location.origin && window.location.origin !== "null" ? window.location.origin : "same-origin management API"
}

function createStaticSettingsClient(initialData: SettingsInitialData): ManagementClient {
  const runtimeInfo = initialData.runtimeInfo
  if (!runtimeInfo) {
    throw new Error("SettingsPage requires either client or info.")
  }

  const successJob = { jobId: "settings-static", status: "succeeded" as const, message: "ok" }
  return {
    async getRuntimeInfo() {
      return runtimeInfo
    },
    async detectTools() {
      return []
    },
    async listToolInstances() {
      return runtimeInfo.config.toolInstances
    },
    async installTool() {
      return successJob
    },
    async startTool() {
      return successJob
    },
    async stopTool() {
      return successJob
    },
    async restartTool() {
      return successJob
    },
    async getToolLogs() {
      return []
    },
    async readConfig(target) {
      return { target, content: "" }
    },
    async validateConfig() {
      return { valid: true, fieldErrors: [] }
    },
    async saveConfig() {},
    async listPresets() {
      return []
    },
    async applyPreset() {},
    async listBackups() {
      return []
    },
    async restoreBackup() {},
    async listEndpoints() {
      return runtimeInfo.config.publicEndpoints
    },
    async saveEndpoint() {},
    async enableEndpoint() {
      return successJob
    },
    async disableEndpoint() {
      return successJob
    },
    async getFrpStatus() {
      return { mode: runtimeInfo.capabilities.canManageFrpServer ? "server" : runtimeInfo.capabilities.canManageFrpClient ? "client" : "unavailable", running: false, message: "FRP status unavailable." }
    },
    async saveFrpConfig() {},
    async startFrp() {
      return successJob
    },
    async stopFrp() {
      return successJob
    },
    async getCloudflareTunnelStatus() {
      return { mode: "unavailable", running: false, message: "Cloudflare status unavailable." }
    },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan(config) {
      return { mode: config.mode, localUrl: `http://${config.localHost}:${config.localPort}`, commandSummary: [], cloudflaredDetected: false, diagnostics: [], securityNotes: [], steps: [] }
    },
    async startCloudflareTunnel() {
      return successJob
    },
    async stopCloudflareTunnel() {
      return successJob
    },
    async retryCloudflareTunnelStep() {
      return successJob
    },
    async getSecurityChecks() {
      return initialData.securityChecks ?? createFallbackSecurityChecks(runtimeInfo)
    },
    async getBackupSummary() {
      return initialData.backupSummary ?? createFallbackBackupSummary(runtimeInfo)
    },
    async runManualBackup() {
      return successJob
    },
    async cleanupOldBackups() {
      return successJob
    },
    async getDiagnostics() {
      return { runtime: runtimeInfo, tools: [], endpoints: runtimeInfo.config.publicEndpoints, frp: { mode: "unavailable", running: false, message: "FRP status unavailable." }, jobs: [], redactedLogs: [] }
    },
  }
}
