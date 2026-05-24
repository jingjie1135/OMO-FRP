import { describe, expect, it } from "bun:test"
import { checkEndpointSafety, formatEndpointPublicAddress, normalizeEndpointAddress, validateEndpoint } from "./endpoint-service"
import type { RuntimeCapabilities, ToolInstance } from "../app-config/types"

const serverCapabilities: RuntimeCapabilities = {
  mode: "server",
  canManageFrpServer: true,
  canManageFrpClient: false,
  canInstallServerServices: true,
  canAccessLocalFilesystem: true,
  canManageSystemd: true,
  canManageLocalProcesses: true,
}

const runningOpenCode: ToolInstance = {
  id: "tool-opencode-server",
  kind: "opencode",
  displayName: "OpenCode",
  hostType: "server",
  installState: "configured",
  defaultPort: 4096,
  currentPort: 4096,
  status: "running",
}

describe("endpoint validation", () => {
  it("accepts public OpenCode endpoint with authentication", () => {
    const result = validateEndpoint({
      id: "server-opencode",
      name: "Server OpenCode",
      domain: "server-code.example.com",
      protocol: "https",
      targetType: "server-local",
      targetToolInstanceId: "tool-opencode-server",
      authMode: "opencode-password",
      status: "disabled",
    })

    expect(result.ok).toBe(true)
  })

  it("rejects active public endpoint without authentication", () => {
    const result = validateEndpoint({
      id: "unsafe",
      name: "Unsafe",
      domain: "unsafe.example.com",
      protocol: "https",
      targetType: "server-local",
      targetToolInstanceId: "tool-opencode-server",
      authMode: "basic-auth",
      status: "active",
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain("endpoint-auth-incomplete")
  })

  it("normalizes full public URLs into protocol and host fields", () => {
    const normalized = normalizeEndpointAddress({
      id: "server-opencode",
      name: "Server OpenCode",
      domain: "https://server-code.example.com/session",
      protocol: "http",
      targetType: "server-local",
      targetToolInstanceId: "tool-opencode-server",
      authMode: "opencode-password",
      status: "disabled",
    })

    expect(normalized.protocol).toBe("https")
    expect(normalized.domain).toBe("server-code.example.com")
    expect(formatEndpointPublicAddress(normalized)).toBe("https://server-code.example.com")
  })

  it("accepts desktop frp endpoints when the runtime can manage the frp server", () => {
    const result = checkEndpointSafety({
      id: "desktop-route",
      name: "Desktop Route",
      domain: "desktop.example.com",
      protocol: "https",
      targetType: "desktop-frp",
      targetToolInstanceId: "tool-opencode-server",
      authMode: "opencode-password",
      status: "active",
    }, {
      capabilities: serverCapabilities,
      toolInstances: [runningOpenCode],
      endpoints: [],
    })

    expect(result.ok).toBe(true)
  })

  it("rejects cloudflare endpoints without cloudflared availability", () => {
    const result = checkEndpointSafety({
      id: "cloudflare-route",
      name: "Cloudflare Route",
      domain: "cloud.example.com",
      protocol: "https",
      targetType: "cloudflare",
      targetToolInstanceId: "tool-opencode-server",
      authMode: "opencode-password",
      status: "active",
    }, {
      capabilities: serverCapabilities,
      toolInstances: [runningOpenCode],
      endpoints: [],
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain("endpoint-cloudflare-unavailable")
  })

  it("detects active endpoint public address conflicts after URL normalization", () => {
    const result = checkEndpointSafety({
      id: "next-route",
      name: "Next Route",
      domain: "https://code.example.com",
      protocol: "https",
      targetType: "server-local",
      targetToolInstanceId: "tool-opencode-server",
      authMode: "opencode-password",
      status: "active",
    }, {
      capabilities: serverCapabilities,
      toolInstances: [runningOpenCode],
      endpoints: [{
        id: "active-route",
        name: "Active Route",
        domain: "code.example.com",
        protocol: "https",
        targetType: "server-local",
        targetToolInstanceId: "tool-opencode-server",
        authMode: "opencode-password",
        status: "active",
      }],
    })

    expect(result.ok).toBe(false)
    expect(result.issues.map((issue) => issue.code)).toContain("endpoint-domain-conflict")
  })
})
