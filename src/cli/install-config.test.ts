import { afterEach, describe, expect, it } from "bun:test"
import { buildServerDeployPlan, buildStartPlan, createStrongPassword } from "./install-config"

describe("install-config start plan", () => {
  const originalPassword = process.env.OPENCODE_SERVER_PASSWORD

  afterEach(() => {
    if (originalPassword === undefined) {
      delete process.env.OPENCODE_SERVER_PASSWORD
    } else {
      process.env.OPENCODE_SERVER_PASSWORD = originalPassword
    }
  })

  it("blocks remote plans when password generation is disabled and no password exists", () => {
    // given
    delete process.env.OPENCODE_SERVER_PASSWORD

    // when
    const build = () => buildStartPlan({ remote: true, generatePassword: false })

    // then
    expect(build).toThrow("Remote OpenCode access requires OPENCODE_SERVER_PASSWORD")
  })

  it("generates a password for remote plans by default", () => {
    // given
    delete process.env.OPENCODE_SERVER_PASSWORD

    // when
    const plan = buildStartPlan({ remote: true, port: 4097, publicUrl: "https://openagent.test" })

    // then
    const generatedPassword = plan.generatedPassword
    expect(generatedPassword).toBeTruthy()
    if (generatedPassword === null) {
      throw new Error("expected remote start plan to generate a password")
    }
    expect(plan.env.OPENCODE_SERVER_PASSWORD).toBe(generatedPassword)
    expect(plan.command).toContain("opencode serve --hostname 127.0.0.1 --port 4097")
    expect(plan.command).not.toContain(generatedPassword)
    expect(plan.publicUrl).toBe("https://openagent.test")
  })

  it("does not expose an existing password as a generated password", () => {
    // given
    process.env.OPENCODE_SERVER_PASSWORD = "existing-secret"

    // when
    const plan = buildStartPlan({ remote: true })

    // then
    expect(plan.generatedPassword).toBeNull()
    expect(plan.env.OPENCODE_SERVER_PASSWORD).toBe("existing-secret")
  })

  it("creates strong random passwords", () => {
    // when
    const password = createStrongPassword()

    // then
    expect(password.length).toBeGreaterThanOrEqual(24)
    expect(password).not.toContain("=")
  })
})

describe("install-config server deploy plan", () => {
  it("returns the server closure needed by automation", () => {
    // when
    const plan = buildServerDeployPlan({
      domain: "openremote.example.com",
      email: "admin@example.com",
      installRoot: "/opt/test-opencode-remote",
      opencodePort: 4099,
    })

    // then
    expect(plan.envPath).toBe("/opt/test-opencode-remote/.env")
    expect(plan.opencodePublicUrl).toBe("https://openremote.example.com")
    expect(plan.frpPanelApiUrl).toBe("https://frp.openremote.example.com")
    expect(plan.frpPanelRpcUrl).toBe("wss://frp.openremote.example.com/rpc")
    expect(plan.managesOpenCodeByDefault).toBe(false)
    expect(plan.requiredSecrets).not.toContain("OPENCODE_SERVER_PASSWORD")
    expect(plan.requiredSecrets).toContain("FRP_PANEL_APP_GLOBAL_SECRET")
    expect(plan.requiredSecrets).toContain("OPENCODE_REMOTE_BASIC_AUTH_PASSWORD_HASH")
    expect(plan.commands.join("\n")).not.toContain("opencode-remote detect --remote --port 4099")
    expect(plan.commands.join("\n")).not.toContain("bunx oh-my-openagent install --no-tui")
    expect(plan.explicitToolActions.map((action) => action.id)).toEqual(["detect-opencode", "install-oh-my-openagent-plugin", "start-opencode"])
    expect(plan.explicitToolActions.map((action) => action.command).join("\n")).toContain("opencode-remote detect --remote --port 4099")
    expect(plan.explicitToolActions.map((action) => action.command).join("\n")).toContain("bunx oh-my-openagent install --no-tui")
  })

  it("requires a domain and email", () => {
    // when
    const missingDomain = () => buildServerDeployPlan({ email: "admin@example.com" })
    const missingEmail = () => buildServerDeployPlan({ domain: "example.com" })

    // then
    expect(missingDomain).toThrow("--domain")
    expect(missingEmail).toThrow("--email")
  })
})
