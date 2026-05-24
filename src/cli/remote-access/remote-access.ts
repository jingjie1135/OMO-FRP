import pc from "../../shared/colors"
import { createServerConnection } from "../run/server-connection"
import type { RemoteAccessOptions, RemoteAccessPlan } from "./types"
import type { FrpcProcess } from "./frpc-process"
import type { FrpPanelClientProcess } from "./frp-panel-process"
import { normalizeRemoteAccessOptions } from "./options"
import { createRemoteAccessPlan } from "./plan"
import { shouldStartFrpc, startFrpc, stopFrpc } from "./frpc-process"
import { startFrpPanelClient, stopFrpPanelClient } from "./frp-panel-process"

function formatTextOutput(plan: RemoteAccessPlan): string {
  return [
    `${pc.bold("OpenCode remote access")}`,
    `Local OpenCode: ${pc.cyan(plan.localUrl)}`,
    `Public URL: ${pc.cyan(plan.publicUrl)}`,
    `frp-panel API: ${pc.cyan(plan.options.panelApiUrl)}`,
    `frp-panel RPC: ${pc.cyan(plan.options.panelRpcUrl)}`,
    `frpc proxy: ${pc.cyan(plan.options.proxyName)}`,
    `Basic Auth username: ${pc.cyan(plan.options.username)}`,
    `Status: ${pc.cyan(plan.status)}`,
    ...(plan.client ? [`Client: ${pc.cyan(plan.client.id)} (${pc.cyan(plan.client.status)})`] : []),
    ...(plan.proxy ? [`Proxy: ${pc.cyan(plan.proxy.name)} (${pc.cyan(plan.proxy.status)})`] : []),
    ...(plan.failureReason ? [`Failure reason: ${pc.red(plan.failureReason)}`] : []),
    ...(plan.suggestion ? [`Suggestion: ${plan.suggestion}`] : []),
    ...(plan.joinCommand ? ["", pc.bold("frp-panel client command"), `${plan.joinCommand.command} ${plan.joinCommand.args.join(" ")}`] : []),
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
    panelApiUrl: plan.options.panelApiUrl,
    panelRpcUrl: plan.options.panelRpcUrl,
    proxyName: plan.options.proxyName,
    username: plan.options.username,
    frpcConfig: plan.frpcConfig,
    status: plan.status,
    failureReason: plan.failureReason,
    suggestion: plan.suggestion,
    client: plan.client,
    proxy: plan.proxy,
    joinCommand: plan.joinCommand,
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

function waitForShutdownOrPanelClientExit(client: FrpPanelClientProcess): Promise<number> {
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
    client.process.exited.then((code) => finish(code === 0 ? 0 : 1)).catch(() => finish(1))
  })
}

async function waitForProvisioning(planFactory: () => Promise<RemoteAccessPlan>, attempts = 10): Promise<RemoteAccessPlan> {
  let current = await planFactory()
  if (current.status === "ready") {
    return current
  }

  for (let attempt = 1; attempt < attempts; attempt += 1) {
    await Bun.sleep(1000)
    current = await planFactory()
    if (current.status === "ready") {
      return current
    }
  }

  return current
}

export async function remoteAccess(options: RemoteAccessOptions): Promise<number> {
  let cleanup = () => {}
  let frpc: FrpcProcess | null = null
  let frpPanelClient: FrpPanelClientProcess | null = null
  let startedPanelClient = false

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

    let plan = await createRemoteAccessPlan(normalized)

    if (plan.status !== "ready" && plan.failureReason === "client_not_ready" && plan.joinCommand && !normalized.noFrpc) {
      frpPanelClient = startFrpPanelClient(plan.joinCommand)
      startedPanelClient = true
      plan = await waitForProvisioning(() => createRemoteAccessPlan(normalized))
    }

    if (normalized.outputConfig) {
      await Bun.write(normalized.outputConfig, plan.frpcConfig)
      if (!normalized.json) {
        console.log(pc.dim("Wrote frpc config to"), pc.cyan(normalized.outputConfig))
      }
    }

    console.log(normalized.json ? formatJsonOutput(plan) : formatTextOutput(plan))

    if (plan.status !== "ready") {
      return 1
    }

    if (startedPanelClient && frpPanelClient) {
      if (!normalized.json) {
        console.log(pc.dim("Started frp-panel client for this route."))
        console.log(pc.dim("Press Ctrl+C to stop OpenCode remote access."))
      }
      const exitCode = await waitForShutdownOrPanelClientExit(frpPanelClient)
      if (exitCode !== 0) {
        console.error(pc.red("frp-panel client exited before remote access was stopped; check client secret, API/RPC URLs, and local service state."))
        return exitCode
      }
      return 0
    }

    if (!plan.joinCommand && shouldStartFrpc(normalized)) {
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
    await stopFrpPanelClient(frpPanelClient)
    cleanup()
  }
}
