import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, test } from "bun:test"
import { appendRuntimeLog, readRuntimeLogs } from "./log-store"

test("redacts secrets when reading runtime logs", async () => {
  const root = await mkdtemp(join(tmpdir(), "omo-frp-logs-"))
  try {
    const path = join(root, "opencode.log")
    await appendRuntimeLog(path, {
      timestamp: "2026-05-20T00:00:00.000Z",
      level: "info",
      message: "started with token=secret-token and password=hunter2",
    })

    const logs = await readRuntimeLogs(path)

    expect(logs[0]?.message).not.toContain("secret-token")
    expect(logs[0]?.message).not.toContain("hunter2")
    expect(logs[0]?.message).toContain("[REDACTED]")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
