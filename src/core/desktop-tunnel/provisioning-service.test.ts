import { describe, expect, it } from "bun:test"
import { createDesktopTunnelProvisioningService } from "./provisioning-service"

const request = { deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", preferredSubdomain: "alice-code" }

describe("desktop tunnel provisioning service", () => {
  it("maps desktop requests to frp-panel provisioning and returns frpc config", async () => {
    const service = createDesktopTunnelProvisioningService({
      panelUrl: "https://frp.example.com",
      panelApiUrl: "https://frp.example.com",
      panelRpcUrl: "wss://frp.example.com/rpc",
      authToken: "restricted-token",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      https: true,
      provisionRoute: async (options) => {
        expect(options).toMatchObject({ clientId: "desktop-alice", proxyName: "opencode-alice", localHost: "127.0.0.1", localPort: 4096, subdomain: "alice-code", proxyType: "http" })
        return { status: "ready", publicUrl: "https://alice-code.frp.example.com", serverAddr: "frp-edge.example.com", serverPort: 7443, clientSecret: "desktop-client-secret" }
      },
    })
    const response = await service.provision(request)
    expect(response).toMatchObject({ deviceId: "desktop-alice", publicUrl: "https://alice-code.frp.example.com", serverAddr: "frp-edge.example.com", serverPort: 7443, proxyName: "opencode-alice", subdomain: "alice-code" })
    expect(response.frpcConfig).toContain('serverAddr = "frp-edge.example.com"')
    expect(response.frpcConfig).toContain('localIP = "127.0.0.1"')
    expect(response.frpcConfig).toContain('auth.token = "desktop-client-secret"')
    expect(response.frpcConfig).not.toContain("restricted-token")
  })

  it("returns frpc config when a new frp client is not online yet", async () => {
    const service = createDesktopTunnelProvisioningService({
      panelUrl: "https://frp.example.com",
      panelApiUrl: "https://frp.example.com",
      panelRpcUrl: "wss://frp.example.com/rpc",
      authToken: "restricted-token",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      https: true,
      provisionRoute: async () => ({
        status: "error",
        publicUrl: "https://alice-code.frp.example.com",
        serverAddr: "frp-edge.example.com",
        serverPort: 7443,
        clientSecret: "desktop-client-secret",
        failureReason: "client_not_ready",
        suggestion: "Start the local frp-panel client.",
      }),
    })

    const response = await service.provision(request)

    expect(response).toMatchObject({ deviceId: "desktop-alice", publicUrl: "https://alice-code.frp.example.com", serverAddr: "frp-edge.example.com", serverPort: 7443 })
    expect(response.frpcConfig).toContain('serverAddr = "frp-edge.example.com"')
    expect(response.frpcConfig).toContain('auth.token = "desktop-client-secret"')
    expect(response.frpcConfig).not.toContain("restricted-token")
  })
  it("throws an actionable error when provisioning is not ready", async () => {
    const service = createDesktopTunnelProvisioningService({
      panelUrl: "https://frp.example.com",
      panelApiUrl: "https://frp.example.com",
      panelRpcUrl: "wss://frp.example.com/rpc",
      authToken: "restricted-token",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      https: true,
      provisionRoute: async () => ({ status: "error", publicUrl: "https://alice-code.frp.example.com", failureReason: "auth_failed", suggestion: "Use a restricted frp-panel token." }),
    })
    await expect(service.provision(request)).rejects.toThrow("Use a restricted frp-panel token.")
  })
})
