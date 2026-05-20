import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { AppConfig } from "../core/app-config/types"
import { createEmptyServerConfig } from "./runtime-adapter"

export async function loadServerAppConfig(path: string): Promise<AppConfig> {
  try {
    const content = await readFile(path, "utf8")
    return JSON.parse(content) as AppConfig
  } catch (error) {
    if (isMissingFileError(error)) {
      return createEmptyServerConfig()
    }
    throw error
  }
}

export async function saveServerAppConfig(path: string, config: AppConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT")
}
