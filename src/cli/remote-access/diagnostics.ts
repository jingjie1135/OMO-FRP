import { isPortAvailable } from "../../shared/port-utils"
import type { NormalizedRemoteAccessOptions } from "./types"

export function getStaticDiagnostics(options: NormalizedRemoteAccessOptions): string[] {
  const diagnostics = [
    "Authentication: verify OPENCODE_SERVER_PASSWORD matches the password used in the browser prompt.",
    "frp authentication: verify the frp token matches the server frps or frp-panel credential.",
    "Network: confirm this machine can reach the frp server address and bind port.",
    "Port mapping: confirm the frp-panel route points to local 127.0.0.1 and the selected OpenCode port.",
    "OpenCode service: confirm the local OpenCode server is running before starting frpc.",
  ]

  if (!options.subdomain && !options.customDomain) {
    diagnostics.push("Public route: set --subdomain or --custom-domain if the panel does not allocate a default host.")
  }

  return diagnostics
}

export async function getConnectionDiagnostics(options: NormalizedRemoteAccessOptions): Promise<string[]> {
  const diagnostics = [...getStaticDiagnostics(options)]
  const localPortAvailable = await isPortAvailable(options.localPort, "127.0.0.1")

  if (localPortAvailable && options.noStart) {
    diagnostics.push("Local service: nothing is listening on the selected OpenCode port.")
  }

  if (!localPortAvailable && !options.noStart) {
    diagnostics.push("Local port: the selected OpenCode port is already in use, so the command will attach to it.")
  }

  return diagnostics
}
