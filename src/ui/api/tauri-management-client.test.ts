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
          command === "retry_cloudflare_tunnel_step"
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
      "get_security_checks",
      "get_backup_summary",
      "run_manual_backup",
      "cleanup_old_backups",
      "get_diagnostics",
    ])
  })
})
