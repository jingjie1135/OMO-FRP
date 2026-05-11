import { describe, expect, it } from "bun:test"
import type { AppConfig, SecretRef } from "./schema"
import { redactLog, redactRecord } from "./redactor"
import { validateAppConfig } from "./validator"
import { createFrpClientProfile } from "../integrations/frp/profile"
import { createOpenCodeTool, planOpenCodeExpose, planOpenCodeStart } from "../integrations/opencode/adapter"
import { createOhMyOpenAgentPlugin, planOhMyOpenAgentInstall } from "../integrations/oh-my-openagent/adapter"

describe("core platform contracts", () => {
  const passwordRef: SecretRef = { id: "opencode-password", source: "env", name: "OPENCODE_SERVER_PASSWORD" }
  const frpTokenRef: SecretRef = { id: "frp-token", source: "env", name: "FRP_TOKEN" }

  it("validates shared config, routes, plugins, and FRP proxy references", () => {
    const tool = createOpenCodeTool({ passwordSecretId: passwordRef.id, installState: "configured" })
    const route = {
      id: "opencode-public",
      toolId: tool.id,
      provider: "frp" as const,
      publicHost: "opencode.example.com",
      targetHost: "127.0.0.1",
      targetPort: 4096,
      authRequired: true,
      status: "planned" as const,
    }
    const config: AppConfig = {
      schemaVersion: 1,
      mode: "server",
      tools: [tool],
      plugins: [createOhMyOpenAgentPlugin(tool.id, "/opt/opencode-remote-platform/opencode/oh-my-openagent.json")],
      routes: [route],
      frp: { clients: [createFrpClientProfile({ serverAddr: "frp.example.com", serverPort: 7000, tokenRef: frpTokenRef, routes: [route] })] },
      secrets: [passwordRef, frpTokenRef],
    }

    expect(validateAppConfig(config)).toEqual([])
    expect(config.frp.clients[0]?.proxies[0]?.routeId).toBe("opencode-public")
  })

  it("blocks public routes without tool password and route auth", () => {
    const tool = createOpenCodeTool()
    const route = {
      id: "unsafe",
      toolId: tool.id,
      provider: "frp" as const,
      publicHost: "unsafe.example.com",
      targetHost: "127.0.0.1",
      targetPort: 4096,
      authRequired: false,
      status: "planned" as const,
    }
    const config: AppConfig = {
      schemaVersion: 1,
      mode: "server",
      tools: [tool],
      plugins: [],
      routes: [route],
      frp: { clients: [] },
      secrets: [],
    }

    expect(validateAppConfig(config).map((issue) => issue.code)).toEqual(expect.arrayContaining(["route-auth-required", "tool-password-missing"]))
    expect(planOpenCodeExpose(tool, route).issues.map((issue) => issue.code)).toContain("route-auth-required")
  })

  it("keeps command execution behind adapter-owned argv arrays and redacts logs", () => {
    const tool = createOpenCodeTool({ passwordSecretId: passwordRef.id })
    const startPlan = planOpenCodeStart(tool, 4096)
    const pluginPlan = planOhMyOpenAgentInstall(createOhMyOpenAgentPlugin(tool.id))

    expect(startPlan.commands[0]).toMatchObject({ adapter: "opencode", executable: "opencode", args: ["serve", "--hostname", "127.0.0.1", "--port", "4096"] })
    expect(pluginPlan.commands[0]?.args).toContain("install")
    expect(redactLog("OPENCODE_SERVER_PASSWORD=secret auth.token = \"abc\"")).toContain("<redacted>")
    expect(redactRecord({ token: "abc", visible: "ok" })).toEqual({ token: "<redacted>", visible: "ok" })
  })
})
