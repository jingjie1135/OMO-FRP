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
      ? "确认要为当前目标创建新的配置文件吗？"
      : "确认要覆盖当前配置内容吗？"
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
    if (window.confirm(`确认将预设“${preset?.name ?? presetId}”应用到 ${targetLabel} 吗？\n\n影响范围：当前激活配置内容\n备份策略：应用前自动创建备份。`)) {
      try {
        await applyPreset(presetId)
      } catch (e) {
        alert(`应用预设失败：${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  const handleRestoreBackup = async (backupId: string) => {
    const backup = backups.find((item) => item.id === backupId)
    const targetLabel = `${selectedTarget.toolInstanceId}:${selectedTarget.kind}`
    const backupBehavior = selectedMissing
      ? "恢复前说明：当前没有现有配置，因此不会额外生成新的恢复前备份。"
      : "恢复前说明：会先为当前配置创建一份新的恢复前备份。"
    if (window.confirm(`确认恢复 ${targetLabel} 的备份“${backupId}”吗？\n\n备份路径：${backup?.path ?? "未知"}\n覆盖提醒：当前配置将被替换。\n${backupBehavior}`)) {
      try {
        await restoreBackup(backupId)
      } catch (e) {
        alert(`恢复备份失败：${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col p-8">
      <div className="mb-8 flex shrink-0 justify-between items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">配置、预设与备份</p>
          <h1 className="text-2xl font-semibold text-slate-900">配置与备份</h1>
        </div>
        <button
          onClick={() => refresh()}
          disabled={loading}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border transition-colors"
        >
          {loading ? "刷新中..." : "刷新"}
        </button>
      </div>

      {(error || saveError) && (
        <div role="alert" className="p-4 bg-red-50 text-red-700 rounded border border-red-200">
          <h2 className="font-bold mb-1">配置错误</h2>
          <p>{error || saveError}</p>
        </div>
      )}

      {fieldErrors.length > 0 && (
        <div role="alert" className="p-4 bg-amber-50 text-amber-800 rounded border border-amber-200">
          <h2 className="font-bold mb-1">校验详情</h2>
          <ul className="list-disc list-inside text-sm space-y-1">
            {fieldErrors.map((fieldError) => (
              <li key={`${fieldError.field}:${fieldError.message}`}>{fieldError.field}: {fieldError.message}</li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="target-selection-heading" className="sr-only">
        <h2 id="target-selection-heading">配置目标</h2>
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        <section aria-labelledby="editor-heading" className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <h2 id="editor-heading" className="text-base font-medium text-slate-800">配置内容</h2>
          <button
            onClick={() => selectTarget({ toolInstanceId: selectedTarget.toolInstanceId, kind: "opencode", path: opencodePath })}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${selectedTarget.kind === 'opencode' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            OpenCode
          </button>
          <button
            onClick={() => selectTarget({ toolInstanceId: selectedTarget.toolInstanceId, kind: "oh-my-openagent", path: ohMyOpenAgentPath })}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${selectedTarget.kind === 'oh-my-openagent' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            OhMyOpenAgent
          </button>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-slate-500">最后更新于：{updatedAt ? new Date(updatedAt).toLocaleString() : "暂无更新时间"}</span>
              <button
                onClick={handleSave}
                disabled={loading || !isDirty}
                className={`rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all ${loading || !isDirty ? 'cursor-not-allowed opacity-50' : 'hover:bg-blue-700 active:scale-95'}`}
              >
                {loading ? "保存中..." : "保存配置"}
              </button>
            </div>
        </div>
          <div className="shrink-0 space-y-1 border-b border-slate-100 px-4 py-3">
          <p className="text-sm text-gray-600">当前目标：{selectedTarget.toolInstanceId}:{selectedTarget.kind}</p>
          <p className="text-sm text-gray-600">配置路径：{selectedPath ?? "未上报"}</p>
          <p className="text-sm text-gray-600">文件状态：{selectedMissing ? "缺失" : "可用"}</p>
          {selectedReadError && <p className="text-sm text-amber-700">读取提醒：{selectedReadError}</p>}
          </div>
          <textarea
            className="min-h-0 flex-1 resize-none bg-slate-900 p-6 font-mono text-sm leading-relaxed text-slate-200 outline-none transition-all focus:ring-2 focus:ring-blue-500"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入或粘贴配置内容..."
            spellCheck={false}
          />
          <div className="flex shrink-0 justify-between border-t border-slate-200 px-4 py-3">
            <span className="text-sm text-gray-500 italic">
              {isDirty ? "存在未保存修改" : "当前修改已保存"}
            </span>
            <span className="text-xs text-slate-500">最后更新于：{updatedAt ? new Date(updatedAt).toLocaleString() : "暂无更新时间"}</span>
          </div>
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-80">
        <section aria-labelledby="presets-heading" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="presets-heading" className="text-lg font-semibold">配置预设</h2>
            <span className="text-sm font-medium text-blue-600">应用预设</span>
          </div>
          <div className="space-y-2">
            {presets.length === 0 ? (
              <p className="text-gray-500 italic text-sm">当前目标暂无可用预设。</p>
            ) : (
                presets.map(preset => (
                  <div key={preset.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all">
                    <div>
                      <div className="font-medium text-sm">{preset.name || preset.id}</div>
                      <div className="text-xs text-gray-500 font-mono">{preset.path}</div>
                      <div className="text-xs text-gray-500">目标：{selectedTarget.toolInstanceId}:{selectedTarget.kind}</div>
                      <div className="text-xs text-gray-500">影响范围：当前激活配置内容</div>
                      <div className="text-xs text-gray-500">备份策略：应用前自动备份</div>
                    </div>
                    <button
                    onClick={() => handleApplyPreset(preset.id)}
                    className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded border border-blue-200 transition-colors"
                  >
                    应用
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section aria-labelledby="backups-heading" className="min-h-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 id="backups-heading" className="mb-3 text-lg font-semibold">最近备份</h2>
          <div className="space-y-2">
            {backups.length === 0 ? (
              <p className="text-gray-500 italic text-sm">当前目标暂无可恢复备份。</p>
            ) : (
                backups.map(backup => (
                  <div key={backup.id} className="flex justify-between items-center p-2 hover:bg-gray-50 rounded border border-transparent hover:border-gray-200 transition-all">
                    <div>
                      <div className="font-medium text-sm">{new Date(backup.createdAt).toLocaleString()}</div>
                      <div className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{backup.id}</div>
                      <div className="text-xs text-gray-500">目标：{backup.target.toolInstanceId}:{backup.target.kind}</div>
                      <div className="text-xs text-gray-500 font-mono truncate max-w-[200px]">路径：{backup.path}</div>
                    </div>
                  <button
                    onClick={() => handleRestoreBackup(backup.id)}
                    className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded border border-gray-300 transition-colors"
                  >
                    恢复
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
        </aside>
      </div>
    </div>
  )
}
