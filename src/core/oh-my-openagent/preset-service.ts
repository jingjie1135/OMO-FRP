import { backupTextFile } from "../storage/backup-service"
import type { StorageAdapter } from "../storage/storage-adapter"

export interface ApplyPresetRequest {
  activePath: string
  presetPath: string
  timestamp: string
}

export async function applyPresetToActiveConfig(storage: StorageAdapter, request: ApplyPresetRequest): Promise<string> {
  const presetContent = await storage.readText(request.presetPath)
  if (presetContent === null) {
    throw new Error(`Cannot apply missing preset: ${request.presetPath}`)
  }

  const backupPath = await backupTextFile(storage, request.activePath, request.timestamp)
  await storage.writeText(request.activePath, presetContent)
  return backupPath
}
