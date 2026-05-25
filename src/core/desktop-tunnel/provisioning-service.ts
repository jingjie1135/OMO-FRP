import type { FrpFailureReason } from "../../management-api/types"
import type { FrpRouteProvisioningOptions } from "../../cli/remote-access/types"
import { ensurePanelProvisioning } from "../../cli/remote-access/frp-panel-client"
import { generateFrpcConfig } from "../../cli/remote-access/frpc-config"
import type { DesktopTunnelProvisionRequest, DesktopTunnelProvisionResponse } from "../../management-api/types"

interface ProvisionRouteResult {
  status: "idle" | "provisioning" | "ready" | "error"
  publicUrl: string
  serverAddr?: string
  serverPort?: number
  clientSecret?: string
  failureReason?: FrpFailureReason | string
  suggestion?: string
}

export interface DesktopTunnelProvisioningServiceOptions {
  panelUrl: string
  panelApiUrl: string
  panelRpcUrl: string
  authToken: string
  serverId?: string
  serverAddr: string
  serverPort: number
  https?: boolean
  frpBinary?: string
  provisionRoute?: (options: FrpRouteProvisioningOptions) => Promise<ProvisionRouteResult>
}

export interface DesktopTunnelProvisioningService {
  provision(request: DesktopTunnelProvisionRequest): Promise<DesktopTunnelProvisionResponse>
}

export function createDesktopTunnelProvisioningService(options: DesktopTunnelProvisioningServiceOptions): DesktopTunnelProvisioningService {
  const provisionRoute = options.provisionRoute ?? ensurePanelProvisioning

  return {
    async provision(request) {
      const proxyName = request.proxyName ?? request.deviceId
      const routeOptions: FrpRouteProvisioningOptions = {
        panelUrl: options.panelUrl,
        panelApiUrl: options.panelApiUrl,
        panelRpcUrl: options.panelRpcUrl,
        authToken: options.authToken,
        serverId: options.serverId,
        clientId: request.deviceId,
        proxyName,
        frpBinary: options.frpBinary ?? "frp-panel",
        serverAddr: options.serverAddr,
        serverPort: options.serverPort,
        transport: "tcp",
        proxyType: "http",
        localHost: request.localHost,
        localPort: request.localPort,
        subdomain: request.preferredSubdomain,
        https: options.https ?? true,
      }
      const result = await provisionRoute(routeOptions)
      if (result.status !== "ready" && !isBootstrappableClientNotReady(result)) {
        throw new Error(result.suggestion ?? result.failureReason ?? "Desktop tunnel provisioning failed")
      }
      if (!result.clientSecret) {
        throw new Error("Desktop tunnel provisioning did not return a scoped client secret")
      }
      const serverAddr = result.serverAddr ?? options.serverAddr
      const serverPort = result.serverPort ?? options.serverPort
      return {
        deviceId: request.deviceId,
        publicUrl: result.publicUrl,
        serverAddr,
        serverPort,
        proxyName,
        subdomain: request.preferredSubdomain,
        frpcConfig: generateFrpcConfig({
          ...routeOptions,
          authToken: result.clientSecret,
          serverAddr,
          serverPort,
        }),
      }
    },
  }
}
function isBootstrappableClientNotReady(result: ProvisionRouteResult): boolean {
  return result.status === "error" && result.failureReason === "client_not_ready" && Boolean(result.clientSecret)
}