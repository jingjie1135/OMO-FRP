import { backupTextFile } from "../storage/backup-service"
import type { StorageAdapter } from "../storage/storage-adapter"

export function backupOhMyOpenAgentConfig(storage: StorageAdapter, configPath: string, timestamp: string): Promise<string> {
  return backupTextFile(storage, configPath, timestamp)
}
