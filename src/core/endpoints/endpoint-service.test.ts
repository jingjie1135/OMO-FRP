import { describe, expect, it } from "bun:test"
import { validateEndpoint } from "./endpoint-service"

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
})
