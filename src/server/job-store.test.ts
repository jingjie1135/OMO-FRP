import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, test } from "bun:test"
import { appendJobRecord, readJobRecords } from "./job-store"

test("appends and reads JSONL job records", async () => {
  const root = await mkdtemp(join(tmpdir(), "omo-frp-jobs-"))
  try {
    const path = join(root, "jobs.jsonl")
    await appendJobRecord(path, {
      jobId: "start:opencode",
      action: "start",
      targetId: "opencode",
      status: "succeeded",
      message: "OpenCode started.",
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:01.000Z",
    })

    const records = await readJobRecords(path)

    expect(records).toHaveLength(1)
    expect(records[0]?.jobId).toBe("start:opencode")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
