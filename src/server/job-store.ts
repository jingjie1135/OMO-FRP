import { appendFile, mkdir, readFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { JobResult } from "../management-api/types"

export interface JobRecord extends JobResult {
  action: string
  targetId: string
  createdAt: string
  updatedAt: string
}

export async function appendJobRecord(path: string, record: JobRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8")
}

export async function readJobRecords(path: string): Promise<JobRecord[]> {
  try {
    const content = await readFile(path, "utf8")
    return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as JobRecord)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return []
    }
    throw error
  }
}
