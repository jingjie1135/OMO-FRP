import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import type { ManagementClient } from "../../../management-api/client"
import { DesktopTunnelsPage } from "./DesktopTunnelsPage"
import { DesktopTunnelsPageWrapper } from "./DesktopTunnelsPageWrapper"

const mountedRoots: Root[] = []

const devices = [
  { id: "desktop-alice", name: "Alice Laptop", status: "online" as const, opencodeStatus: "running" as const, tunnelStatus: "connected" as const, frpcStatus: "running" as const, publicUrl: "https://alice.frp.example.com", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", subdomain: "alice", lastSeenAt: "2026-05-25T00:00:00.000Z" },
  { id: "desktop-bob", name: "Bob Desktop", status: "error" as const, opencodeStatus: "running" as const, tunnelStatus: "error" as const, frpcStatus: "error" as const, localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-bob", lastError: "frpc executable was not found token=secret" },
]

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

function render(element: React.ReactNode) {
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  act(() => root.render(element))
  return container
}

describe("DesktopTunnelsPage", () => {
  it("renders device status, public URL actions, and redacted diagnostics", () => {
    const html = renderToStaticMarkup(<DesktopTunnelsPage devices={devices} />)
    expect(html).toContain("远程设备")
    expect(html).toContain("Alice Laptop")
    expect(html).toContain("在线")
    expect(html).toContain("https://alice.frp.example.com")
    expect(html).toContain("打开 OpenCode")
    expect(html).toContain("复制 URL")
    expect(html).toContain("Bob Desktop")
    expect(html).toContain("错误")
    expect(html).toContain("frpc executable was not found token=[REDACTED]")
    expect(html).not.toContain("token=secret")
  })

  it("invokes copy URL callbacks and shows redacted diagnostics details", () => {
    const copied: string[] = []
    const container = render(<DesktopTunnelsPage devices={devices} copyUrl={(url) => { copied.push(url) }} />)

    const copyButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("复制 URL"))
    if (!copyButton) throw new Error("Copy button did not render")
    act(() => copyButton.click())

    expect(copied).toEqual(["https://alice.frp.example.com"])
    expect(container.textContent).toContain("查看诊断")
    expect(container.textContent).toContain("诊断详情")
    expect(container.textContent).toContain("frpc executable was not found token=[REDACTED]")
    expect(container.textContent).not.toContain("token=secret")
  })

  it("shows an empty state before any desktop has connected", () => {
    const html = renderToStaticMarkup(<DesktopTunnelsPage devices={[]} />)
    expect(html).toContain("还没有桌面端连接")
    expect(html).toContain("打开 Tauri 桌面端后会自动申请 FRP 隧道")
  })

  it("wires production copy actions through the page wrapper", async () => {
    const copied: string[] = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { copied.push(value) } },
    })
    const container = render(<DesktopTunnelsPageWrapper client={createClient()} initialDevices={devices} />)

    const copyButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("复制 URL"))
    if (!copyButton) throw new Error("Copy button did not render")
    expect(copyButton.disabled).toBe(false)
    await act(async () => copyButton.click())

    expect(copied).toEqual(["https://alice.frp.example.com"])
  })
})

function createClient(): ManagementClient {
  const successJob = { jobId: "job", status: "succeeded" as const, message: "ok" }
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
    async listDesktopTunnelDevices() { return devices },
    async provisionDesktopTunnel() { throw new Error("not used") },
    async sendDesktopTunnelHeartbeat() { throw new Error("not used") },
    async deleteDesktopTunnelDevice() {},
    async getCloudflareTunnelStatus() { return { mode: "quick", running: false, message: "stopped" } },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() { throw new Error("not used") },
    async startCloudflareTunnel() { return successJob },
    async stopCloudflareTunnel() { return successJob },
    async retryCloudflareTunnelStep() { return successJob },
  }
}
