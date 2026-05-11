import type { FrpcConfigInput } from "./types"

function quoteTomlString(value: string): string {
  return JSON.stringify(value)
}

export function generateFrpcConfig(input: FrpcConfigInput): string {
  const lines = [
    `serverAddr = ${quoteTomlString(input.serverAddr)}`,
    `serverPort = ${input.serverPort}`,
    `transport.protocol = ${quoteTomlString(input.transport)}`,
    `auth.method = "token"`,
    `auth.token = ${quoteTomlString(input.authToken)}`,
    "",
    `[[proxies]]`,
    `name = ${quoteTomlString(input.proxyName)}`,
    `type = ${quoteTomlString(input.proxyType)}`,
    `localIP = ${quoteTomlString(input.localHost ?? "127.0.0.1")}`,
    `localPort = ${input.localPort}`,
  ]

  if (input.proxyType === "http") {
    if (input.subdomain) {
      lines.push(`subdomain = ${quoteTomlString(input.subdomain)}`)
    }

    if (input.customDomain) {
      lines.push(`customDomains = [${quoteTomlString(input.customDomain)}]`)
    }
  } else if (input.remotePort !== undefined) {
    lines.push(`remotePort = ${input.remotePort}`)
  }

  return `${lines.join("\n")}\n`
}
