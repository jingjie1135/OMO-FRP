import type { FrpClientConfig } from "../core/app-config/types"
import type { ManagementClient } from "../management-api/client"
import type { DesktopTunnelState } from "../management-api/types"
import { redactSensitiveText } from "../shared/redact-sensitive-text"
import type { DesktopRuntimeAdapter } from "./runtime-adapter"

export interface DesktopAutoTunnelOrchestratorOptions {
  runtime: DesktopRuntimeAdapter
  client: ManagementClient
  deviceId: string
  deviceName: string
  localHost?: string
  localPort?: number
  proxyName?: string
  preferredSubdomain?: string
  heartbeatIntervalMs?: number
  scheduleHeartbeat?: (callback: () => Promise<void>, intervalMs: number) => () => void
}

export interface DesktopAutoTunnelOrchestrator {
  connect(): Promise<DesktopTunnelState>
}

export function createDesktopAutoTunnelOrchestrator(options: DesktopAutoTunnelOrchestratorOptions): DesktopAutoTunnelOrchestrator {
  const localHost = options.localHost ?? "127.0.0.1"
  const localPort = options.localPort ?? 4096
  const heartbeatIntervalMs = options.heartbeatIntervalMs ?? 10_000
  const scheduleHeartbeat = options.scheduleHeartbeat ?? defaultScheduleHeartbeat

  return {
    async connect() {
      const baseState: DesktopTunnelState = {
        deviceId: options.deviceId,
        deviceName: options.deviceName,
        opencodeStatus: "starting",
        tunnelStatus: "provisioning",
        frpcStatus: "unknown",
        localPort,
      }

      const opencode = await options.runtime.startTool("opencode-desktop")
      if (opencode.status !== "succeeded") {
        return reportFailure(options.client, baseState, "error", "unknown", opencode.message)
      }

      const provision = await options.client.provisionDesktopTunnel({
        deviceId: options.deviceId,
        deviceName: options.deviceName,
        localHost,
        localPort,
        proxyName: options.proxyName,
        preferredSubdomain: options.preferredSubdomain,
      })

      const frpConfig: FrpClientConfig = {
        endpointId: options.deviceId,
        serverAddr: provision.serverAddr,
        serverPort: provision.serverPort,
        authTokenRef: "FRP_TOKEN",
        localHost,
        localPort,
        proxyName: provision.proxyName,
        subdomain: provision.subdomain,
        transport: "tcp",
      }
      await options.runtime.saveFrpConfig(frpConfig, provision.frpcConfig)

      const frpc = await options.runtime.startFrp()
      if (frpc.status !== "succeeded") {
        return reportFailure(options.client, { ...baseState, publicUrl: provision.publicUrl, opencodeStatus: "running" }, "running", "error", frpc.message)
      }

      const state: DesktopTunnelState = {
        ...baseState,
        opencodeStatus: "running",
        tunnelStatus: "connected",
        frpcStatus: "running",
        publicUrl: provision.publicUrl,
        lastHeartbeatAt: new Date().toISOString(),
      }
      await sendConnectedHeartbeat(options.client, state)
      scheduleHeartbeat(async () => sendConnectedHeartbeat(options.client, state), heartbeatIntervalMs)
      return state
    },
  }
}

function defaultScheduleHeartbeat(callback: () => Promise<void>, intervalMs: number): () => void {
  const timer = setInterval(() => {
    void callback().catch((error: unknown) => {
      console.error(redactSensitiveText(error instanceof Error ? error.message : String(error)))
    })
  }, intervalMs)
  ;(timer as { unref?: () => void }).unref?.()
  return () => clearInterval(timer)
}

async function sendConnectedHeartbeat(client: ManagementClient, state: DesktopTunnelState): Promise<void> {
  await client.sendDesktopTunnelHeartbeat({
    deviceId: state.deviceId,
    opencodeStatus: state.opencodeStatus,
    frpcStatus: state.frpcStatus,
    tunnelStatus: state.tunnelStatus,
    publicUrl: state.publicUrl,
    lastError: null,
  })
}

async function reportFailure(
  client: ManagementClient,
  state: DesktopTunnelState,
  opencodeStatus: DesktopTunnelState["opencodeStatus"],
  frpcStatus: DesktopTunnelState["frpcStatus"],
  message: string,
): Promise<DesktopTunnelState> {
  const failedState: DesktopTunnelState = {
    ...state,
    opencodeStatus,
    frpcStatus,
    tunnelStatus: "error",
    lastError: message,
    lastHeartbeatAt: new Date().toISOString(),
  }
  await client.sendDesktopTunnelHeartbeat({
    deviceId: failedState.deviceId,
    opencodeStatus: failedState.opencodeStatus,
    frpcStatus: failedState.frpcStatus,
    tunnelStatus: failedState.tunnelStatus,
    publicUrl: failedState.publicUrl,
    lastError: message,
  })
  return failedState
}
