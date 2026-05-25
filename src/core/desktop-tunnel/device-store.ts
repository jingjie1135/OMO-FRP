import type { DesktopTunnelDevice, DesktopTunnelHeartbeatRequest } from "../../management-api/types"

export interface RecordDesktopTunnelProvisionInput {
  deviceId: string
  deviceName: string
  localHost: string
  localPort: number
  proxyName: string
  subdomain?: string
  publicUrl: string
}

export interface DesktopTunnelDeviceStoreOptions {
  now?: () => Date
  offlineAfterMs?: number
}

export interface DesktopTunnelDeviceStore {
  listDevices(): DesktopTunnelDevice[]
  recordProvision(input: RecordDesktopTunnelProvisionInput): DesktopTunnelDevice
  recordHeartbeat(input: DesktopTunnelHeartbeatRequest): DesktopTunnelDevice
  deleteDevice(deviceId: string): void
}

const DEFAULT_OFFLINE_AFTER_MS = 30_000

export function createDesktopTunnelDeviceStore(options: DesktopTunnelDeviceStoreOptions = {}): DesktopTunnelDeviceStore {
  const devices = new Map<string, DesktopTunnelDevice>()
  const now = options.now ?? (() => new Date())
  const offlineAfterMs = options.offlineAfterMs ?? DEFAULT_OFFLINE_AFTER_MS

  return {
    listDevices() {
      return Array.from(devices.values()).map((device) => deriveStatus(cloneDevice(device), now(), offlineAfterMs))
    },
    recordProvision(input) {
      const existing = devices.get(input.deviceId)
      const device: DesktopTunnelDevice = {
        id: input.deviceId,
        name: input.deviceName,
        status: existing?.status ?? "offline",
        opencodeStatus: existing?.opencodeStatus ?? "unknown",
        tunnelStatus: "provisioning",
        frpcStatus: existing?.frpcStatus ?? "unknown",
        publicUrl: input.publicUrl,
        localHost: input.localHost,
        localPort: input.localPort,
        proxyName: input.proxyName,
        subdomain: input.subdomain,
        lastSeenAt: existing?.lastSeenAt,
        lastError: existing?.lastError,
      }
      devices.set(input.deviceId, device)
      return deriveStatus(cloneDevice(device), now(), offlineAfterMs)
    },
    recordHeartbeat(input) {
      const existing = devices.get(input.deviceId)
      const hasError = input.opencodeStatus === "error" || input.frpcStatus === "error" || input.tunnelStatus === "error" || Boolean(input.lastError)
      const device: DesktopTunnelDevice = {
        id: input.deviceId,
        name: existing?.name ?? input.deviceId,
        status: hasError ? "error" : "online",
        opencodeStatus: input.opencodeStatus,
        tunnelStatus: input.tunnelStatus,
        frpcStatus: input.frpcStatus,
        publicUrl: input.publicUrl ?? existing?.publicUrl,
        localHost: existing?.localHost ?? "127.0.0.1",
        localPort: existing?.localPort ?? 4096,
        proxyName: existing?.proxyName ?? input.deviceId,
        subdomain: existing?.subdomain,
        lastSeenAt: now().toISOString(),
        lastError: input.lastError ?? undefined,
      }
      devices.set(input.deviceId, device)
      return deriveStatus(cloneDevice(device), now(), offlineAfterMs)
    },
    deleteDevice(deviceId) {
      devices.delete(deviceId)
    },
  }
}

function deriveStatus(device: DesktopTunnelDevice, now: Date, offlineAfterMs: number): DesktopTunnelDevice {
  if (device.status === "error") {
    return device
  }
  if (!device.lastSeenAt) {
    return { ...device, status: "offline" }
  }
  const lastSeen = new Date(device.lastSeenAt).getTime()
  if (!Number.isFinite(lastSeen) || now.getTime() - lastSeen > offlineAfterMs) {
    return { ...device, status: "offline" }
  }
  return { ...device, status: "online" }
}

function cloneDevice(device: DesktopTunnelDevice): DesktopTunnelDevice {
  return { ...device }
}
