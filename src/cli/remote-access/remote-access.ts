import pc from "../../shared/colors"
import { createServerConnection } from "../run/server-connection"
import type { RemoteAccessOptions, RemoteAccessPlan } from "./types"
import type { FrpcProcess } from "./frpc-process"
import { normalizeRemoteAccessOptions } from "./options"
import { createRemoteAccessPlan } from "./plan"
import { shouldStartFrpc, startFrpc, stopFrpc } from "./frpc-process"

function formatTextOutput(plan: RemoteAccessPlan): string {
  return [
    `${pc.bold("OpenCode remote access")}`,
    `Local OpenCode: ${pc.cyan(plan.localUrl)}`,
    `Public URL: ${pc.cyan(plan.publicUrl)}`,
    `frpc proxy: ${pc.cyan(plan.options.proxyName)}`,
    `Basic Auth username: ${pc.cyan(plan.options.username)}`,
    "",
    pc.bold("frpc config"),
    plan.frpcConfig.trimEnd(),
    "",
    pc.bold("Diagnostics"),
    ...plan.diagnostics.map((item) => `- ${item}`),
  ].join("\n")
}

function formatJsonOutput(plan: RemoteAccessPlan): string {
  return JSON.stringify({
    localUrl: plan.localUrl,
    publicUrl: plan.publicUrl,
    proxyName: plan.options.proxyName,
    username: plan.options.username,
    frpcConfig: plan.frpcConfig,
    diagnostics: plan.diagnostics,
  }, null, 2)
}

function waitForShutdownOrFrpcExit(frpc: FrpcProcess): Promise<number> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (code: number) => {
      if (settled) {
        return
      }
      settled = true
      process.removeListener("SIGINT", shutdown)
      process.removeListener("SIGTERM", shutdown)
      resolve(code)
    }
    const shutdown = () => finish(0)
    process.once("SIGINT", shutdown)
    process.once("SIGTERM", shutdown)
    frpc.process.exited.then((code) => finish(code === 0 ? 0 : 1)).catch(() => finish(1))
  })
}

export async function remoteAccess(options: RemoteAccessOptions): Promise<number> {
  let cleanup = () => {}
  let frpc: FrpcProcess | null = null

  try {
    const normalized = normalizeRemoteAccessOptions(options)
    process.env.OPENCODE_SERVER_PASSWORD = normalized.password
    process.env.OPENCODE_SERVER_USERNAME = normalized.username

    if (!normalized.noStart) {
      const connection = await createServerConnection({
        port: normalized.localPort,
        signal: new AbortController().signal,
      })
      cleanup = connection.cleanup
    }

    const plan = await createRemoteAccessPlan(normalized)

    if (normalized.outputConfig) {
      await Bun.write(normalized.outputConfig, plan.frpcConfig)
      if (!normalized.json) {
        console.log(pc.dim("Wrote frpc config to"), pc.cyan(normalized.outputConfig))
      }
    }

    console.log(normalized.json ? formatJsonOutput(plan) : formatTextOutput(plan))

    if (shouldStartFrpc(normalized)) {
      frpc = await startFrpc(plan)
      if (!normalized.json) {
        console.log(pc.dim("Started frpc with"), pc.cyan(frpc.configPath))
        console.log(pc.dim("Press Ctrl+C to stop OpenCode remote access."))
      }
      const exitCode = await waitForShutdownOrFrpcExit(frpc)
      if (exitCode !== 0) {
        console.error(pc.red("frpc exited before remote access was stopped; check token, network, server address, and port mapping."))
        return exitCode
      }
    }

    return 0
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(pc.red(`Error: ${message}`))
    return 1
  } finally {
    await stopFrpc(frpc)
    cleanup()
  }
}
