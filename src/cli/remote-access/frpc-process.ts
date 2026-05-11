import { join } from "node:path"
import { tmpdir } from "node:os"
import type { NormalizedRemoteAccessOptions, RemoteAccessPlan } from "./types"

export interface FrpcProcess {
  process: Bun.Subprocess<"ignore", "inherit", "inherit">
  configPath: string
}

export async function startFrpc(plan: RemoteAccessPlan): Promise<FrpcProcess> {
  const configPath = plan.options.outputConfig ?? join(tmpdir(), `${plan.options.proxyName}.frpc.toml`)
  await Bun.write(configPath, plan.frpcConfig)

  const process = Bun.spawn([plan.options.frpcBin, "-c", configPath], {
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  })

  return { process, configPath }
}

export async function stopFrpc(frpc: FrpcProcess | null): Promise<void> {
  if (!frpc) {
    return
  }

  frpc.process.kill()
  await frpc.process.exited.catch(() => {})
}

export function shouldStartFrpc(options: Pick<NormalizedRemoteAccessOptions, "noStart" | "noFrpc">): boolean {
  return !options.noStart && !options.noFrpc
}
