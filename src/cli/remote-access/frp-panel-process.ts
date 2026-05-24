import type { RemoteAccessJoinCommand } from "./types"
import { spawnWithWindowsHide, type SpawnedProcess } from "../../shared/spawn-with-windows-hide"

export interface FrpPanelClientProcess {
  process: SpawnedProcess
  command: RemoteAccessJoinCommand
}

export function startFrpPanelClient(command: RemoteAccessJoinCommand): FrpPanelClientProcess {
  const process = spawnWithWindowsHide([command.command, ...command.args], {
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  })

  return { process, command }
}

export async function stopFrpPanelClient(client: FrpPanelClientProcess | null): Promise<void> {
  if (!client) {
    return
  }

  client.process.kill()
  await client.process.exited.catch(() => {})
}
