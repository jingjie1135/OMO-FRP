import { spawn } from "node:child_process"
import { redactSensitiveText } from "../shared/redact-sensitive-text"

export interface RunCommandOptions {
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  timeoutMs: number
  maxOutputBytes?: number
}

export interface RunCommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const maxOutputBytes = options.maxOutputBytes ?? 1024
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? {},
      shell: false,
      windowsHide: true,
    })

    let stdout = ""
    let stderr = ""
    let settled = false

    const timer = setTimeout(() => {
      settled = true
      child.kill("SIGTERM")
      resolve({ exitCode: null, stdout: redactSensitiveText(stdout), stderr: redactSensitiveText(stderr), timedOut: true })
    }, options.timeoutMs)

    child.stdout.on("data", (chunk) => { stdout = appendBoundedOutput(stdout, String(chunk), maxOutputBytes) })
    child.stderr.on("data", (chunk) => { stderr = appendBoundedOutput(stderr, String(chunk), maxOutputBytes) })
    child.on("error", (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (exitCode) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode, stdout: redactSensitiveText(stdout), stderr: redactSensitiveText(stderr), timedOut: false })
    })
  })
}

function appendBoundedOutput(current: string, chunk: string, maxOutputBytes: number): string {
  if (current.length >= maxOutputBytes) {
    return current
  }

  const remaining = maxOutputBytes - current.length
  if (chunk.length <= remaining) {
    return current + chunk
  }

  return current + chunk.slice(0, Math.max(remaining - 12, 0)) + "\n[TRUNCATED]"
}
