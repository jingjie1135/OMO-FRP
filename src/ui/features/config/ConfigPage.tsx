import React, { useMemo, useState } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { ConfigBackup, ConfigDocument, ConfigPreset } from "../../../management-api/types"
import { ActionRunner } from "../../app/action-runner"
import { useConfigState } from "./use-config-state"

export interface ConfigPageState {
  client: ManagementClient
  initialSelectedTarget?: ConfigDocument["target"]
  opencode?: ConfigDocument
  ohMyOpenAgent?: ConfigDocument
  presets: ConfigPreset[]
  backups: ConfigBackup[]
}

export function ConfigPage(state: ConfigPageState) {
  const runner = useMemo(() => new ActionRunner(), [])
  const {
    selectedTarget,
    currentConfig,
    content,
    setContent,
    presets,
    backups,
    isDirty,
    fieldErrors,
    loading,
    error,
    selectTarget,
    save,
    refresh,
    applyPreset,
    restoreBackup,
    updatedAt,
  } = useConfigState({
    client: state.client,
    runner,
    initialOpencode: state.opencode,
    initialOhMyOpenAgent: state.ohMyOpenAgent,
    initialSelectedTarget: state.initialSelectedTarget,
    initialPresets: state.presets,
    initialBackups: state.backups,
  })

  const [saveError, setSaveError] = useState<string | null>(null)

  const selectedPath = currentConfig?.path ?? selectedTarget.path
  const selectedMissing = currentConfig?.missing ?? false
  const selectedReadError = currentConfig?.error
  const opencodePath = state.opencode?.path ?? state.opencode?.target.path
  const ohMyOpenAgentPath = state.ohMyOpenAgent?.path ?? state.ohMyOpenAgent?.target.path

  const handleSave = async () => {
    const confirmationMessage = selectedMissing
      ? "Are you sure you want to create a new configuration for this target?"
      : "Are you sure you want to overwrite the current configuration?"
    if (window.confirm(confirmationMessage)) {
      setSaveError(null)
      try {
        await save()
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : String(e))
      }
    }
  }

  const handleApplyPreset = async (presetId: string) => {
    const preset = presets.find((item) => item.id === presetId)
    const targetLabel = `${selectedTarget.toolInstanceId}:${selectedTarget.kind}`
    if (window.confirm(`Apply preset "${preset?.name ?? presetId}" to ${targetLabel}?\n\nAffected range: active configuration content\nBackup behavior: create backup before apply.`)) {
      try {
        await applyPreset(presetId)
      } catch (e) {
        alert(`Failed to apply preset: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    const backup = backups.find((item) => item.id === backupId)
    const targetLabel = `${selectedTarget.toolInstanceId}:${selectedTarget.kind}`
    const backupBehavior = selectedMissing
      ? "Pre-restore backup behavior: no current config exists, so no fresh backup will be created."
      : "Pre-restore backup behavior: create a fresh backup before restore."
    if (window.confirm(`Restore backup "${backupId}" for ${targetLabel}?\n\nBackup path: ${backup?.path ?? "unknown"}\nOverwrite warning: current configuration will be replaced.\n${backupBehavior}`)) {
      try {
        await restoreBackup(backupId)
      } catch (e) {
        alert(`Failed to restore backup: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Configuration Editor</h1>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {(error || saveError) && (
        <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
          <h2 className="font-bold mb-1">Error</h2>
          <p>{error || saveError}</p>
        </div>
      )}

      {fieldErrors.length > 0 && (
        <div role="alert" className="p-4 bg-amber-50 text-amber-800 rounded border border-amber-200">
          <h2 className="font-bold mb-1">Validation details</h2>
          <ul className="list-disc list-inside text-sm space-y-1">
            {fieldErrors.map((fieldError) => (
              <li key={`${fieldError.field}:${fieldError.message}`}>{fieldError.field}: {fieldError.message}</li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="target-selection-heading" className="bg-white p-4 rounded shadow border">
        <h2 id="target-selection-heading" className="text-lg font-semibold mb-3">Target Selection</h2>
        <div className="flex gap-4">
          <button
            onClick={() => selectTarget({ toolInstanceId: selectedTarget.toolInstanceId, kind: "opencode", path: opencodePath })}
            className={`px-4 py-2 rounded border transition-colors ${selectedTarget.kind === 'opencode' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
          >
            OpenCode
          </button>
          <button
            onClick={() => selectTarget({ toolInstanceId: selectedTarget.toolInstanceId, kind: "oh-my-openagent", path: ohMyOpenAgentPath })}
            className={`px-4 py-2 rounded border transition-colors ${selectedTarget.kind === 'oh-my-openagent' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
          >
            OhMyOpenAgent
          </button>
        </div>
      </section>

      <section aria-labelledby="editor-heading" className="bg-white p-4 rounded shadow border">
        <div className="flex justify-between items-center mb-3">
          <h2 id="editor-heading" className="text-lg font-semibold">Content Editor</h2>
          <div className="text-xs text-gray-500 font-mono">
            {updatedAt ? `Last updated: ${new Date(updatedAt).toLocaleString()}` : "No update time"}
          </div>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Selected target: {selectedTarget.toolInstanceId}:{selectedTarget.kind}</p>
          <p className="text-sm text-gray-600">Config path: {selectedPath ?? "not reported"}</p>
          <p className="text-sm text-gray-600">Missing state: {selectedMissing ? "missing" : "available"}</p>
          {selectedReadError && <p className="text-sm text-amber-700">Read warning: {selectedReadError}</p>}
          <textarea
            className="w-full h-64 p-3 font-mono text-sm bg-gray-50 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter configuration content..."
          />
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 italic">
              {isDirty ? "Unsaved changes" : "All changes saved"}
            </span>
            <button
              onClick={handleSave}
              disabled={loading || !isDirty}
              className={`px-6 py-2 bg-blue-600 text-white rounded font-medium shadow transition-all ${loading || !isDirty ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700 active:transform active:scale-95'}`}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section aria-labelledby="presets-heading" className="bg-white p-4 rounded shadow border">
          <h2 id="presets-heading" className="text-lg font-semibold mb-3">Configuration Presets</h2>
          <div className="space-y-2">
            {presets.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No presets available for this target.</p>
            ) : (
                presets.map(preset => (
                  <div key={preset.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all">
                    <div>
                      <div className="font-medium text-sm">{preset.name || preset.id}</div>
                      <div className="text-xs text-gray-500 font-mono">{preset.path}</div>
                      <div className="text-xs text-gray-500">Target: {selectedTarget.toolInstanceId}:{selectedTarget.kind}</div>
                      <div className="text-xs text-gray-500">Affected range: active configuration content</div>
                      <div className="text-xs text-gray-500">Backup behavior: create backup before apply</div>
                    </div>
                    <button
                    onClick={() => handleApplyPreset(preset.id)}
                    className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="backups-heading" className="bg-white p-4 rounded shadow border">
          <h2 id="backups-heading" className="text-lg font-semibold mb-3">Recent Backups</h2>
          <div className="space-y-2">
            {backups.length === 0 ? (
              <p className="text-gray-500 italic text-sm">No backups available for this target.</p>
            ) : (
                backups.map(backup => (
                  <div key={backup.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all">
                    <div>
                      <div className="font-medium text-sm">{new Date(backup.createdAt).toLocaleString()}</div>
                      <div className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{backup.id}</div>
                      <div className="text-xs text-gray-500">Target: {backup.target.toolInstanceId}:{backup.target.kind}</div>
                      <div className="text-xs text-gray-500 font-mono truncate max-w-[200px]">Path: {backup.path}</div>
                    </div>
                  <button
                    onClick={() => handleRestoreBackup(backup.id)}
                    className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-300 transition-colors"
                  >
                    Restore
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
