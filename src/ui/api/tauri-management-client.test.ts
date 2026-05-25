import { describe, expect, it } from "bun:test"
import { createTauriManagementClient } from "./tauri-management-client"
import type { PublicEndpoint } from "../../management-api/types"

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
          expect(args).toEqual({ instance_id: "opencode-desktop" })
          return []
        }
        if (
          command === "start_tool" ||
          command === "stop_tool" ||
          command === "restart_tool" ||
          command === "enable_endpoint" ||
          command === "disable_endpoint" ||
          command === "start_frp" ||
          command === "stop_frp" ||
          command === "start_cloudflare_tunnel" ||
          command === "stop_cloudflare_tunnel" ||
          command === "retry_cloudflare_tunnel_step" ||
          command === "delete_desktop_tunnel_device"
        ) {
          if (command === "start_tool") {
            expect(args).toEqual({ instance_id: "opencode-desktop" })
          }
          if (command === "stop_tool") {
            expect(args).toEqual({ instance_id: "opencode-desktop" })
          }
          if (command === "restart_tool") {
            expect(args).toEqual({ instance_id: "opencode-desktop" })
          }
          if (command === "retry_cloudflare_tunnel_step") {
            expect(args).toEqual({ step_id: "configure_dns" })
          }
          return { status: "succeeded", message: command, jobId: `${command}-job` }
        }
        if (command === "create_cloudflare_tunnel_plan") {
          return { mode: "quick", localUrl: "http://127.0.0.1:4096", commandSummary: [], cloudflaredDetected: true, diagnostics: [], securityNotes: [], steps: [] }
        }
        if (command === "get_cloudflare_tunnel_status") {
          return { mode: "quick", running: false, message: "Cloudflare Tunnel stopped" }
        }
        if (command === "list_desktop_tunnel_devices") return []
        if (command === "provision_desktop_tunnel") return { deviceId: "desktop-alice", publicUrl: "https://alice.frp.example.com", serverAddr: "frp.example.com", serverPort: 7000, proxyName: "opencode-alice", frpcConfig: "" }
        if (command === "send_desktop_tunnel_heartbeat") return { id: "desktop-alice", name: "Alice Laptop", status: "online", opencodeStatus: "running", tunnelStatus: "connected", frpcStatus: "running", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice" }
        return { mode: "client", running: false, message: "frpc stopped" }
      },
    })

    expect(await client.detectTools()).toEqual([])
    expect(await client.listToolInstances()).toHaveLength(1)
    expect(await client.getToolLogs("opencode-desktop")).toEqual([])
    expect((await client.startTool("opencode-desktop")).status).toBe("succeeded")
    expect((await client.stopTool("opencode-desktop")).status).toBe("succeeded")
    expect((await client.restartTool("opencode-desktop")).status).toBe("succeeded")
    const endpoint: PublicEndpoint = {
      id: "desktop-route",
      name: "Desktop Route",
      domain: "desktop.example.com",
      protocol: "https",
      targetType: "desktop-frp",
      targetToolInstanceId: "opencode-desktop",
      authMode: "opencode-password",
      status: "disabled",
    }
    await client.saveEndpoint(endpoint)
    expect((await client.enableEndpoint(endpoint.id)).status).toBe("succeeded")
    expect((await client.disableEndpoint(endpoint.id)).status).toBe("succeeded")
    expect((await client.getFrpStatus()).mode).toBe("client")
    expect((await client.startFrp()).status).toBe("succeeded")
    expect((await client.stopFrp()).status).toBe("succeeded")
    await client.saveCloudflareTunnelConfig({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })
    expect((await client.createCloudflareTunnelPlan({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })).mode).toBe("quick")
    expect((await client.getCloudflareTunnelStatus()).mode).toBe("quick")
    expect((await client.startCloudflareTunnel({ mode: "quick", localHost: "127.0.0.1", localPort: 4096 })).status).toBe("succeeded")
    expect((await client.stopCloudflareTunnel()).status).toBe("succeeded")
    expect((await client.retryCloudflareTunnelStep("configure_dns")).status).toBe("succeeded")

    await client.listDesktopTunnelDevices()
    await client.provisionDesktopTunnel({ deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096 })
    await client.sendDesktopTunnelHeartbeat({ deviceId: "desktop-alice", opencodeStatus: "running", frpcStatus: "running", tunnelStatus: "connected" })
    await client.deleteDesktopTunnelDevice("desktop-alice")
    expect(client.startDesktopAutoTunnel).toBeFunction()
    expect((await client.startDesktopAutoTunnel()).tunnelStatus).toBe("connected")

    await client.getSecurityChecks()
    await client.getBackupSummary()
    await client.runManualBackup()
    await client.cleanupOldBackups()
    await client.getDiagnostics()

    expect(commands).toEqual([
      "detect_tools",
      "list_tool_instances",
      "get_tool_logs",
      "start_tool",
      "stop_tool",
      "restart_tool",
      "save_endpoint",
      "enable_endpoint",
      "disable_endpoint",
      "get_frp_status",
      "start_frp",
      "stop_frp",
      "save_cloudflare_tunnel_config",
      "create_cloudflare_tunnel_plan",
      "get_cloudflare_tunnel_status",
      "start_cloudflare_tunnel",
      "stop_cloudflare_tunnel",
      "retry_cloudflare_tunnel_step",
      "list_desktop_tunnel_devices",
      "provision_desktop_tunnel",
      "send_desktop_tunnel_heartbeat",
      "delete_desktop_tunnel_device",
      "start_tool",
      "provision_desktop_tunnel",
      "save_frp_config",
      "start_frp",
      "send_desktop_tunnel_heartbeat",
      "get_security_checks",
      "get_backup_summary",
      "run_manual_backup",
      "cleanup_old_backups",
      "get_diagnostics",
    ])
  })

  it("starts desktop auto tunnel through the TypeScript orchestrator path", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = []
    const serverFrpcConfig = 'serverAddr = "frp.example.com"\nserverPort = 7000\nauth.token = "server-issued-secret"\n'
    const client = createTauriManagementClient({
      invoke: async (command, args) => {
        calls.push({ command, args })
        if (command === "start_tool") return { jobId: "start-opencode", status: "succeeded", message: "OpenCode started" }
        if (command === "provision_desktop_tunnel") return { deviceId: "desktop-local", publicUrl: "https://desktop-local.frp.example.com", serverAddr: "frp.example.com", serverPort: 7000, proxyName: "opencode-desktop", subdomain: "desktop-local", frpcConfig: serverFrpcConfig }
        if (command === "save_frp_config") return undefined
        if (command === "start_frp") return { jobId: "start-frpc", status: "succeeded", message: "frpc started" }
        if (command === "send_desktop_tunnel_heartbeat") return { id: "desktop-local", name: "Desktop Local", status: "online", opencodeStatus: "running", tunnelStatus: "connected", frpcStatus: "running", publicUrl: "https://desktop-local.frp.example.com", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-desktop" }
        throw new Error(`Unexpected command: ${command}`)
      },
    })

    const state = await client.startDesktopAutoTunnel()

    expect(state).toMatchObject({ deviceId: "desktop-local", opencodeStatus: "running", tunnelStatus: "connected", frpcStatus: "running", publicUrl: "https://desktop-local.frp.example.com" })
    expect(calls.map((call) => call.command)).toEqual(["start_tool", "provision_desktop_tunnel", "save_frp_config", "start_frp", "send_desktop_tunnel_heartbeat"])
    expect(calls.find((call) => call.command === "save_frp_config")?.args).toMatchObject({ raw_config: serverFrpcConfig })
  })

  it("rejects Tauri command error payloads instead of treating them as successful responses", async () => {
    const client = createTauriManagementClient({
      invoke: async () => ({ error: "Desktop tunnel server request failed: token=secret" }),
    })

    await expect(client.startDesktopAutoTunnel()).rejects.toThrow("Desktop tunnel server request failed: token=secret")
  })

  it("rejects failed Tauri save_frp_config job results before starting frpc", async () => {
    const calls: string[] = []
    const client = createTauriManagementClient({
      invoke: async (command) => {
        calls.push(command)
        if (command === "start_tool") return { jobId: "start-opencode", status: "succeeded", message: "OpenCode started" }
        if (command === "provision_desktop_tunnel") return { deviceId: "desktop-local", publicUrl: "https://desktop-local.frp.example.com", serverAddr: "frp.example.com", serverPort: 7000, proxyName: "opencode-desktop", subdomain: "desktop-local", frpcConfig: "serverAddr = \"frp.example.com\"\n" }
        if (command === "save_frp_config") return { jobId: "save-frp-config", status: "failed", message: "Cannot write frpc config: access denied" }
        if (command === "send_desktop_tunnel_heartbeat") return { id: "desktop-local", name: "Desktop Local", status: "error", opencodeStatus: "running", tunnelStatus: "error", frpcStatus: "unknown", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-desktop" }
        throw new Error(`Unexpected command: ${command}`)
      },
    })

    await expect(client.startDesktopAutoTunnel()).rejects.toThrow("Cannot write frpc config: access denied")
    expect(calls).not.toContain("start_frp")
  })
})
