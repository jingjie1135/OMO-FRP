import type { ConfigBackup, ConfigDocument, ConfigPreset } from "../../../management-api/types"

export interface ConfigPageState {
  opencode?: ConfigDocument
  ohMyOpenAgent?: ConfigDocument
  presets: ConfigPreset[]
  backups: ConfigBackup[]
  loading?: boolean
  error?: string
}

export function ConfigPage(state: ConfigPageState): string {
  if (state.loading) {
    return "config:loading"
  }

  if (state.error) {
    return `config:error:${state.error}`
  }

  return [
    `config:opencode=${state.opencode ? "loaded" : "missing"}`,
    `config:oh-my-openagent=${state.ohMyOpenAgent ? "loaded" : "missing"}`,
    `presets:${state.presets.map((preset) => preset.id).join("|") || "none"}`,
    `backups:${state.backups.map((backup) => backup.id).join("|") || "none"}`,
  ].join("\n")
}
