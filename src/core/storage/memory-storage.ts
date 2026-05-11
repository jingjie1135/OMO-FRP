import type { StorageAdapter } from "./storage-adapter"

export class MemoryStorage implements StorageAdapter {
  private readonly files = new Map<string, string>()

  constructor(initialFiles: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(initialFiles)) {
      this.files.set(path, content)
    }
  }

  async readText(path: string): Promise<string | null> {
    return this.files.get(path) ?? null
  }

  async writeText(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }

  async list(path: string): Promise<string[]> {
    const prefix = path.endsWith("/") ? path : `${path}/`
    return Array.from(this.files.keys())
      .filter((filePath) => filePath.startsWith(prefix))
      .sort()
  }

  async backup(path: string): Promise<string> {
    return backupTextFileWithTimestamp(this, path, new Date())
  }
}

function backupTextFileWithTimestamp(storage: StorageAdapter, path: string, date: Date): Promise<string> {
  const timestamp = date.toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z")
  return import("./backup-service").then(({ backupTextFile }) => backupTextFile(storage, path, timestamp))
}
