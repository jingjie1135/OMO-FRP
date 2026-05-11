import { generateFrpcConfig } from "../../cli/remote-access/frpc-config"
import type { FrpClientConfig } from "../app-config/types"

export function buildFrpClientToml(config: FrpClientConfig): string {
  return generateFrpcConfig({
    serverAddr: config.serverAddr,
    serverPort: config.serverPort,
    authToken: config.authTokenRef,
    transport: config.transport,
    proxyType: config.subdomain || config.customDomain ? "http" : "tcp",
    proxyName: config.proxyName,
    localHost: config.localHost,
    localPort: config.localPort,
    remotePort: config.remotePort,
    subdomain: config.subdomain,
    customDomain: config.customDomain,
  })
}
