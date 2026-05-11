import type { StorageAdapter } from "../storage/storage-adapter"

const ACTIVE_CONFIG_FILENAMES = ["oh-my-openagent.json", "oh-my-opencode.jsonc"] as const

export async function findOhMyOpenAgentConfigPath(storage: StorageAdapter, configDirectory: string): Promise<string | null> {
  for (const filename of ACTIVE_CONFIG_FILENAMES) {
    const path = joinConfigPath(configDirectory, filename)
    if (await storage.exists(path)) {
      return path
    }
  }
  return null
}

export async function listOhMyOpenAgentPresetPaths(storage: StorageAdapter, configDirectory: string): Promise<string[]> {
  const paths = await storage.list(configDirectory)
  return paths.filter((path) => /(^|[/\\])oh-my-openagent\.preset-[^/\\]+\.json$/.test(path)).sort()
}

export function joinConfigPath(directory: string, filename: string): string {
  const separator = directory.includes("\\") ? "\\" : "/"
  return `${directory.replace(/[\\/]+$/, "")}${separator}${filename}`
}
