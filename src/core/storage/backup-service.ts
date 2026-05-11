import type { StorageAdapter } from "./storage-adapter"

export async function backupTextFile(storage: StorageAdapter, path: string, timestamp: string): Promise<string> {
  const content = await storage.readText(path)
  if (content === null) {
    throw new Error(`Cannot back up missing file: ${path}`)
  }

  const backupPath = `${path}.${timestamp}.backup`
  await storage.writeText(backupPath, content)
  return backupPath
}
