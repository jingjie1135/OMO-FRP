import type { FrpFailureReason, FrpPanelClientResource, FrpPanelProxyResource } from "../../management-api/types"

export type FrpTransport = "tcp" | "kcp" | "websocket" | "quic"
export type FrpProxyType = "http" | "tcp"

export interface RemoteAccessOptions {
  panelUrl: string
  panelApiUrl?: string
  panelRpcUrl?: string
  authToken: string
  serverId?: string
  clientId?: string
  clientSecret?: string
  proxyName?: string
  frpBinary?: string
  serverAddr?: string
  serverPort?: number
  transport?: string
  localHost?: string
  localPort?: number
  remotePort?: number
  subdomain?: string
  customDomain?: string
  https?: boolean
  password?: string
  username?: string
  outputConfig?: string
  frpcBin?: string
  noStart?: boolean
  noFrpc?: boolean
  json?: boolean
}

export interface NormalizedRemoteAccessOptions {
  panelUrl: string
  panelApiUrl: string
  panelRpcUrl: string
  authToken: string
  serverId?: string
  clientId: string
  clientSecret?: string
  proxyName: string
  frpBinary: string
  serverAddr: string
  serverPort: number
  transport: FrpTransport
  proxyType: FrpProxyType
  localHost: string
  localPort: number
  remotePort?: number
  subdomain?: string
  customDomain?: string
  https: boolean
  password: string
  username: string
  outputConfig?: string
  frpcBin: string
  noStart: boolean
  noFrpc: boolean
  json: boolean
}

export interface FrpRouteProvisioningOptions {
  panelUrl: string
  panelApiUrl: string
  panelRpcUrl: string
  authToken: string
  serverId?: string
  clientId: string
  proxyName: string
  frpBinary: string
  serverAddr: string
  serverPort: number
  transport: FrpTransport
  proxyType: FrpProxyType
  localHost: string
  localPort: number
  remotePort?: number
  subdomain?: string
  customDomain?: string
  https: boolean
}
export interface FrpcConfigInput {
  serverAddr: string
  serverPort: number
  authToken: string
  transport: FrpTransport
  proxyType: FrpProxyType
  proxyName: string
  localHost?: string
  localPort: number
  remotePort?: number
  subdomain?: string
  customDomain?: string
}

export interface RemoteAccessJoinCommand {
  command: string
  args: string[]
}

export interface RemoteAccessPlan {
  localUrl: string
  publicUrl: string
  frpcConfig: string
  diagnostics: string[]
  status: "idle" | "provisioning" | "ready" | "error"
  failureReason?: FrpFailureReason
  suggestion?: string
  client?: FrpPanelClientResource
  proxy?: FrpPanelProxyResource
  joinCommand?: RemoteAccessJoinCommand
  options: NormalizedRemoteAccessOptions
}
