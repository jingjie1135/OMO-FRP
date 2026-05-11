import { describe, expect, it } from "bun:test"
import { buildFrpClientToml } from "./frp-config"

describe("frp client config", () => {
  it("builds an HTTP frpc proxy for local OpenCode", () => {
    const toml = buildFrpClientToml({
      endpointId: "alice-code",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      authTokenRef: "secret-token",
      localHost: "127.0.0.1",
      localPort: 4096,
      proxyName: "alice-opencode",
      subdomain: "alice-code",
      transport: "tcp",
    })

    expect(toml).toContain('serverAddr = "frp.example.com"')
    expect(toml).toContain('localIP = "127.0.0.1"')
    expect(toml).toContain('subdomain = "alice-code"')
  })

  it("builds a TCP frpc proxy with custom local host and remote port", () => {
    const toml = buildFrpClientToml({
      endpointId: "tcp-code",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      authTokenRef: "secret-token",
      localHost: "192.168.1.20",
      localPort: 4096,
      remotePort: 18080,
      proxyName: "tcp-opencode",
      transport: "tcp",
    })

    expect(toml).toContain('type = "tcp"')
    expect(toml).toContain('localIP = "192.168.1.20"')
    expect(toml).toContain("remotePort = 18080")
    expect(toml).not.toContain("subdomain")
  })
})
