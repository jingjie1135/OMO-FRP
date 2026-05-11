export interface ServerConnection {
  cleanup: () => void
}

export async function createServerConnection(options: { port?: number; signal: AbortSignal }): Promise<ServerConnection> {
  const port = options.port ?? 4096
  const proc = Bun.spawn(["opencode", "serve", "--hostname", "127.0.0.1", "--port", String(port)], {
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
    signal: options.signal,
  })

  return {
    cleanup: () => proc.kill(),
  }
}
