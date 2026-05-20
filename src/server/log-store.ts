import { appendFile, mkdir, readFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { LogLine } from "../management-api/types"
import { redactSensitiveText } from "../shared/redact-sensitive-text"

export async function appendRuntimeLog(path: string, line: LogLine): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify({ ...line, message: redactSensitiveText(line.message) })}\n`, "utf8")
}

export async function readRuntimeLogs(path: string, limit = 500): Promise<LogLine[]> {
  try {
    const content = await readFile(path, "utf8")
    return content
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line) as LogLine)
      .map((line) => ({ ...line, message: redactSensitiveText(line.message) }))
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return []
    }
    throw error
  }
}
