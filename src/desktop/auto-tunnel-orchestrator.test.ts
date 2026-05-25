import { describe, expect, it } from "bun:test"
import type { DesktopRuntimeAdapter } from "./runtime-adapter"
import type { ManagementClient } from "../management-api/client"
import { createDesktopAutoTunnelOrchestrator } from "./auto-tunnel-orchestrator"

const successJob = { jobId: "job", status: "succeeded" as const, message: "ok" }

describe("desktop auto tunnel orchestrator", () => {
  it("starts OpenCode, provisions tunnel, writes frpc config, starts frpc, and heartbeats", async () => {
    const calls: string[] = []
    const savedFrpConfigs: Array<{ serverAddr: string; serverPort: number; rawConfig?: string }> = []
    const runtime = createRuntime(calls, { savedFrpConfigs })
    const client = createClient(calls)
    const orchestrator = createDesktopAutoTunnelOrchestrator({ runtime, client, deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096 })
    const state = await orchestrator.connect()
    expect(calls).toEqual(["startTool:opencode-desktop", "provisionDesktopTunnel", "saveFrpConfig", "startFrp", "sendDesktopTunnelHeartbeat"])
    expect(state).toMatchObject({ deviceId: "desktop-alice", deviceName: "Alice Laptop", opencodeStatus: "running", frpcStatus: "running", tunnelStatus: "connected", publicUrl: "https://alice.frp.example.com", localPort: 4096 })
    expect(savedFrpConfigs).toEqual([{ serverAddr: "frp.example.com", serverPort: 7000, rawConfig: 'serverAddr = "frp.example.com"\nserverPort = 7000\nauth.token = "server-issued-secret"\n' }])
  })

  it("keeps sending heartbeat while the desktop tunnel remains connected", async () => {
    const calls: string[] = []
    const heartbeats: string[] = []
    let scheduledHeartbeat: (() => void | Promise<void>) | undefined
    const runtime = createRuntime(calls)
    const client = createClient(calls, { heartbeats })
    const orchestrator = createDesktopAutoTunnelOrchestrator({
      runtime,
      client,
      deviceId: "desktop-alice",
      deviceName: "Alice Laptop",
      localHost: "127.0.0.1",
      localPort: 4096,
      heartbeatIntervalMs: 10_000,
      scheduleHeartbeat(callback, intervalMs) {
        expect(intervalMs).toBe(10_000)
        scheduledHeartbeat = callback
        return () => {}
      },
    })

    await orchestrator.connect()
    await scheduledHeartbeat?.()

    expect(heartbeats).toEqual(["connected", "connected"])
  })

  it("reports an actionable error and sends failure heartbeat when frpc start fails", async () => {
    const calls: string[] = []
    const runtime = createRuntime(calls, { frpcStartStatus: "failed", frpcMessage: "frpc executable was not found" })
    const client = createClient(calls)
    const orchestrator = createDesktopAutoTunnelOrchestrator({ runtime, client, deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096 })
    const state = await orchestrator.connect()
    expect(state).toMatchObject({ tunnelStatus: "error", frpcStatus: "error", lastError: "frpc executable was not found" })
    expect(calls).toContain("sendDesktopTunnelHeartbeat")
  })
})

function createRuntime(calls: string[], options: { frpcStartStatus?: "succeeded" | "failed"; frpcMessage?: string; savedFrpConfigs?: Array<{ serverAddr: string; serverPort: number; rawConfig?: string }> } = {}): DesktopRuntimeAdapter {
  return {
    async getRuntimeInfo() { throw new Error("not used") },
    async detectTools() { return [] },
    async listToolInstances() { return [] },
    async startTool(instanceId) { calls.push(`startTool:${instanceId}`); return successJob },
    async stopTool() { return successJob },
    async restartTool() { return successJob },
    async getToolLogs() { return [] },
    async getFrpStatus() { return { mode: "client", running: false, message: "stopped" } },
    async saveFrpConfig(config, rawConfig) { calls.push("saveFrpConfig"); options.savedFrpConfigs?.push({ serverAddr: config.serverAddr, serverPort: config.serverPort, rawConfig }) },
    async startFrp() { calls.push("startFrp"); return { jobId: "frpc", status: options.frpcStartStatus ?? "succeeded", message: options.frpcMessage ?? "frpc started" } },
    async stopFrp() { return successJob },
  }
}

function createClient(calls: string[], options: { heartbeats?: string[] } = {}): ManagementClient {
  return {
    async getRuntimeInfo() { throw new Error("not used") },
    async detectTools() { return [] },
    async listToolInstances() { return [] },
    async installTool() { return successJob },
    async startTool() { return successJob },
    async stopTool() { return successJob },
    async restartTool() { return successJob },
    async getToolLogs() { return [] },
    async readConfig(target) { return { target, content: "" } },
    async validateConfig() { return { valid: true, fieldErrors: [] } },
    async saveConfig() {},
    async listPresets() { return [] },
    async applyPreset() {},
    async listBackups() { return [] },
    async restoreBackup() {},
    async listEndpoints() { return [] },
    async saveEndpoint() {},
    async enableEndpoint() { return successJob },
    async disableEndpoint() { return successJob },
    async getFrpStatus() { return { mode: "client", running: false, message: "stopped" } },
    async saveFrpConfig() {},
    async startFrp() { return successJob },
    async stopFrp() { return successJob },
    async listDesktopTunnelDevices() { return [] },
    async provisionDesktopTunnel() { calls.push("provisionDesktopTunnel"); return { deviceId: "desktop-alice", publicUrl: "https://alice.frp.example.com", serverAddr: "frp.example.com", serverPort: 7000, proxyName: "opencode-alice", subdomain: "alice", frpcConfig: 'serverAddr = "frp.example.com"\nserverPort = 7000\nauth.token = "server-issued-secret"\n' } },
    async sendDesktopTunnelHeartbeat(request) { calls.push("sendDesktopTunnelHeartbeat"); options.heartbeats?.push(request.tunnelStatus); return {} as never },
    async deleteDesktopTunnelDevice() {},
    async getCloudflareTunnelStatus() { return { mode: "quick", running: false, message: "stopped" } },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() { throw new Error("not used") },
    async startCloudflareTunnel() { return successJob },
    async stopCloudflareTunnel() { return successJob },
    async retryCloudflareTunnelStep() { return successJob },
  }
}
