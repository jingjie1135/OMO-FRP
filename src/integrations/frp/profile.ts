import type { PublicRoute, SecretRef } from "../../core/schema"
import type { FrpClientProfile, FrpProxy, FrpServerProfile } from "../../core/schema"

export function createFrpServerProfile(options: {
  bindPort: number
  vhostHttpPort: number
  vhostHttpsPort: number
  tokenRef: SecretRef
  allowedDomains: string[]
}): FrpServerProfile {
  return { ...options }
}

export function proxyFromRoute(route: PublicRoute): FrpProxy {
  return {
    routeId: route.id,
    type: route.provider === "frp" && route.targetPort > 0 ? "http" : "http",
    customDomains: [route.publicHost],
    localIp: route.targetHost,
    localPort: route.targetPort,
  }
}

export function createFrpClientProfile(options: {
  serverAddr: string
  serverPort: number
  tokenRef: SecretRef
  routes: PublicRoute[]
}): FrpClientProfile {
  return {
    serverAddr: options.serverAddr,
    serverPort: options.serverPort,
    tokenRef: options.tokenRef,
    proxies: options.routes.filter((route) => route.provider === "frp").map(proxyFromRoute),
  }
}
