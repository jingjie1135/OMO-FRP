import { describe, expect, it } from "bun:test"
import { backupTextFile } from "./backup-service"
import { MemoryStorage } from "./memory-storage"

describe("storage backups", () => {
  it("creates a backup before overwriting config", async () => {
    const storage = new MemoryStorage({ "/config/opencode.json": "{\"model\":\"a\"}" })
    const backupPath = await backupTextFile(storage, "/config/opencode.json", "2026-05-11T120000")

    expect(backupPath).toBe("/config/opencode.json.2026-05-11T120000.backup")
    expect(await storage.readText(backupPath)).toBe("{\"model\":\"a\"}")
  })

  it("rejects backups for missing files", async () => {
    const storage = new MemoryStorage()

    await expect(backupTextFile(storage, "/config/missing.json", "2026-05-11T120000")).rejects.toThrow("Cannot back up missing file: /config/missing.json")
  })
})
