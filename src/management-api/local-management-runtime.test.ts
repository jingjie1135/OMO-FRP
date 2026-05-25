import { describe, expect, it } from "bun:test"
import { SERVER_CAPABILITIES } from "../core/app-config/types"
import type { AppConfig, PublicEndpoint, ToolInstance } from "../core/app-config/types"
import { createLocalManagementRuntime } from "./local-management-runtime"

const runningOpenCode: ToolInstance = {
  id: "opencode-server",
  kind: "opencode",
  displayName: "OpenCode",
  hostType: "server",
  installState: "configured",
  defaultPort: 4096,
  currentPort: 4096,
  status: "running",
}

const endpoint: PublicEndpoint = {
  id: "route-1",
  name: "Route 1",
  domain: "code.example.com",
  protocol: "https",
  targetType: "server-local",
  targetToolInstanceId: "opencode-server",
  authMode: "opencode-password",
  status: "disabled",
}

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    mode: "server",
    toolInstances: [runningOpenCode],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
    ...overrides,
  }
}

describe("local management runtime endpoints", () => {
  it("normalizes saved endpoint URLs and forces client-supplied active status to disabled", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig(),
    })

    await runtime.saveEndpoint({ ...endpoint, domain: "https://code.example.com/path", status: "active" })

    const [saved] = await runtime.listEndpoints()
    expect(saved?.protocol).toBe("https")
    expect(saved?.domain).toBe("code.example.com")
    expect(saved?.status).toBe("disabled")
  })

  it("blocks enable when the target tool is not running", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig({ toolInstances: [{ ...runningOpenCode, status: "stopped" }], publicEndpoints: [endpoint] }),
    })

    const result = await runtime.enableEndpoint(endpoint.id)

    expect(result.status).toBe("failed")
    expect(result.message).toContain("not running")
    expect((await runtime.listEndpoints())[0]?.status).toBe("disabled")
  })

  it("blocks enable for duplicate active public addresses", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig({
        publicEndpoints: [
          { ...endpoint, id: "active-route", status: "active" },
          { ...endpoint, id: "next-route", domain: "https://code.example.com", status: "disabled" },
        ],
      }),
    })

    const result = await runtime.enableEndpoint("next-route")

    expect(result.status).toBe("failed")
    expect(result.message).toContain("already in use")
  })

  it("enables endpoints only after runtime safety checks pass", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig({ publicEndpoints: [endpoint] }),
    })

    const result = await runtime.enableEndpoint(endpoint.id)

    expect(result.status).toBe("succeeded")
    expect((await runtime.listEndpoints())[0]?.status).toBe("active")
  })
})

describe("local management runtime cloudflare tunnel", () => {
  it("blocks tunnel start when no cloudflare endpoint reports OpenCode password protection", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig({
        toolInstances: [
          runningOpenCode,
          {
            id: "cloudflared-server",
            kind: "cloudflared",
            displayName: "cloudflared",
            hostType: "server",
            installState: "installed",
            binaryPath: "cloudflared",
            defaultPort: 0,
            status: "stopped",
          },
        ],
        publicEndpoints: [
          {
            ...endpoint,
            id: "cloudflare-route",
            targetType: "cloudflare",
            authMode: "basic-auth",
          },
        ],
      }),
    })

    const result = await runtime.startCloudflareTunnel({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })

    expect(result.status).toBe("failed")
    expect(result.message).toContain("OpenCode password protection must be configured")
  })
})

describe("local management runtime desktop tunnels", () => {
  it("provisions, lists, heartbeats, and deletes desktop tunnel devices", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig(),
      desktopTunnelProvisioning: {
        panelUrl: "https://frp.example.com",
        panelApiUrl: "https://frp.example.com",
        panelRpcUrl: "wss://frp.example.com/rpc",
        authToken: "restricted-token",
        serverAddr: "frp.example.com",
        serverPort: 7000,
        provisionRoute: async () => ({ status: "ready", publicUrl: "https://alice.frp.example.com", clientSecret: "desktop-client-secret" }),
      },
    })
    const provision = await runtime.provisionDesktopTunnel({ deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", preferredSubdomain: "alice" })
    const heartbeat = await runtime.sendDesktopTunnelHeartbeat({ deviceId: "desktop-alice", opencodeStatus: "running", frpcStatus: "running", tunnelStatus: "connected", publicUrl: provision.publicUrl, lastError: null })
    expect(provision.publicUrl).toBe("https://alice.frp.example.com")
    expect(provision.frpcConfig).toContain('auth.token = "desktop-client-secret"')
    expect(provision.frpcConfig).not.toContain("restricted-token")
    expect(heartbeat.status).toBe("online")
    expect(await runtime.listDesktopTunnelDevices()).toHaveLength(1)
    await runtime.deleteDesktopTunnelDevice("desktop-alice")
    expect(await runtime.listDesktopTunnelDevices()).toEqual([])
  })
})
