import { isPortAvailable } from "../../shared/port-utils"
import type { FrpFailureReason } from "../../management-api/types"
import type { NormalizedRemoteAccessOptions } from "./types"

interface ProvisioningLike {
  failureReason?: FrpFailureReason
  suggestion?: string
  client?: { status: "online" | "offline" | "error" | "unknown" }
  proxy?: { status: "running" | "stopped" | "error" | "unknown"; error?: string }
}

function getFailureDiagnostic(reason: FrpFailureReason | undefined): string | undefined {
  switch (reason) {
    case "auth_failed":
      return "frp-panel authentication failed: use a restricted token or restricted account with client/proxy permissions."
    case "api_unreachable":
      return "frp-panel API: verify the API URL and ensure the HTTP endpoint is reachable from this machine."
    case "rpc_unreachable":
      return "frp-panel RPC: verify the RPC URL, websocket/h2c reverse proxy settings, and TLS termination."
    case "proxy_not_ready":
      return "Proxy status: the proxy exists but is not ready yet; check the route allocation and local target port."
    case "local_service_unreachable":
      return "OpenCode service: nothing is listening on the selected local port."
    case "client_not_ready":
      return "Desktop client: the frp-panel client is not online yet; start the local frp-panel client first."
    case "timeout":
      return "Provisioning timed out: verify the client came online and the proxy reached running state."
    case "unknown":
      return "frp-panel returned an unexpected error; inspect the panel logs and local client output."
    default:
      return undefined
  }
}

export function getStaticDiagnostics(options: NormalizedRemoteAccessOptions): string[] {
  const diagnostics = [
    "Authentication: verify OPENCODE_SERVER_PASSWORD matches the password used in the browser prompt.",
    "frp authentication: verify the restricted frp-panel token or client secret matches the selected client.",
    "Network: confirm this machine can reach the frp-panel API/RPC endpoints and the FRP server address.",
    "Port mapping: confirm the frp-panel route points to local 127.0.0.1 and the selected OpenCode port.",
    "OpenCode service: confirm the local OpenCode server is running before publishing the proxy.",
  ]

  if (!options.subdomain && !options.customDomain) {
    diagnostics.push("Public route: set --subdomain or --custom-domain if the panel does not allocate a default host.")
  }

  return diagnostics
}

export async function getConnectionDiagnostics(options: NormalizedRemoteAccessOptions, provisioning?: ProvisioningLike): Promise<string[]> {
  const diagnostics = [...getStaticDiagnostics(options)]
  const localPortAvailable = await isPortAvailable(options.localPort, "127.0.0.1")

  if (localPortAvailable && options.noStart) {
    diagnostics.push("Local service: nothing is listening on the selected OpenCode port.")
  }

  if (!localPortAvailable && !options.noStart) {
    diagnostics.push("Local port: the selected OpenCode port is already in use, so the command will attach to it.")
  }

  const failureDiagnostic = getFailureDiagnostic(provisioning?.failureReason)
  if (failureDiagnostic) {
    diagnostics.push(failureDiagnostic)
  }

  if (provisioning?.client && provisioning.client.status !== "online") {
    diagnostics.push(`Desktop client status: ${provisioning.client.status}.`)
  }

  if (provisioning?.proxy && provisioning.proxy.status !== "running") {
    diagnostics.push(`Proxy status: ${provisioning.proxy.status}.${provisioning.proxy.error ? ` ${provisioning.proxy.error}` : ""}`)
  }

  if (provisioning?.suggestion) {
    diagnostics.push(`Suggested fix: ${provisioning.suggestion}`)
  }

  return diagnostics
}
