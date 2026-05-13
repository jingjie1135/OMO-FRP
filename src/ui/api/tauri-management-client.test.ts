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

  it("maps management methods to snake_case commands", async () => {
    const commands: string[] = []
    const client = createTauriManagementClient({
      invoke: async (command, args) => {
        commands.push(command)
        if (command === "detect_tools") {
          return []
        }
        if (command === "list_tool_instances") {
          return [{ id: "opencode-desktop", kind: "opencode", status: "stopped" }]
        }
        if (command === "get_tool_logs") {
          expect(args).toEqual({ instanceId: "opencode-desktop" })
          return []
        }
        if (
          command === "start_tool" ||
          command === "stop_tool" ||
          command === "restart_tool" ||
          command === "start_frp" ||
          command === "stop_frp"
        ) {
          return { status: "succeeded", message: command, jobId: `${command}-job` }
        }
        return { mode: "client", running: false, message: "frpc stopped" }
      },
    })

    expect(await client.detectTools()).toEqual([])
    expect(await client.listToolInstances()).toHaveLength(1)
    expect(await client.getToolLogs("opencode-desktop")).toEqual([])
    expect((await client.startTool("opencode-desktop")).status).toBe("succeeded")
    expect((await client.stopTool("opencode-desktop")).status).toBe("succeeded")
    expect((await client.restartTool("opencode-desktop")).status).toBe("succeeded")
    expect((await client.getFrpStatus()).mode).toBe("client")
    expect((await client.startFrp()).status).toBe("succeeded")
    expect((await client.stopFrp()).status).toBe("succeeded")
    expect(commands).toEqual([
      "detect_tools",
      "list_tool_instances",
      "get_tool_logs",
      "start_tool",
      "stop_tool",
      "restart_tool",
      "get_frp_status",
      "start_frp",
      "stop_frp",
    ])
  })
})
