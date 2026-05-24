import { generateFrpcConfig } from "./frpc-config"
import { buildPublicUrl } from "./public-url"
import type { NormalizedRemoteAccessOptions, RemoteAccessPlan } from "./types"
import { getConnectionDiagnostics } from "./diagnostics"
import { ensurePanelProvisioning } from "./frp-panel-client"

export async function createRemoteAccessPlan(options: NormalizedRemoteAccessOptions): Promise<RemoteAccessPlan> {
  const publicUrl = buildPublicUrl(options)
  const provisioning = await ensurePanelProvisioning(options)

  return {
    localUrl: `http://127.0.0.1:${options.localPort}`,
    publicUrl,
    frpcConfig: generateFrpcConfig({
      ...options,
      serverAddr: provisioning.serverAddr ?? options.serverAddr,
      serverPort: provisioning.serverPort ?? options.serverPort,
    }),
    diagnostics: await getConnectionDiagnostics(options, provisioning),
    status: provisioning.status,
    failureReason: provisioning.failureReason,
    suggestion: provisioning.suggestion,
    client: provisioning.client,
    proxy: provisioning.proxy,
    joinCommand: provisioning.joinCommand,
    options,
  }
}
