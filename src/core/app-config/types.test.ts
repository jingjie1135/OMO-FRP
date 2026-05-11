import { describe, expect, it } from "bun:test"
import type { AppConfig as CoreAppConfig } from "../schema"
import { DESKTOP_CAPABILITIES, fromCoreAppConfig, SERVER_CAPABILITIES } from "./types"

describe("runtime capabilities", () => {
  it("distinguishes server and desktop FRP responsibilities", () => {
    expect(SERVER_CAPABILITIES.canManageFrpServer).toBe(true)
    expect(SERVER_CAPABILITIES.canManageFrpClient).toBe(false)
    expect(DESKTOP_CAPABILITIES.canManageFrpServer).toBe(false)
    expect(DESKTOP_CAPABILITIES.canManageFrpClient).toBe(true)
  })

  it("derives management config from the existing core schema", () => {
    const coreConfig: CoreAppConfig = {
      schemaVersion: 1,
      mode: "server",
      tools: [
        {
          id: "opencode-local",
          kind: "opencode",
          executable: "opencode",
          auth: { required: true },
          installState: "configured",
        },
      ],
      plugins: [
        {
          toolId: "opencode-local",
          kind: "oh-my-openagent",
          package: "oh-my-openagent",
          configPath: "/opencode/oh-my-openagent.json",
          enabled: true,
        },
      ],
      routes: [
        {
          id: "server-opencode",
          toolId: "opencode-local",
          provider: "frp",
          publicHost: "code.example.com",
          targetHost: "127.0.0.1",
          targetPort: 4096,
          authRequired: true,
          status: "planned",
        },
      ],
      frp: { clients: [] },
      secrets: [],
    }

    const managementConfig = fromCoreAppConfig(coreConfig)

    expect(managementConfig.toolInstances[0]).toMatchObject({ id: "opencode-local", kind: "opencode", displayName: "OpenCode" })
    expect(managementConfig.pluginConfigs[0]).toMatchObject({ toolInstanceId: "opencode-local", status: "configured" })
    expect(managementConfig.publicEndpoints[0]).toMatchObject({ id: "server-opencode", domain: "code.example.com", authMode: "opencode-password" })
  })
})
