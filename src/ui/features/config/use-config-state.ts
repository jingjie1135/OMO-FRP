import { useEffect, useRef, useState, useCallback } from "react"
import type { ManagementClient } from "../../../management-api/client"
import type { ConfigBackup, ConfigDocument, ConfigPreset, ConfigTarget, ConfigValidationFieldError } from "../../../management-api/types"
import type { ActionRunner } from "../../app/action-runner"
import { validateConfigContent } from "./config-validation"

export interface UseConfigStateOptions {
  client: ManagementClient
  runner: ActionRunner
  initialOpencode?: ConfigDocument
  initialOhMyOpenAgent?: ConfigDocument
  initialSelectedTarget?: ConfigTarget
  initialPresets: ConfigPreset[]
  initialBackups: ConfigBackup[]
}

export function useConfigState({
  client,
  runner,
  initialOpencode,
  initialOhMyOpenAgent,
  initialSelectedTarget,
  initialPresets,
  initialBackups,
}: UseConfigStateOptions) {
  const fallbackToolInstanceId = initialOpencode?.target.toolInstanceId ?? initialOhMyOpenAgent?.target.toolInstanceId ?? "unknown"
  const [selectedTarget, setSelectedTarget] = useState<ConfigTarget>(
    initialSelectedTarget || initialOpencode?.target || initialOhMyOpenAgent?.target || { toolInstanceId: fallbackToolInstanceId, kind: "opencode" }
  )
  const [content, setContent] = useState<string>(
    (selectedTarget.kind === "opencode" ? initialOpencode?.content : initialOhMyOpenAgent?.content) || ""
  )
  const [presets, setPresets] = useState<ConfigPreset[]>(initialPresets)
  const [backups, setBackups] = useState<ConfigBackup[]>(initialBackups)
  const [isDirty, setIsDirty] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<ConfigValidationFieldError[]>([])
  const [, setRunnerVersion] = useState(0)

  const selectedTargetRef = useRef(selectedTarget)
  const draftVersionRef = useRef(0)
  const requestIdRef = useRef(0)

  useEffect(() => {
    selectedTargetRef.current = selectedTarget
  }, [selectedTarget])

  useEffect(() => {
    return runner.subscribe(() => {
      setRunnerVersion((value) => value + 1)
    })
  }, [runner])

  const configKey = `config:${selectedTarget.toolInstanceId}:${selectedTarget.kind}`
  const presetsKey = `presets:${selectedTarget.toolInstanceId}:${selectedTarget.kind}`
  const backupsKey = `backups:${selectedTarget.toolInstanceId}:${selectedTarget.kind}`

  const currentConfig = runner.getData<ConfigDocument>(configKey) || (selectedTarget.kind === "opencode" ? initialOpencode : initialOhMyOpenAgent)

  const selectedFormat = getConfigFormat(currentConfig?.path ?? currentConfig?.target.path ?? selectedTarget.path, selectedTarget.kind)

  const readConfigSafely = useCallback(async (target: ConfigTarget): Promise<ConfigDocument> => {
    try {
      return await client.readConfig(target)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const lowerMessage = message.toLowerCase()
      return {
        target,
        content: runner.getData<ConfigDocument>(`config:${target.toolInstanceId}:${target.kind}`)?.content ?? "",
        path: target.path,
        missing: lowerMessage.includes("missing") || lowerMessage.includes("not found") || lowerMessage.includes("no such file"),
        error: message,
      }
    }
  }, [client, runner])

  useEffect(() => {
    if (currentConfig && !isDirty) {
      setContent(currentConfig.content)
    }
  }, [currentConfig, isDirty])

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current
    const activeTarget = selectedTargetRef.current
    const activeConfigKey = `config:${activeTarget.toolInstanceId}:${activeTarget.kind}`
    const activePresetsKey = `presets:${activeTarget.toolInstanceId}:${activeTarget.kind}`
    const activeBackupsKey = `backups:${activeTarget.toolInstanceId}:${activeTarget.kind}`
    await Promise.all([
      runner.run(activeConfigKey, () => readConfigSafely(activeTarget), { isRefresh: true }),
      runner.run(activePresetsKey, () => client.listPresets(activeTarget), { isRefresh: true }),
      runner.run(activeBackupsKey, () => client.listBackups(activeTarget), { isRefresh: true }),
    ])
    if (requestId !== requestIdRef.current) {
      return
    }
    setPresets(runner.getData<ConfigPreset[]>(activePresetsKey) || [])
    setBackups(runner.getData<ConfigBackup[]>(activeBackupsKey) || [])
  }, [client, readConfigSafely, runner])

  const selectTarget = useCallback(async (target: ConfigTarget) => {
    const requestId = ++requestIdRef.current
    selectedTargetRef.current = target
    setSelectedTarget(target)
    setIsDirty(false)
    setFieldErrors([])
    const key = `config:${target.toolInstanceId}:${target.kind}`
    const existing = runner.getData<ConfigDocument>(key)
    if (existing) {
      if (requestId === requestIdRef.current) {
        setContent(existing.content)
      }
    } else {
      await runner.run(key, () => readConfigSafely(target))
      const fresh = runner.getData<ConfigDocument>(key)
      if (fresh && requestId === requestIdRef.current) setContent(fresh.content)
    }
    
    const pKey = `presets:${target.toolInstanceId}:${target.kind}`
    const bKey = `backups:${target.toolInstanceId}:${target.kind}`
    await Promise.all([
      runner.run(pKey, () => client.listPresets(target)),
      runner.run(bKey, () => client.listBackups(target)),
    ])
    if (requestId === requestIdRef.current) {
      setPresets(runner.getData<ConfigPreset[]>(pKey) || [])
      setBackups(runner.getData<ConfigBackup[]>(bKey) || [])
    }
  }, [client, readConfigSafely, runner])

  const save = useCallback(async () => {
    const draftVersionAtStart = draftVersionRef.current
    const validationError = validateConfigContent(content, selectedFormat)
    if (validationError) {
      throw new Error(validationError)
    }

    if (selectedFormat !== "json") {
      const validation = await client.validateConfig(selectedTarget, content)
      if (!validation.valid) {
        setFieldErrors(validation.fieldErrors)
        throw new Error(validation.fieldErrors.map((fieldError) => `${fieldError.field}: ${fieldError.message}`).join("; "))
      }
    }

    await runner.run(`save:${selectedTarget.toolInstanceId}:${selectedTarget.kind}`, async () => {
      setFieldErrors([])
      await client.saveConfig(selectedTarget, content)
      return true
    })
    if (draftVersionRef.current === draftVersionAtStart) {
      setIsDirty(false)
    }
    await refresh()
  }, [client, content, refresh, runner, selectedFormat, selectedTarget])

  const applyPreset = useCallback(async (presetId: string) => {
    const draftVersionAtStart = draftVersionRef.current
    await runner.run(`preset:${selectedTarget.toolInstanceId}:${selectedTarget.kind}`, async () => {
      await client.applyPreset(selectedTarget, presetId)
      return true
    })
    if (draftVersionRef.current === draftVersionAtStart) {
      setIsDirty(false)
    }
    await refresh()
  }, [client, refresh, runner, selectedTarget])

  const restoreBackup = useCallback(async (backupId: string) => {
    const draftVersionAtStart = draftVersionRef.current
    await runner.run(`restore:${selectedTarget.toolInstanceId}:${selectedTarget.kind}`, async () => {
      await client.restoreBackup(selectedTarget, backupId)
      return true
    })
    if (draftVersionRef.current === draftVersionAtStart) {
      setIsDirty(false)
    }
    await refresh()
  }, [client, refresh, runner, selectedTarget])

  return {
    selectedTarget,
    currentConfig,
    content,
    setContent: (val: string) => {
      draftVersionRef.current += 1
      setContent(val)
      setIsDirty(true)
    },
    presets,
    backups,
    isDirty,
    fieldErrors,
    loading: runner.getState(configKey) === "pending",
    error: runner.getError(configKey)?.message,
    selectTarget,
    save,
    refresh,
    applyPreset,
    restoreBackup,
    updatedAt: currentConfig?.updatedAt,
  }
}

function getConfigFormat(path: string | undefined, kind: ConfigTarget["kind"]): "json" | "text" {
  if (!path) {
    return kind === "opencode" ? "json" : "text"
  }

  const lowerPath = path.toLowerCase()
  if (lowerPath.endsWith(".json") || lowerPath.endsWith(".jsonc")) {
    return "json"
  }

  return "text"
}
