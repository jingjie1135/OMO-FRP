import type { ConfigDocument, ConfigTarget } from "../../management-api/types"
import type { StorageAdapter } from "../storage/storage-adapter"

export async function readConfigDocument(storage: StorageAdapter, target: ConfigTarget): Promise<ConfigDocument> {
  if (!target.path) {
    throw new Error("Config target path is required")
  }

  const content = await storage.readText(target.path)
  if (content === null) {
    throw new Error(`Cannot read missing config: ${target.path}`)
  }

  return { target, content }
}

export async function saveConfigDocument(storage: StorageAdapter, target: ConfigTarget, content: string): Promise<void> {
  if (!target.path) {
    throw new Error("Config target path is required")
  }

  await storage.writeText(target.path, content)
}
