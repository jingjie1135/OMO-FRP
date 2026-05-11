import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { StorageAdapter } from "./storage-adapter"
import { backupTextFile } from "./backup-service"

export class NodeStorage implements StorageAdapter {
  async readText(path: string): Promise<string | null> {
    try {
      return await readFile(path, "utf8")
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return null
      }
      throw error
    }
  }

  async writeText(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, "utf8")
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(path)
      return true
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return false
      }
      throw error
    }
  }

  async list(path: string): Promise<string[]> {
    try {
      const entries = await readdir(path)
      return entries.map((entry) => join(path, entry)).sort()
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return []
      }
      throw error
    }
  }

  async backup(path: string): Promise<string> {
    const timestamp = new Date().toISOString().replaceAll(":", "").replace(/\.\d{3}Z$/, "Z")
    return backupTextFile(this, path, timestamp)
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error
}
