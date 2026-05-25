import { describe, expect, it } from "bun:test"
import type { ManagementClient } from "../../management-api/client"
import type { Diagnostics, FrpStatus, JobResult, RuntimeInfo } from "../../management-api/types"
import { renderManagementApp } from "./App"

const serverInfo = createRuntimeInfo("server", true)
const desktopInfo = createRuntimeInfo("desktop", true)

describe("management UI acceptance", () => {
  it("renders an understandable app-level error when the backend is unreachable", async () => {
    const html = await renderManagementApp(createUnavailableClient(new Error("connect ECONNREFUSED 127.0.0.1:4096 Authorization: Bearer raw-token auth_token=raw-snake")))

    expect(html).toContain('role="alert"')
    expect(html).toContain("Management backend is unavailable")
    expect(html).toContain("connect ECONNREFUSED 127.0.0.1:4096")
    expect(html).toContain("Authorization: Bearer [REDACTED]")
    expect(html).toContain("auth_token=[REDACTED]")
    expect(html).not.toContain("raw-token")
    expect(html).not.toContain("raw-snake")
  })

  it("keeps server and desktop runtime navigation capability-driven", async () => {
    const serverCalls: string[] = []
    const desktopCalls: string[] = []

    const serverHtml = await renderManagementApp(createAcceptanceClient(serverInfo, serverCalls))
    const desktopHtml = await renderManagementApp(createAcceptanceClient(desktopInfo, desktopCalls))

    expect(serverHtml).toContain("FOMO")
    expect(serverHtml).toContain("服务器模式")
    expect(serverHtml).toContain("Cloudflare 隧道")
    expect(serverHtml).toContain("远程设备")
    expect(serverHtml).toContain("Alice Laptop")
    expect(serverHtml).toContain("dashboard:server")
    expect(serverHtml).toContain('data-frp-panel="server"')
    expect(serverHtml).toContain('data-settings-mode="server"')

    expect(desktopHtml).toContain("FOMO")
    expect(desktopHtml).toContain("桌面模式")
    expect(desktopHtml).toContain("Cloudflare 隧道")
    expect(desktopHtml).toContain("dashboard:desktop")
    expect(desktopHtml).toContain('data-frp-panel="client"')
    expect(desktopHtml).toContain('data-settings-mode="desktop"')

    expect(serverCalls).toContain("listDesktopTunnelDevices")
    expect(serverCalls).toContain("createCloudflareTunnelPlan")
    expect(desktopCalls).toContain("createCloudflareTunnelPlan")
  })

  it("does not load Cloudflare page data when the runtime capability is disabled", async () => {
    const calls: string[] = []
    const html = await renderManagementApp(createAcceptanceClient(createRuntimeInfo("server", false), calls))

    expect(html).not.toContain("Cloudflare 隧道")
    expect(calls).not.toContain("getCloudflareTunnelStatus")
    expect(calls).not.toContain("createCloudflareTunnelPlan")
  })

  it("documents the final release-readiness quality gates", async () => {
    const guide = await Bun.file("docs/guide/management-ui.md").text()
    const readme = await Bun.file("README.md").text()

    expect(guide).not.toContain("当前骨架状态")
    expect(guide).toContain("Task 10 发布就绪验收")
    expect(guide).toContain("src/ui/app/management-ui-acceptance.test.tsx")
    expect(guide).toContain("cargo check")
    expect(readme).toContain("src/ui/app/management-ui-acceptance.test.tsx")
  })

  it("keeps shared UI code inside the ManagementClient boundary", async () => {
    const forbiddenPatterns = [
      /from ["']@tauri-apps\/api/,
      /\binvoke\(/,
      /\blocalStorage\b/,
      /\bsessionStorage\b/,
      /document\.cookie/,
      /tauri_plugin_shell/,
      /shell:default/,
    ]

    const uiFiles = await Array.fromAsync(new Bun.Glob("src/ui/**/*.{ts,tsx}").scan({ cwd: process.cwd(), absolute: false }))
    const boundaryExceptions = new Set([
      "src/ui/browser-management-client.ts",
      "src/ui/browser-management-client.test.ts",
      "src/ui/api/tauri-management-client.ts",
      "src/ui/api/tauri-management-client.test.ts",
      "src/ui/api/tauri-bridge-contract.test.ts",
      "src/ui/app/management-ui-acceptance.test.tsx",
    ])

    for (const file of uiFiles) {
      if (boundaryExceptions.has(file.replaceAll("\\", "/"))) continue

      const source = await Bun.file(file).text()
      for (const pattern of forbiddenPatterns) {
        expect(source, `${file} must not match ${pattern}`).not.toMatch(pattern)
      }
    }
  })
})

function createRuntimeInfo(mode: "server" | "desktop", canManageCloudflareTunnel: boolean): RuntimeInfo {
  return {
    capabilities: {
      mode,
      canManageFrpServer: mode === "server",
      canManageFrpClient: mode === "desktop",
      canManageCloudflareTunnel,
      canInstallServerServices: mode === "server",
      canAccessLocalFilesystem: true,
      canManageSystemd: mode === "server",
      canManageLocalProcesses: true,
    },
    config: {
      mode,
      toolInstances: [
        {
          id: mode === "server" ? "opencode-server" : "opencode-desktop",
          kind: "opencode",
          displayName: "OpenCode",
          hostType: mode,
          installState: "configured",
          configDirectory: mode === "server" ? "/opt/opencode-remote-platform/config" : "C:/Users/Alice/.config/opencode",
          defaultPort: 4096,
          currentPort: 4096,
          status: "running",
        },
      ],
      pluginConfigs: [
        {
          toolInstanceId: mode === "server" ? "opencode-server" : "opencode-desktop",
          plugin: "oh-my-openagent",
          configPath: mode === "server" ? "/opt/opencode-remote-platform/config/oh-my-openagent.json" : "C:/Users/Alice/.config/opencode/oh-my-openagent.json",
          status: "configured",
          presets: [],
        },
      ],
      publicEndpoints: [
        {
          id: mode === "server" ? "server-route" : "desktop-route",
          name: mode === "server" ? "Server Route" : "Desktop Route",
          domain: mode === "server" ? "server.example.com" : "desktop.example.com",
          protocol: "https",
          targetType: mode === "server" ? "server-local" : "desktop-frp",
          targetToolInstanceId: mode === "server" ? "opencode-server" : "opencode-desktop",
          authMode: "both",
          status: "active",
        },
      ],
      frpServer: mode === "server" ? {
        enabled: true,
        panelUrl: "https://frp.example.com",
        rpcUrl: "https://frp.example.com/rpc",
        serverAddr: "frp.example.com",
        bindPort: 7000,
        authTokenRef: "FRP_TOKEN",
        dashboardEnabled: true,
      } : undefined,
      frpClients: mode === "desktop" ? [
        {
          endpointId: "desktop-route",
          serverAddr: "frp.example.com",
          serverPort: 7000,
          authTokenRef: "FRP_TOKEN",
          localHost: "127.0.0.1",
          localPort: 4096,
          proxyName: "alice-code",
          subdomain: "alice-code",
          transport: "tcp",
        },
      ] : [],
    },
  }
}

function createUnavailableClient(error: Error): ManagementClient {
  return {
    ...createAcceptanceClient(serverInfo, []),
    async getRuntimeInfo() {
      throw error
    },
  }
}

function createAcceptanceClient(runtimeInfo: RuntimeInfo, calls: string[]): ManagementClient {
  const successJob: JobResult = { jobId: "acceptance", status: "succeeded", message: "ok" }
  const frpStatus: FrpStatus = {
    mode: runtimeInfo.capabilities.canManageFrpServer ? "server" : runtimeInfo.capabilities.canManageFrpClient ? "client" : "unavailable",
    running: true,
    status: "ready",
    message: runtimeInfo.capabilities.canManageFrpServer ? "FRP server is running." : "frpc is connected.",
    publicUrl: runtimeInfo.config.publicEndpoints[0]?.domain ? `https://${runtimeInfo.config.publicEndpoints[0].domain}` : undefined,
  }
  const diagnostics: Diagnostics = { runtime: runtimeInfo, tools: [], endpoints: runtimeInfo.config.publicEndpoints, frp: frpStatus, jobs: [], redactedLogs: [] }

  return {
    async getRuntimeInfo() {
      calls.push("getRuntimeInfo")
      return runtimeInfo
    },
    async detectTools() {
      calls.push("detectTools")
      return [{ kind: "opencode", displayName: "OpenCode", detected: true }]
    },
    async listToolInstances() {
      calls.push("listToolInstances")
      return runtimeInfo.config.toolInstances
    },
    async installTool() { return successJob },
    async startTool() { return successJob },
    async stopTool() { return successJob },
    async restartTool() { return successJob },
    async getToolLogs() {
      calls.push("getToolLogs")
      return [{ timestamp: "2026-05-17T00:00:00.000Z", level: "info", message: "OpenCode ready token=[REDACTED]" }]
    },
    async readConfig(target) { return { target, content: "{}" } },
    async validateConfig() { return { valid: true, fieldErrors: [] } },
    async saveConfig() {},
    async listPresets() { return [] },
    async applyPreset() {},
    async listBackups(target) { return [{ id: "backup-1", target, path: "/tmp/backup-1", createdAt: "2026-05-17T00:00:00.000Z" }] },
    async restoreBackup() {},
    async listEndpoints() {
      calls.push("listEndpoints")
      return runtimeInfo.config.publicEndpoints
    },
    async saveEndpoint() {},
    async enableEndpoint() { return successJob },
    async disableEndpoint() { return successJob },
    async getFrpStatus() {
      calls.push("getFrpStatus")
      return frpStatus
    },
    async saveFrpConfig() {},
    async startFrp() { return successJob },
    async stopFrp() { return successJob },
    async listDesktopTunnelDevices() {
      calls.push("listDesktopTunnelDevices")
      return [{ id: "desktop-alice", name: "Alice Laptop", status: "online", opencodeStatus: "running", tunnelStatus: "connected", frpcStatus: "running", publicUrl: "https://alice.frp.example.com", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", subdomain: "alice", lastSeenAt: "2026-05-25T00:00:00.000Z" }]
    },
    async provisionDesktopTunnel() { throw new Error("Desktop tunnel provisioning is not configured for this test client") },
    async sendDesktopTunnelHeartbeat() { throw new Error("Desktop tunnel heartbeat is not configured for this test client") },
    async deleteDesktopTunnelDevice() {},    async getCloudflareTunnelStatus() {
      calls.push("getCloudflareTunnelStatus")
      return { mode: "quick", running: false, message: "Cloudflare Tunnel stopped." }
    },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() {
      calls.push("createCloudflareTunnelPlan")
      return {
        mode: "quick",
        localUrl: "http://127.0.0.1:4096",
        publicUrl: "https://generated.trycloudflare.com",
        commandSummary: ["cloudflared tunnel --url http://127.0.0.1:4096"],
        cloudflaredDetected: true,
        diagnostics: [],
        securityNotes: ["OpenCode password required before public access."],
        steps: [],
      }
    },
    async startCloudflareTunnel() { return successJob },
    async stopCloudflareTunnel() { return successJob },
    async retryCloudflareTunnelStep() { return successJob },
    async getSecurityChecks() { return [] },
    async getBackupSummary() { return { count: 1, lastBackupTime: "2026-05-17T00:00:00.000Z", backupDirectory: "/tmp/backups", failureRecords: [], canManualBackup: true, canCleanup: true } },
    async runManualBackup() { return successJob },
    async cleanupOldBackups() { return successJob },
    async getDiagnostics() { return diagnostics },
  }
}
