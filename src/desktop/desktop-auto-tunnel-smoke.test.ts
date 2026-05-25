import { describe, expect, it } from "bun:test"
import { createDesktopAutoTunnelOrchestrator } from "./auto-tunnel-orchestrator"
import { SERVER_CAPABILITIES } from "../core/app-config/types"
import { createLocalManagementRuntime } from "../management-api/local-management-runtime"
import { renderManagementApp } from "../ui/app/App"

const successJob = { jobId: "job", status: "succeeded" as const, message: "ok" }

describe("desktop auto tunnel smoke", () => {
  it("drives provision to heartbeat to management UI surface", async () => {
    const server = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
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
    const runtime = {
      async getRuntimeInfo() { throw new Error("not used") },
      async detectTools() { return [] },
      async listToolInstances() { return [] },
      async startTool() { return successJob },
      async stopTool() { return successJob },
      async restartTool() { return successJob },
      async getToolLogs() { return [] },
      async getFrpStatus() { return { mode: "client" as const, running: false, message: "stopped" } },
      async saveFrpConfig() {},
      async startFrp() { return successJob },
      async stopFrp() { return successJob },
    }

    const orchestrator = createDesktopAutoTunnelOrchestrator({ runtime, client: server, deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, preferredSubdomain: "alice" })
    await orchestrator.connect()

    const html = await renderManagementApp(server)
    expect(html).toContain("远程设备")
    expect(html).toContain("Alice Laptop")
    expect(html).toContain("https://alice.frp.example.com")
    expect(html).toContain("在线")
  })
})
