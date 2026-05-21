import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import type { LogLine } from "../management-api/types"
import { redactSensitiveText } from "../shared/redact-sensitive-text"

export interface CloudflaredProcessControllerOptions {
  command?: string
  argsForUrl?: (localUrl: string) => string[]
  now?: () => Date
  urlTimeoutMs?: number
  stopTimeoutMs?: number
}

export interface CloudflaredStartResult {
  ok: boolean
  publicUrl?: string
  message: string
}

export interface CloudflaredProcessStatus {
  running: boolean
  publicUrl?: string
}

export interface CloudflaredProcessController {
  startQuickTunnel(localUrl: string): Promise<CloudflaredStartResult>
  stop(): Promise<CloudflaredStartResult>
  status(): CloudflaredProcessStatus
  logs(): LogLine[]
}

export function createCloudflaredProcessController(options: CloudflaredProcessControllerOptions = {}): CloudflaredProcessController {
  const command = options.command ?? process.env.CLOUDFLARED_BINARY ?? "cloudflared"
  const argsForUrl = options.argsForUrl ?? ((localUrl: string) => ["tunnel", "--url", localUrl])
  const now = options.now ?? (() => new Date())
  const urlTimeoutMs = options.urlTimeoutMs ?? 15_000
  const stopTimeoutMs = options.stopTimeoutMs ?? 1_000
  const logs: LogLine[] = []
  let child: ChildProcessWithoutNullStreams | undefined
  let publicUrl: string | undefined

  function appendLog(level: LogLine["level"], message: string): void {
    logs.push({ timestamp: now().toISOString(), level, message: redactSensitiveText(message) })
  }

  return {
    async startQuickTunnel(localUrl: string): Promise<CloudflaredStartResult> {
      if (child && !child.killed) {
        return { ok: true, publicUrl, message: publicUrl ? `Cloudflare quick tunnel is already running at ${publicUrl}.` : "Cloudflare quick tunnel is already starting." }
      }

      publicUrl = undefined
      try {
        child = spawn(command, argsForUrl(localUrl), { shell: false, windowsHide: true })
      } catch (error) {
        return { ok: false, message: `Failed to start cloudflared: ${error instanceof Error ? error.message : String(error)}` }
      }

      const currentChild = child
      return new Promise((resolve) => {
        let settled = false
        const settle = (result: CloudflaredStartResult) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(result)
        }
        const handleOutput = (level: LogLine["level"], chunk: Buffer) => {
          const message = String(chunk)
          appendLog(level, message)
          const extractedUrl = extractTryCloudflareUrl(message)
          if (extractedUrl) {
            publicUrl = extractedUrl
            settle({ ok: true, publicUrl: extractedUrl, message: `Cloudflare quick tunnel is running at ${extractedUrl}.` })
          }
        }
        const timer = setTimeout(() => {
          settle({ ok: false, message: "Timed out waiting for cloudflared to report a trycloudflare URL." })
        }, urlTimeoutMs)

        currentChild.stdout.on("data", (chunk) => handleOutput("info", chunk))
        currentChild.stderr.on("data", (chunk) => handleOutput("warn", chunk))
        currentChild.on("error", (error) => {
          appendLog("error", error.message)
          settle({ ok: false, message: `cloudflared failed: ${error.message}` })
        })
        currentChild.on("exit", (code) => {
          child = undefined
          if (!settled) {
            settle({ ok: false, message: `cloudflared exited before reporting a public URL${code === null ? "." : ` with code ${code}.`}` })
          }
        })
      })
    },
    async stop(): Promise<CloudflaredStartResult> {
      if (!child || child.killed) {
        child = undefined
        publicUrl = undefined
        return { ok: true, message: "Cloudflare quick tunnel is not running." }
      }

      const currentChild = child
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          currentChild.kill("SIGKILL")
          child = undefined
          publicUrl = undefined
          resolve({ ok: true, message: "Cloudflare quick tunnel was force stopped." })
        }, stopTimeoutMs)
        currentChild.once("exit", () => {
          clearTimeout(timer)
          child = undefined
          publicUrl = undefined
          resolve({ ok: true, message: "Cloudflare quick tunnel stopped." })
        })
        currentChild.kill("SIGTERM")
      })
    },
    status(): CloudflaredProcessStatus {
      return { running: Boolean(child && !child.killed), publicUrl }
    },
    logs(): LogLine[] {
      return [...logs]
    },
  }
}

export function extractTryCloudflareUrl(output: string): string | undefined {
  return output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0]
}
