import { generateFrpcConfig } from "./frpc-config"
import { buildPublicUrl } from "./public-url"
import type { NormalizedRemoteAccessOptions, RemoteAccessPlan } from "./types"
import { getConnectionDiagnostics } from "./diagnostics"

export async function createRemoteAccessPlan(options: NormalizedRemoteAccessOptions): Promise<RemoteAccessPlan> {
  return {
    localUrl: `http://127.0.0.1:${options.localPort}`,
    publicUrl: buildPublicUrl(options),
    frpcConfig: generateFrpcConfig(options),
    diagnostics: await getConnectionDiagnostics(options),
    options,
  }
}
