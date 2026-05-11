import { afterEach, describe, expect, it, mock } from "bun:test"
import { createCloudflareTunnelPlan } from "./plan"

const originalPassword = process.env.OPENCODE_SERVER_PASSWORD
const originalWhich = Bun.which

afterEach(() => {
  if (originalPassword === undefined) {
    delete process.env.OPENCODE_SERVER_PASSWORD
  } else {
    process.env.OPENCODE_SERVER_PASSWORD = originalPassword
  }
  Bun.which = originalWhich
})

describe("createCloudflareTunnelPlan", () => {
  it("blocks remote exposure when OPENCODE_SERVER_PASSWORD is missing", () => {
    // given
    delete process.env.OPENCODE_SERVER_PASSWORD
    Bun.which = mock(() => "/usr/local/bin/tool")

    // when
    const plan = createCloudflareTunnelPlan({ mode: "quick" })

    // then
    expect(plan.canExpose).toBe(false)
    expect(plan.passwordConfigured).toBe(false)
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === "password-missing")).toBe(true)
  })

  it("creates quick tunnel commands for a password protected local OpenCode", () => {
    // given
    process.env.OPENCODE_SERVER_PASSWORD = "correct-horse-battery-staple"
    Bun.which = mock(() => "/usr/local/bin/tool")

    // when
    const plan = createCloudflareTunnelPlan({ port: 4123 })

    // then
    expect(plan.mode).toBe("quick")
    expect(plan.canExpose).toBe(true)
    expect(plan.localUrl).toBe("http://127.0.0.1:4123")
    expect(plan.publicUrl).toBe("https://<generated>.trycloudflare.com")
    expect(plan.cloudflaredCommands).toContain("cloudflared tunnel --url http://127.0.0.1:4123")
  })

  it("creates named tunnel commands with hostname and route setup", () => {
    // given
    process.env.OPENCODE_SERVER_PASSWORD = "correct-horse-battery-staple"
    Bun.which = mock(() => "/usr/local/bin/tool")

    // when
    const plan = createCloudflareTunnelPlan({
      hostname: "opencode.example.com",
      tunnelName: "local-opencode",
    })

    // then
    expect(plan.mode).toBe("named")
    expect(plan.publicUrl).toBe("https://opencode.example.com")
    expect(plan.cloudflaredCommands).toContain("cloudflared tunnel login")
    expect(plan.cloudflaredCommands).toContain("cloudflared tunnel create 'local-opencode'")
    expect(plan.cloudflaredCommands).toContain("cloudflared tunnel route dns 'local-opencode' 'opencode.example.com'")
  })

  it("diagnoses missing cloudflared and missing named tunnel hostname", () => {
    // given
    process.env.OPENCODE_SERVER_PASSWORD = "correct-horse-battery-staple"
    Bun.which = mock((command: string) => command === "cloudflared" ? null : "/usr/local/bin/tool")

    // when
    const plan = createCloudflareTunnelPlan({ mode: "named" })

    // then
    expect(plan.canExpose).toBe(false)
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === "cloudflared-missing")).toBe(true)
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === "hostname-missing")).toBe(true)
  })

  it("reports an invalid tunnel mode instead of silently using quick mode", () => {
    // given
    process.env.OPENCODE_SERVER_PASSWORD = "correct-horse-battery-staple"
    Bun.which = mock(() => "/usr/local/bin/tool")

    // when
    const plan = createCloudflareTunnelPlan({ mode: "warp" })

    // then
    expect(plan.canExpose).toBe(false)
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === "invalid-mode")).toBe(true)
  })

  it("includes success checks and diagnostics for common failures", () => {
    // given
    process.env.OPENCODE_SERVER_PASSWORD = "correct-horse-battery-staple"
    Bun.which = mock(() => "/usr/local/bin/tool")

    // when
    const plan = createCloudflareTunnelPlan()

    // then
    expect(plan.successChecks.join("\n")).toContain("requires the OpenCode password")
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining([
        "route-or-domain",
        "opencode-not-running",
        "port-conflict",
        "auth-failed",
      ]),
    )
    expect(plan.diagnostics.some((diagnostic) => diagnostic.code === "cloudflared-login")).toBe(false)
  })
})
