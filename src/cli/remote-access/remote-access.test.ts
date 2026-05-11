import { describe, expect, it, mock, beforeEach, afterAll } from "bun:test"
import * as originalPortUtils from "../../shared/port-utils"

const mockIsPortAvailable = mock(() => Promise.resolve(false))

mock.module("../../shared/port-utils", () => ({
  DEFAULT_SERVER_PORT: 4096,
  isPortAvailable: mockIsPortAvailable,
}))

afterAll(() => {
  mock.module("../../shared/port-utils", () => originalPortUtils)
  mock.restore()
})

const { assertStrongPassword } = await import("./password")
const { buildPublicUrl } = await import("./public-url")
const { generateFrpcConfig } = await import("./frpc-config")
const { normalizeRemoteAccessOptions } = await import("./options")
const { createRemoteAccessPlan } = await import("./plan")

describe("remote access", () => {
  beforeEach(() => {
    mockIsPortAvailable.mockClear()
    mockIsPortAvailable.mockResolvedValue(false)
    delete process.env.OPENCODE_SERVER_PASSWORD
    delete process.env.OPENCODE_SERVER_USERNAME
  })

  it("rejects missing or weak OpenCode passwords", () => {
    // given
    const weakPassword = "password123"

    // when
    const checks = [
      () => assertStrongPassword(weakPassword),
      () => assertStrongPassword("1234567890123456"),
      () => assertStrongPassword("lowercase-only-password"),
      () => assertStrongPassword("Strong-password-123!"),
    ]

    // then
    expect(checks[0]).toThrow("Password must be at least 16 characters long")
    expect(checks[1]).toThrow("Password is too easy to guess")
    expect(checks[2]).toThrow("Password must include at least three")
    expect(checks[3]).not.toThrow()
  })

  it("normalizes options with secure defaults", () => {
    // given
    const password = "Strong-password-123!"

    // when
    const options = normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com/",
      authToken: "secret-token",
      password,
      subdomain: "alice-code",
      noFrpc: true,
    })

    // then
    expect(options.panelUrl).toBe("https://frp.example.com")
    expect(options.serverAddr).toBe("frp.example.com")
    expect(options.serverPort).toBe(7000)
    expect(options.localPort).toBe(4096)
    expect(options.proxyType).toBe("http")
    expect(options.username).toBe("opencode")
    expect(options.noFrpc).toBe(true)
  })

  it("rejects invalid routing and transport combinations", () => {
    // given
    const baseOptions = {
      panelUrl: "https://frp.example.com",
      authToken: "secret-token",
      password: "Strong-password-123!",
      noFrpc: true,
    }

    // when
    const invalidTransport = () => normalizeRemoteAccessOptions({ ...baseOptions, transport: "udp" })
    const mixedRouting = () => normalizeRemoteAccessOptions({ ...baseOptions, remotePort: 18080, subdomain: "alice-code" })

    // then
    expect(invalidTransport).toThrow("transport must be one of")
    expect(mixedRouting).toThrow("Use either --remote-port")
  })

  it("generates http frpc config for subdomain routing", () => {
    // given
    const options = normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com",
      authToken: "secret-token",
      password: "Strong-password-123!",
      proxyName: "alice-opencode",
      subdomain: "alice-code",
      noFrpc: true,
    })

    // when
    const config = generateFrpcConfig(options)

    // then
    expect(config).toContain('serverAddr = "frp.example.com"')
    expect(config).toContain('auth.token = "secret-token"')
    expect(config).toContain('name = "alice-opencode"')
    expect(config).toContain('type = "http"')
    expect(config).toContain("localPort = 4096")
    expect(config).toContain('subdomain = "alice-code"')
    expect(config).not.toContain("remotePort")
  })

  it("generates tcp frpc config for remote port routing", () => {
    // given
    const options = normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com",
      authToken: "secret-token",
      password: "Strong-password-123!",
      proxyName: "alice-opencode",
      remotePort: 18080,
      noFrpc: true,
    })

    // when
    const config = generateFrpcConfig(options)

    // then
    expect(options.proxyType).toBe("tcp")
    expect(config).toContain('type = "tcp"')
    expect(config).toContain("remotePort = 18080")
    expect(config).not.toContain("subdomain")
  })

  it("builds public URLs for common frp-panel routes", () => {
    // given
    const base = normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com",
      authToken: "secret-token",
      password: "Strong-password-123!",
      noFrpc: true,
    })

    // when
    const subdomainUrl = buildPublicUrl({ ...base, subdomain: "alice-code" })
    const customDomainUrl = buildPublicUrl({ ...base, customDomain: "code.example.com" })
    const remotePortUrl = buildPublicUrl({ ...base, remotePort: 18080, https: false })

    // then
    expect(subdomainUrl).toBe("https://alice-code.frp.example.com")
    expect(customDomainUrl).toBe("https://code.example.com")
    expect(remotePortUrl).toBe("http://frp.example.com:18080")
  })

  it("creates a plan with access URLs and diagnostics", async () => {
    // given
    const options = normalizeRemoteAccessOptions({
      panelUrl: "https://frp.example.com",
      authToken: "secret-token",
      password: "Strong-password-123!",
      subdomain: "alice-code",
      noStart: true,
      noFrpc: true,
    })
    mockIsPortAvailable.mockResolvedValueOnce(true)

    // when
    const plan = await createRemoteAccessPlan(options)

    // then
    expect(plan.localUrl).toBe("http://127.0.0.1:4096")
    expect(plan.publicUrl).toBe("https://alice-code.frp.example.com")
    expect(plan.diagnostics).toContain("Local service: nothing is listening on the selected OpenCode port.")
    expect(mockIsPortAvailable).toHaveBeenCalledWith(4096, "127.0.0.1")
  })
})
