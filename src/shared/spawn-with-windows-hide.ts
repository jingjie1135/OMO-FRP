import { spawn as bunSpawn } from "./bun-spawn-shim"
import { spawn as nodeSpawn, type ChildProcess } from "node:child_process"

export interface SpawnOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  stdin?: "pipe" | "inherit" | "ignore"
  stdout?: "pipe" | "inherit" | "ignore"
  stderr?: "pipe" | "inherit" | "ignore"
}

export interface SpawnedProcess {
  readonly exitCode: number | null
  readonly exited: Promise<number>
  readonly stdout: ReadableStream<Uint8Array> | undefined
  readonly stderr: ReadableStream<Uint8Array> | undefined
  kill(signal?: NodeJS.Signals): void
}

function chunkToUint8Array(chunk: unknown): Uint8Array {
  if (chunk instanceof Uint8Array) return chunk
  if (typeof chunk === "string") return new TextEncoder().encode(chunk)

  return new TextEncoder().encode(String(chunk))
}

function toReadableStream(stream: NodeJS.ReadableStream | null): ReadableStream<Uint8Array> | undefined {
  if (!stream) {
    return undefined
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk: unknown) => {
        controller.enqueue(chunkToUint8Array(chunk))
      })
      stream.once("end", () => {
        controller.close()
      })
      stream.once("error", (error) => {
        controller.error(error)
      })
    },
  })
}

function wrapNodeProcess(proc: ChildProcess): SpawnedProcess {
  let resolveExited: (exitCode: number) => void
  let exitCode: number | null = null

  const exited = new Promise<number>((resolve) => {
    resolveExited = resolve
  })

  proc.on("exit", (code) => {
    exitCode = code ?? 1
    resolveExited(exitCode)
  })

  proc.on("error", () => {
    if (exitCode === null) {
      exitCode = 1
      resolveExited(1)
    }
  })

  return {
    get exitCode() {
      return exitCode
    },
    exited,
    stdout: toReadableStream(proc.stdout),
    stderr: toReadableStream(proc.stderr),
    kill(signal?: NodeJS.Signals): void {
      try {
        if (!signal) {
          proc.kill()
          return
        }

        proc.kill(signal)
      } catch (error) {
        if (!String(error).includes("kill")) {
          throw error
        }
      }
    },
  }
}

export function spawnWithWindowsHide(command: string[], options: SpawnOptions): SpawnedProcess {
  if (process.platform !== "win32") {
    return bunSpawn(command, options)
  }

  const [cmd, ...args] = command
  const proc = nodeSpawn(cmd, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: [options.stdin ?? "ignore", options.stdout ?? "pipe", options.stderr ?? "inherit"],
    windowsHide: true,
    shell: true,
  })

  return wrapNodeProcess(proc)
}
