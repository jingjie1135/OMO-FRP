import type { Diagnostics, LogLine } from "../../../management-api/types"
import { redactSensitiveText } from "../../../shared/redact-sensitive-text"

export function redactDiagnostics(diagnostics: Diagnostics): Diagnostics {
  return redactValue(diagnostics)
}

export function downloadDiagnostics(diagnostics: Diagnostics): void {
  const redacted = redactDiagnostics(diagnostics)
  const blob = new Blob([JSON.stringify(redacted, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `opencode-diagnostics-${new Date().toISOString().split("T")[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function redactLogLines(logs: LogLine[]): LogLine[] {
  return logs.map((log) => ({ ...log, message: redactSensitiveText(log.message) }))
}

function redactValue<T>(value: T): T {
  if (typeof value === "string") {
    return redactSensitiveText(value) as T
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item)) as T
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, entryValue]) => {
      if (/password|token|secret|authorization/i.test(key) && entryValue !== undefined) {
        return [key, "[REDACTED]"]
      }
      return [key, redactValue(entryValue)]
    })
    return Object.fromEntries(entries) as T
  }

  return value
}
