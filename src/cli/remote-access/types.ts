export type FrpTransport = "tcp" | "kcp" | "websocket" | "quic"
export type FrpProxyType = "http" | "tcp"

export interface RemoteAccessOptions {
  panelUrl: string
  authToken: string
  proxyName?: string
  serverAddr?: string
  serverPort?: number
  transport?: string
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
  authToken: string
  proxyName: string
  serverAddr: string
  serverPort: number
  transport: FrpTransport
  proxyType: FrpProxyType
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

export interface RemoteAccessPlan {
  localUrl: string
  publicUrl: string
  frpcConfig: string
  diagnostics: string[]
  options: NormalizedRemoteAccessOptions
}
