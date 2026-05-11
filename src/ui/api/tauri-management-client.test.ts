import { describe, expect, it } from "bun:test"
import { createTauriManagementClient } from "./tauri-management-client"

describe("tauri management client", () => {
  it("loads runtime info through invoke", async () => {
    const client = createTauriManagementClient({
      invoke: async (command) => {
        expect(command).toBe("get_runtime_info")
        return { capabilities: { mode: "desktop" } }
      },
    })

    const info = await client.getRuntimeInfo()
    expect(info.capabilities.mode).toBe("desktop")
  })

  it("maps detection and FRP status calls to snake_case commands", async () => {
    const commands: string[] = []
    const client = createTauriManagementClient({
      invoke: async (command) => {
        commands.push(command)
        if (command === "detect_tools") {
          return []
        }
        return { mode: "client", running: false, message: "frpc stopped" }
      },
    })

    expect(await client.detectTools()).toEqual([])
    expect(await client.getFrpStatus()).toMatchObject({ mode: "client", running: false })
    expect(commands).toEqual(["detect_tools", "get_frp_status"])
  })
})
