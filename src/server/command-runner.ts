import { spawn } from "node:child_process"
import { redactSensitiveText } from "../shared/redact-sensitive-text"

export interface RunCommandOptions {
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  timeoutMs: number
}

export interface RunCommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
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

    child.stdout.on("data", (chunk) => { stdout += String(chunk) })
    child.stderr.on("data", (chunk) => { stderr += String(chunk) })
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
