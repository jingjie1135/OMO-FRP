import { describe, expect, it } from "bun:test"
import { createDesktopTunnelDeviceStore } from "./device-store"

const now = new Date("2026-05-25T00:00:00.000Z")

function createStore() {
  return createDesktopTunnelDeviceStore({ now: () => now, offlineAfterMs: 30_000 })
}

describe("desktop tunnel device store", () => {
  it("records provisioned devices as provisioning and then heartbeat updates them online", () => {
    const store = createStore()
    store.recordProvision({ deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", subdomain: "alice-code", publicUrl: "https://alice-code.example.com" })
    const device = store.recordHeartbeat({ deviceId: "desktop-alice", opencodeStatus: "running", frpcStatus: "running", tunnelStatus: "connected", publicUrl: "https://alice-code.example.com", lastError: null })
    expect(device).toMatchObject({ id: "desktop-alice", name: "Alice Laptop", status: "online", opencodeStatus: "running", frpcStatus: "running", tunnelStatus: "connected", publicUrl: "https://alice-code.example.com", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", subdomain: "alice-code", lastSeenAt: now.toISOString() })
  })

  it("derives offline when last heartbeat is older than threshold", () => {
    let current = new Date("2026-05-25T00:00:00.000Z")
    const store = createDesktopTunnelDeviceStore({ now: () => current, offlineAfterMs: 1_000 })
    store.recordProvision({ deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", publicUrl: "https://alice.example.com" })
    store.recordHeartbeat({ deviceId: "desktop-alice", opencodeStatus: "running", frpcStatus: "running", tunnelStatus: "connected", publicUrl: "https://alice.example.com", lastError: null })
    current = new Date("2026-05-25T00:00:02.000Z")
    expect(store.listDevices()[0]?.status).toBe("offline")
  })

  it("keeps errored devices in error status and supports deletion", () => {
    const store = createStore()
    store.recordProvision({ deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", publicUrl: "https://alice.example.com" })
    store.recordHeartbeat({ deviceId: "desktop-alice", opencodeStatus: "error", frpcStatus: "stopped", tunnelStatus: "error", publicUrl: "https://alice.example.com", lastError: "frpc executable was not found" })
    expect(store.listDevices()[0]).toMatchObject({ status: "error", lastError: "frpc executable was not found" })
    store.deleteDevice("desktop-alice")
    expect(store.listDevices()).toEqual([])
  })
})
