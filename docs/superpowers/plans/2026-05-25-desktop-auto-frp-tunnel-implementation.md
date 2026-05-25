# Desktop Auto FRP Tunnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Phase 1 desktop auto FRP tunnel flow: desktop starts or reuses local OpenCode, requests a server-provisioned FRP route, writes `frpc.toml`, starts `frpc`, heartbeats status, and lets the management UI show online desktop devices with public URLs.

**Architecture:** Reuse the existing CLI FRP provisioning code by extracting password-independent route provisioning options that server code can call without knowing the OpenCode password. Store server-side device state in a focused core desktop-tunnel store behind `LocalManagementRuntime`, expose it through `ServerApi`, and add a desktop orchestrator that composes existing `DesktopRuntimeAdapter` tool lifecycle methods with management API calls. The server allocates and observes only; the desktop remains the only side that starts local OpenCode or `frpc`.

**Tech Stack:** Bun, TypeScript, React 19 server-rendered UI, existing `ManagementClient`, local in-memory management runtime, Tauri stub command contracts, frp-panel HTTP API, existing Bun test suite.

---

## Current code map

### Existing files to modify
- `src/cli/remote-access/types.ts`: split reusable route provisioning options from CLI-only password/start options.
- `src/cli/remote-access/options.ts`: add `localHost` normalization while keeping CLI password validation in CLI normalization.
- `src/cli/remote-access/frp-panel-client.ts`: accept reusable provisioning options and use `localHost` in desired proxy config.
- `src/cli/remote-access/plan.ts`: keep CLI plan behavior by passing normalized options to provisioning.
- `src/management-api/types.ts`: define shared `DesktopTunnel*` request, response, device, status, and config types.
- `src/management-api/client.ts`: add desktop tunnel methods to `ManagementClient` and `SettingsManagementClient`.
- `src/management-api/local-management-runtime.ts`: own device store/provision/heartbeat/delete operations.
- `src/server/runtime-adapter.ts`: extend server runtime with desktop tunnel methods and injectable provisioning options.
- `src/server/api/index.ts`: add `/api/desktop-tunnels/*` routes and device-token auth.
- `src/desktop/runtime-adapter.ts`: add `saveFrpConfig(config)` so the orchestrator can persist generated `frpc.toml` before `startFrp()`.
- `src/ui/api/server-management-client.ts`: call desktop tunnel HTTP routes.
- `src/ui/api/tauri-management-client.ts`: map desktop tunnel commands to snake_case Tauri bridge names.
- `src/ui/app/page-loaders.ts`: load the new desktop tunnel page.
- `src/ui/app/App.tsx`: render the new page with the other management pages.
- `src/ui/routes/routes.tsx`: add the Chinese route label `远程设备`.
- `src-tauri/src/lib.rs`: add stub command contracts matching the TypeScript bridge.
- `docs/guide/management-ui.md` and `README.md`: document Phase 1 surface and verification limits.

### New files to create
- `src/core/desktop-tunnel/device-store.ts`: in-memory device state reducer, online/offline derivation, delete behavior.
- `src/core/desktop-tunnel/provisioning-service.ts`: server-side adapter from desktop request to `ensurePanelProvisioning()` and response shape.
- `src/desktop/auto-tunnel-orchestrator.ts`: desktop-side flow and status object.
- `src/ui/features/desktop-tunnels/DesktopTunnelsPage.tsx`: management UI table/cards for devices, status, URL, diagnostics, delete action.
- `src/ui/features/desktop-tunnels/DesktopTunnelsPageWrapper.tsx`: client-backed wrapper following existing feature wrapper pattern.
- `src/ui/features/desktop-tunnels/use-desktop-tunnels-state.ts`: status label helpers.
- `src/core/desktop-tunnel/device-store.test.ts`: device store TDD tests.
- `src/core/desktop-tunnel/provisioning-service.test.ts`: provisioning service TDD tests.
- `src/desktop/auto-tunnel-orchestrator.test.ts`: orchestrator TDD tests.
- `src/ui/features/desktop-tunnels/DesktopTunnelsPage.test.tsx`: UI TDD tests.
- `src/desktop/desktop-auto-tunnel-smoke.test.ts`: end-to-end smoke through runtime, orchestrator, and management UI rendering.

## Shared contracts to add

Add these exact types to `src/management-api/types.ts`:

```ts
export type DesktopTunnelProcessStatus = "unknown" | "starting" | "running" | "stopped" | "error"
export type DesktopTunnelConnectionStatus = "unknown" | "provisioning" | "connected" | "disconnected" | "error"
export type DesktopTunnelDeviceStatus = "online" | "offline" | "error"

export interface DesktopTunnelDevice {
  id: string
  name: string
  status: DesktopTunnelDeviceStatus
  opencodeStatus: DesktopTunnelProcessStatus
  tunnelStatus: DesktopTunnelConnectionStatus
  frpcStatus: DesktopTunnelProcessStatus
  publicUrl?: string
  localHost: string
  localPort: number
  proxyName: string
  subdomain?: string
  lastSeenAt?: string
  lastError?: string
}

export interface DesktopTunnelProvisionRequest {
  deviceId: string
  deviceName: string
  localHost: string
  localPort: number
  proxyName?: string
  preferredSubdomain?: string
}

export interface DesktopTunnelProvisionResponse {
  deviceId: string
  publicUrl: string
  serverAddr: string
  serverPort: number
  proxyName: string
  subdomain?: string
  frpcConfig: string
}

export interface DesktopTunnelHeartbeatRequest {
  deviceId: string
  opencodeStatus: DesktopTunnelProcessStatus
  frpcStatus: DesktopTunnelProcessStatus
  tunnelStatus: DesktopTunnelConnectionStatus
  publicUrl?: string
  lastError?: string | null
}

export interface DesktopTunnelState {
  deviceId: string
  deviceName: string
  opencodeStatus: DesktopTunnelProcessStatus
  tunnelStatus: DesktopTunnelConnectionStatus
  frpcStatus: DesktopTunnelProcessStatus
  publicUrl?: string
  localPort: number
  lastHeartbeatAt?: string
  lastError?: string
}
```

Add these exact methods to `ManagementClient` in `src/management-api/client.ts`:

```ts
listDesktopTunnelDevices(): Promise<DesktopTunnelDevice[]>
provisionDesktopTunnel(request: DesktopTunnelProvisionRequest): Promise<DesktopTunnelProvisionResponse>
sendDesktopTunnelHeartbeat(request: DesktopTunnelHeartbeatRequest): Promise<DesktopTunnelDevice>
deleteDesktopTunnelDevice(deviceId: string): Promise<void>
```

Server routes:
- `GET /api/desktop-tunnels/devices`: management UI session auth; returns `DesktopTunnelDevice[]`.
- `POST /api/desktop-tunnels/provision`: device token auth; returns `DesktopTunnelProvisionResponse`.
- `POST /api/desktop-tunnels/heartbeat`: device token auth; returns updated `DesktopTunnelDevice`.
- `DELETE /api/desktop-tunnels/:id`: management UI session auth plus `x-management-ui-request: 1`; returns `{ ok: true }`.

Device auth rule: if `ServerApiOptions.deviceToken` is set, provision/heartbeat must include `authorization: Bearer <deviceToken>`. Existing `sessionToken` remains for UI/admin routes.

## Task 1: Make FRP provisioning reusable outside CLI

**Files:**
- Modify: `src/cli/remote-access/types.ts`
- Modify: `src/cli/remote-access/options.ts`
- Modify: `src/cli/remote-access/frp-panel-client.ts`
- Modify: `src/cli/remote-access/plan.ts`
- Test: `src/cli/remote-access/frp-panel-client.test.ts`

- [ ] **Step 1: Write the failing localHost provisioning test**

Add this test to `src/cli/remote-access/frp-panel-client.test.ts` after the first provisioning test:

```ts
it("uses the requested local host in frp-panel proxy config", async () => {
  const createdConfigs: Record<string, unknown>[] = []
  mockFetch.mockImplementation(async (input, init) => {
    const url = String(input)
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {}

    if (url.endsWith("/api/v1/user/get")) return ok({ userInfo: { userName: "alice" } })
    if (url.endsWith("/rpc")) return new Response("ok", { status: 200 })
    if (url.endsWith("/api/v1/server/list")) return ok({ servers: [{ id: "server-a" }] })
    if (url.endsWith("/api/v1/client/get")) return ok({ client: { id: "desktop-a", secret: "client-secret", frpsUrl: "tcp://frp.example.com:7000" } })
    if (url.endsWith("/api/v1/proxy/get_config")) return ok({ workingStatus: { name: "opencode-test", type: "http", status: "running" } })
    if (url.endsWith("/api/v1/proxy/create_config")) {
      const decoded = JSON.parse(Buffer.from(body.config as string, "base64").toString("utf8")) as { proxies: Record<string, unknown>[] }
      createdConfigs.push(decoded.proxies[0]!)
      return ok({})
    }
    if (url.endsWith("/api/v1/platform/clientsstatus")) return ok({ clients: { "desktop-a": { status: 1 } } })
    if (url.endsWith("/api/v1/proxy/start_proxy")) return ok({})
    throw new Error(`Unexpected request: ${url}`)
  })

  await ensurePanelProvisioning({
    panelUrl: "https://frp.example.com",
    panelApiUrl: "https://frp.example.com",
    panelRpcUrl: "wss://frp.example.com/rpc",
    authToken: "restricted-token",
    clientId: "desktop-a",
    proxyName: "opencode-test",
    frpBinary: "frp-panel",
    serverAddr: "frp.example.com",
    serverPort: 7000,
    transport: "tcp",
    proxyType: "http",
    localHost: "127.0.0.2",
    localPort: 4096,
    subdomain: "alice-code",
    https: true,
  })

  expect(createdConfigs[0]).toMatchObject({ localIP: "127.0.0.2" })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/cli/remote-access/frp-panel-client.test.ts --test-name-pattern "uses the requested local host"`

Expected: FAIL because `ensurePanelProvisioning()` currently requires CLI-only fields and `buildDesiredProxyConfig()` hard-codes `localIP: "127.0.0.1"`.

- [ ] **Step 3: Add reusable provisioning types**

In `src/cli/remote-access/types.ts`, add `localHost?: string` to `RemoteAccessOptions`, add required `localHost: string` to `NormalizedRemoteAccessOptions`, and introduce:

```ts
export interface FrpRouteProvisioningOptions {
  panelUrl: string
  panelApiUrl: string
  panelRpcUrl: string
  authToken: string
  serverId?: string
  clientId: string
  proxyName: string
  frpBinary: string
  serverAddr: string
  serverPort: number
  transport: FrpTransport
  proxyType: FrpProxyType
  localHost: string
  localPort: number
  remotePort?: number
  subdomain?: string
  customDomain?: string
  https: boolean
}
```

- [ ] **Step 4: Normalize localHost for CLI callers**

In `normalizeRemoteAccessOptions()`, include `localHost: options.localHost ?? "127.0.0.1"` between `proxyType` and `localPort` in the returned object.

- [ ] **Step 5: Change provisioning to the reusable type**

In `src/cli/remote-access/frp-panel-client.ts`, import `FrpRouteProvisioningOptions` instead of `NormalizedRemoteAccessOptions`. Replace every local `NormalizedRemoteAccessOptions` annotation in this file with `FrpRouteProvisioningOptions`, including `buildDesiredProxyConfig()`, `buildJoinCommand()`, `resolveServerId()`, and `ensurePanelProvisioning()`. Change desired config to `localIP: options.localHost`.

- [ ] **Step 6: Keep CLI plan behavior unchanged**

In `src/cli/remote-access/plan.ts`, no adapter is needed because `NormalizedRemoteAccessOptions` structurally includes `FrpRouteProvisioningOptions`. Confirm `createRemoteAccessPlan()` still passes `options` directly to `ensurePanelProvisioning(options)`.

- [ ] **Step 7: Run targeted tests**

Run: `bun test src/cli/remote-access/frp-panel-client.test.ts src/cli/remote-access/remote-access.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
$env:GIT_MASTER='1'; git add src/cli/remote-access/types.ts src/cli/remote-access/options.ts src/cli/remote-access/frp-panel-client.ts src/cli/remote-access/plan.ts src/cli/remote-access/frp-panel-client.test.ts
$env:GIT_MASTER='1'; git commit -m "refactor: 抽出桌面隧道 FRP 申请参数"
```

## Task 2: Add shared desktop tunnel contracts and server-side device store

**Files:**
- Modify: `src/management-api/types.ts`
- Modify: `src/management-api/client.ts`
- Create: `src/core/desktop-tunnel/device-store.ts`
- Test: `src/core/desktop-tunnel/device-store.test.ts`

- [ ] **Step 1: Write failing device-store tests**

Create `src/core/desktop-tunnel/device-store.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/desktop-tunnel/device-store.test.ts`

Expected: FAIL because `src/core/desktop-tunnel/device-store.ts` does not exist.

- [ ] **Step 3: Add shared types and client methods**

Add the shared `DesktopTunnel*` types from the contract section to `src/management-api/types.ts`. In `src/management-api/client.ts`, import the new types and add the four desktop tunnel methods.

- [ ] **Step 4: Implement the device store**

Create `src/core/desktop-tunnel/device-store.ts` with `createDesktopTunnelDeviceStore(options)` exposing `listDevices()`, `recordProvision(input)`, `recordHeartbeat(input)`, and `deleteDevice(deviceId)`. The store must clone returned devices, derive `offline` when `now() - lastSeenAt > offlineAfterMs`, preserve `error` status when heartbeat includes any error state or non-empty `lastError`, and default missing heartbeat-only devices to `localHost: "127.0.0.1"`, `localPort: 4096`, `proxyName: deviceId`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/core/desktop-tunnel/device-store.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
$env:GIT_MASTER='1'; git add src/management-api/types.ts src/management-api/client.ts src/core/desktop-tunnel/device-store.ts src/core/desktop-tunnel/device-store.test.ts
$env:GIT_MASTER='1'; git commit -m "feat: 增加桌面隧道设备状态存储"
```

## Task 3: Add server provisioning service and management runtime methods

**Files:**
- Create: `src/core/desktop-tunnel/provisioning-service.ts`
- Modify: `src/management-api/local-management-runtime.ts`
- Modify: `src/server/runtime-adapter.ts`
- Test: `src/core/desktop-tunnel/provisioning-service.test.ts`
- Test: `src/management-api/local-management-runtime.test.ts`

- [ ] **Step 1: Write failing provisioning service tests**

Create `src/core/desktop-tunnel/provisioning-service.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { createDesktopTunnelProvisioningService } from "./provisioning-service"

const request = { deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", preferredSubdomain: "alice-code" }

describe("desktop tunnel provisioning service", () => {
  it("maps desktop requests to frp-panel provisioning and returns frpc config", async () => {
    const service = createDesktopTunnelProvisioningService({
      panelUrl: "https://frp.example.com",
      panelApiUrl: "https://frp.example.com",
      panelRpcUrl: "wss://frp.example.com/rpc",
      authToken: "restricted-token",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      https: true,
      provisionRoute: async (options) => {
        expect(options).toMatchObject({ clientId: "desktop-alice", proxyName: "opencode-alice", localHost: "127.0.0.1", localPort: 4096, subdomain: "alice-code", proxyType: "http" })
        return { status: "ready", publicUrl: "https://alice-code.frp.example.com", serverAddr: "frp-edge.example.com", serverPort: 7443 }
      },
    })
    const response = await service.provision(request)
    expect(response).toMatchObject({ deviceId: "desktop-alice", publicUrl: "https://alice-code.frp.example.com", serverAddr: "frp-edge.example.com", serverPort: 7443, proxyName: "opencode-alice", subdomain: "alice-code" })
    expect(response.frpcConfig).toContain('serverAddr = "frp-edge.example.com"')
    expect(response.frpcConfig).toContain('localIP = "127.0.0.1"')
  })

  it("throws an actionable error when provisioning is not ready", async () => {
    const service = createDesktopTunnelProvisioningService({
      panelUrl: "https://frp.example.com",
      panelApiUrl: "https://frp.example.com",
      panelRpcUrl: "wss://frp.example.com/rpc",
      authToken: "restricted-token",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      https: true,
      provisionRoute: async () => ({ status: "error", publicUrl: "https://alice-code.frp.example.com", failureReason: "auth_failed", suggestion: "Use a restricted frp-panel token." }),
    })
    await expect(service.provision(request)).rejects.toThrow("Use a restricted frp-panel token.")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/core/desktop-tunnel/provisioning-service.test.ts`

Expected: FAIL because `provisioning-service.ts` does not exist.

- [ ] **Step 3: Implement provisioning service**

Create `src/core/desktop-tunnel/provisioning-service.ts`. It must export `DesktopTunnelProvisioningServiceOptions`, `DesktopTunnelProvisioningService`, and `createDesktopTunnelProvisioningService(options)`. The service must build `FrpRouteProvisioningOptions` with `clientId: request.deviceId`, `proxyName: request.proxyName ?? request.deviceId`, `proxyType: "http"`, `transport: "tcp"`, `localHost`, `localPort`, `subdomain: request.preferredSubdomain`, and server/panel fields from options. It must call `options.provisionRoute ?? ensurePanelProvisioning`, throw `new Error(result.suggestion ?? result.failureReason ?? "Desktop tunnel provisioning failed")` unless result status is `ready`, and return `DesktopTunnelProvisionResponse` with `frpcConfig` generated by `generateFrpcConfig()` using any derived `result.serverAddr` and `result.serverPort`.

- [ ] **Step 4: Write failing runtime tests**

Append to `src/management-api/local-management-runtime.test.ts`:

```ts
describe("local management runtime desktop tunnels", () => {
  it("provisions, lists, heartbeats, and deletes desktop tunnel devices", async () => {
    const runtime = createLocalManagementRuntime({
      capabilities: SERVER_CAPABILITIES,
      defaultConfigDirectory: "/tmp/config",
      frpStatusMode: "server",
      config: createConfig(),
      desktopTunnelProvisioning: {
        panelUrl: "https://frp.example.com",
        panelApiUrl: "https://frp.example.com",
        panelRpcUrl: "wss://frp.example.com/rpc",
        authToken: "restricted-token",
        serverAddr: "frp.example.com",
        serverPort: 7000,
        provisionRoute: async () => ({ status: "ready", publicUrl: "https://alice.frp.example.com" }),
      },
    })
    const provision = await runtime.provisionDesktopTunnel({ deviceId: "desktop-alice", deviceName: "Alice Laptop", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", preferredSubdomain: "alice" })
    const heartbeat = await runtime.sendDesktopTunnelHeartbeat({ deviceId: "desktop-alice", opencodeStatus: "running", frpcStatus: "running", tunnelStatus: "connected", publicUrl: provision.publicUrl, lastError: null })
    expect(provision.publicUrl).toBe("https://alice.frp.example.com")
    expect(heartbeat.status).toBe("online")
    expect(await runtime.listDesktopTunnelDevices()).toHaveLength(1)
    await runtime.deleteDesktopTunnelDevice("desktop-alice")
    expect(await runtime.listDesktopTunnelDevices()).toEqual([])
  })
})
```

- [ ] **Step 5: Run runtime test to verify it fails**

Run: `bun test src/management-api/local-management-runtime.test.ts --test-name-pattern "desktop tunnels"`

Expected: FAIL because `CreateLocalManagementRuntimeOptions` and returned client do not include desktop tunnel methods.

- [ ] **Step 6: Wire runtime and server adapter methods**

In `src/management-api/local-management-runtime.ts`, import `createDesktopTunnelDeviceStore`, `createDesktopTunnelProvisioningService`, and `DesktopTunnelProvisioningServiceOptions`. Extend options with `desktopTunnelProvisioning?: DesktopTunnelProvisioningServiceOptions`. Initialize `desktopTunnelStore` with `now`. Initialize optional `desktopTunnelProvisioning`. Add `listDesktopTunnelDevices()`, `provisionDesktopTunnel(request)`, `sendDesktopTunnelHeartbeat(request)`, and `deleteDesktopTunnelDevice(deviceId)` to the returned object. `provisionDesktopTunnel()` must throw `Desktop tunnel provisioning is not configured on this server.` if no service is configured, call the service, record the provisioned device, and return the response.

In `src/server/runtime-adapter.ts`, import desktop tunnel types and `DesktopTunnelProvisioningServiceOptions`, extend `ServerRuntimeAdapter` with the four methods, and change factory signature to accept either `AppConfig` or `{ config?: AppConfig; desktopTunnelProvisioning?: DesktopTunnelProvisioningServiceOptions }` while preserving existing `createServerRuntimeAdapter(config)` callers.

- [ ] **Step 7: Run targeted tests**

Run: `bun test src/core/desktop-tunnel/provisioning-service.test.ts src/management-api/local-management-runtime.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
$env:GIT_MASTER='1'; git add src/core/desktop-tunnel/provisioning-service.ts src/core/desktop-tunnel/provisioning-service.test.ts src/management-api/local-management-runtime.ts src/management-api/local-management-runtime.test.ts src/server/runtime-adapter.ts
$env:GIT_MASTER='1'; git commit -m "feat: 增加桌面隧道申请服务"
```

## Task 4: Expose desktop tunnel HTTP API and clients

**Files:**
- Modify: `src/server/api/index.ts`
- Modify: `src/server/api/server-api.test.ts`
- Modify: `src/ui/api/server-management-client.ts`
- Modify: `src/ui/api/tauri-management-client.ts`
- Modify: `src/ui/api/tauri-bridge-contract.test.ts`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Write failing server API tests**

Append tests to `src/server/api/server-api.test.ts` that create `createServerApi({ sessionToken: "session-secret", deviceToken: "device-secret", adapter: createServerRuntimeAdapter({ desktopTunnelProvisioning: ... }) })`, call `POST /api/desktop-tunnels/provision` with device auth, call `POST /api/desktop-tunnels/heartbeat` with device auth, call `GET /api/desktop-tunnels/devices` with session auth, call `DELETE /api/desktop-tunnels/desktop-alice` with session auth and `x-management-ui-request: 1`, and assert provision URL/config, heartbeat online, list length 1, and delete status 200. Add a second test that calls heartbeat with session auth but not device auth and expects 401. Add helper `devicePostJson(body)` using `authorization: Bearer device-secret`.

- [ ] **Step 2: Run server API tests to verify failure**

Run: `bun test src/server/api/server-api.test.ts --test-name-pattern "desktop tunnel"`

Expected: FAIL because routes and `deviceToken` option do not exist.

- [ ] **Step 3: Implement server routes**

In `src/server/api/index.ts`, import desktop tunnel request types and add `deviceToken?: string` to `ServerApiOptions`. Handle `POST /api/desktop-tunnels/provision` and `POST /api/desktop-tunnels/heartbeat` before the management UI mutating-header check; both must require `isAuthorized(init.headers, options.deviceToken)`. Add `GET /api/desktop-tunnels/devices` and `DELETE /api/desktop-tunnels/:id` after normal management auth/header checks.

- [ ] **Step 4: Add server-management client methods**

In `src/ui/api/server-management-client.ts`, import desktop tunnel request types. Add `listDesktopTunnelDevices()`, `provisionDesktopTunnel(request)`, `sendDesktopTunnelHeartbeat(request)`, and `deleteDesktopTunnelDevice(deviceId)`. Add a `deleteVoid()` helper that sends `method: "DELETE"` with `createHeaders(options)` and throws on non-ok responses.

- [ ] **Step 5: Add Tauri client and Rust stub contracts**

In `src/ui/api/tauri-management-client.ts`, import desktop tunnel request types and add methods mapped to `list_desktop_tunnel_devices`, `provision_desktop_tunnel`, `send_desktop_tunnel_heartbeat`, and `delete_desktop_tunnel_device`. In `src-tauri/src/lib.rs`, add stub commands returning empty list / failed provisioning message / heartbeat echo / void, and register them in `generate_handler!`.

- [ ] **Step 6: Run targeted tests**

Run: `bun test src/server/api/server-api.test.ts src/ui/api/server-management-client.test.ts src/ui/api/tauri-management-client.test.ts src/ui/api/tauri-bridge-contract.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
$env:GIT_MASTER='1'; git add src/server/api/index.ts src/server/api/server-api.test.ts src/ui/api/server-management-client.ts src/ui/api/tauri-management-client.ts src/ui/api/tauri-bridge-contract.test.ts src-tauri/src/lib.rs
$env:GIT_MASTER='1'; git commit -m "feat: 暴露桌面隧道管理接口"
```

## Task 5: Add desktop runtime saveFrpConfig and auto tunnel orchestrator

**Files:**
- Modify: `src/desktop/runtime-adapter.ts`
- Modify: `src/desktop/runtime-adapter.test.ts`
- Create: `src/desktop/auto-tunnel-orchestrator.ts`
- Test: `src/desktop/auto-tunnel-orchestrator.test.ts`

- [ ] **Step 1: Write failing saveFrpConfig test**

Append to `src/desktop/runtime-adapter.test.ts`:

```ts
it("writes frpc.toml through saveFrpConfig before starting frpc", async () => {
  const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-frpc-config-"))
  const frpDir = join(runtimeDir, "frp")
  const adapter = createDesktopRuntimeAdapter({ runtimeDir, toolSpecs: [] })
  await adapter.saveFrpConfig({ endpointId: "desktop-frpc", serverAddr: "frp.example.com", serverPort: 7000, authTokenRef: "FRP_TOKEN", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", subdomain: "alice-code", transport: "tcp" })
  const content = await Bun.file(join(frpDir, "frpc.toml")).text()
  expect(content).toContain('serverAddr = "frp.example.com"')
  expect(content).toContain('localIP = "127.0.0.1"')
  expect(content).toContain('subdomain = "alice-code"')
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test src/desktop/runtime-adapter.test.ts --test-name-pattern "writes frpc.toml"`

Expected: FAIL because `DesktopRuntimeAdapter` has no `saveFrpConfig()`.

- [ ] **Step 3: Implement saveFrpConfig**

In `src/desktop/runtime-adapter.ts`, import `writeFile` from `node:fs/promises` and `buildFrpClientToml` from `../core/frp/frp-config`. Add `saveFrpConfig(config: FrpClientConfig): Promise<void>` to `DesktopRuntimeAdapter`. Implement it by resolving the `frpc-desktop` config directory, creating it, writing `frpc.toml`, and updating `frpc-desktop` state `configDirectory`, `configFile`, and `currentPort`.

- [ ] **Step 4: Run saveFrpConfig test to verify pass**

Run: `bun test src/desktop/runtime-adapter.test.ts --test-name-pattern "writes frpc.toml"`

Expected: PASS.

- [ ] **Step 5: Write failing orchestrator tests**

Create `src/desktop/auto-tunnel-orchestrator.test.ts` with two tests: one asserts `connect()` calls `startTool:opencode-desktop`, `provisionDesktopTunnel`, `saveFrpConfig`, `startFrp`, and `sendDesktopTunnelHeartbeat` in order and returns connected state with `https://alice.frp.example.com`; the other makes `startFrp()` return failed with `frpc executable was not found` and asserts returned state has `tunnelStatus: "error"`, `frpcStatus: "error"`, `lastError`, and still calls heartbeat. Use typed fake `DesktopRuntimeAdapter` and `ManagementClient`; no network mocks are needed.

- [ ] **Step 6: Run orchestrator tests to verify failure**

Run: `bun test src/desktop/auto-tunnel-orchestrator.test.ts`

Expected: FAIL because `auto-tunnel-orchestrator.ts` does not exist.

- [ ] **Step 7: Implement orchestrator**

Create `src/desktop/auto-tunnel-orchestrator.ts`. Export `DesktopAutoTunnelOrchestratorOptions`, `DesktopAutoTunnelOrchestrator`, and `createDesktopAutoTunnelOrchestrator(options)`. `connect()` must start `opencode-desktop`, provision with device info, build a `FrpClientConfig` using provision response and `authTokenRef: "FRP_TOKEN"`, call `runtime.saveFrpConfig()`, call `runtime.startFrp()`, then call `client.sendDesktopTunnelHeartbeat()` with connected or error status. It returns `DesktopTunnelState` and never logs secrets.

- [ ] **Step 8: Run desktop tests**

Run: `bun test src/desktop/runtime-adapter.test.ts src/desktop/auto-tunnel-orchestrator.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
$env:GIT_MASTER='1'; git add src/desktop/runtime-adapter.ts src/desktop/runtime-adapter.test.ts src/desktop/auto-tunnel-orchestrator.ts src/desktop/auto-tunnel-orchestrator.test.ts
$env:GIT_MASTER='1'; git commit -m "feat: 增加桌面自动隧道编排器"
```

## Task 6: Add management UI page for remote desktop devices

**Files:**
- Create: `src/ui/features/desktop-tunnels/DesktopTunnelsPage.tsx`
- Create: `src/ui/features/desktop-tunnels/DesktopTunnelsPageWrapper.tsx`
- Create: `src/ui/features/desktop-tunnels/use-desktop-tunnels-state.ts`
- Test: `src/ui/features/desktop-tunnels/DesktopTunnelsPage.test.tsx`
- Modify: `src/ui/app/page-loaders.ts`
- Modify: `src/ui/app/App.tsx`
- Modify: `src/ui/app/management-ui-acceptance.test.tsx`
- Modify: `src/ui/routes/routes.tsx`

- [ ] **Step 1: Write failing UI component tests**

Create `src/ui/features/desktop-tunnels/DesktopTunnelsPage.test.tsx`:

```tsx
import { describe, expect, it } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { DesktopTunnelsPage } from "./DesktopTunnelsPage"

const devices = [
  { id: "desktop-alice", name: "Alice Laptop", status: "online" as const, opencodeStatus: "running" as const, tunnelStatus: "connected" as const, frpcStatus: "running" as const, publicUrl: "https://alice.frp.example.com", localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-alice", subdomain: "alice", lastSeenAt: "2026-05-25T00:00:00.000Z" },
  { id: "desktop-bob", name: "Bob Desktop", status: "error" as const, opencodeStatus: "running" as const, tunnelStatus: "error" as const, frpcStatus: "error" as const, localHost: "127.0.0.1", localPort: 4096, proxyName: "opencode-bob", lastError: "frpc executable was not found token=secret" },
]

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

  it("shows an empty state before any desktop has connected", () => {
    const html = renderToStaticMarkup(<DesktopTunnelsPage devices={[]} />)
    expect(html).toContain("还没有桌面端连接")
    expect(html).toContain("打开 Tauri 桌面端后会自动申请 FRP 隧道")
  })
})
```

- [ ] **Step 2: Run UI component tests to verify failure**

Run: `bun test src/ui/features/desktop-tunnels/DesktopTunnelsPage.test.tsx`

Expected: FAIL because the feature directory and component do not exist.

- [ ] **Step 3: Implement UI helpers and page**

Create `use-desktop-tunnels-state.ts` with `getDeviceStatusLabel()`, `getProcessStatusLabel()`, and `getTunnelStatusLabel()` returning Chinese labels for every status. Create `DesktopTunnelsPage.tsx` rendering title `远程设备`, empty state, table columns `设备名`, `状态`, `OpenCode`, `FRP`, `公网地址`, `诊断`, `操作`, public URL links, `打开 OpenCode`, `复制 URL`, `删除设备`, and redacted `lastError` through `redactSensitiveText()`. Create `DesktopTunnelsPageWrapper.tsx` that accepts `client` and `initialDevices` and wires delete action to `client.deleteDesktopTunnelDevice(deviceId)`.

- [ ] **Step 4: Run UI component tests to verify pass**

Run: `bun test src/ui/features/desktop-tunnels/DesktopTunnelsPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Write failing app acceptance test**

Update `src/ui/app/management-ui-acceptance.test.tsx` so the navigation test asserts `serverHtml` contains `远程设备` and `Alice Laptop`. Add desktop tunnel methods to `createAcceptanceClient()`: `listDesktopTunnelDevices()` returns one online Alice device and pushes `listDesktopTunnelDevices`; `provisionDesktopTunnel()` and `sendDesktopTunnelHeartbeat()` throw `not used`; `deleteDesktopTunnelDevice()` resolves.

- [ ] **Step 6: Run acceptance test to verify failure**

Run: `bun test src/ui/app/management-ui-acceptance.test.tsx --test-name-pattern "navigation"`

Expected: FAIL because the app does not load/render desktop tunnel devices and the route does not exist.

- [ ] **Step 7: Wire route and page loader**

In `src/ui/routes/routes.tsx`, insert `{ path: "/desktop-tunnels", label: "远程设备" }` after FRP. In `src/ui/app/page-loaders.ts`, import `DesktopTunnelsPageWrapper` and add `loadDesktopTunnelsPage(client)` that awaits `client.listDesktopTunnelDevices()` and returns the wrapper. In `src/ui/app/App.tsx`, import `loadDesktopTunnelsPage`, include it in `Promise.all`, and render it with the other pages.

- [ ] **Step 8: Run UI tests**

Run: `bun test src/ui/features/desktop-tunnels/DesktopTunnelsPage.test.tsx src/ui/app/management-ui-acceptance.test.tsx`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
$env:GIT_MASTER='1'; git add src/ui/features/desktop-tunnels src/ui/app/page-loaders.ts src/ui/app/App.tsx src/ui/app/management-ui-acceptance.test.tsx src/ui/routes/routes.tsx
$env:GIT_MASTER='1'; git commit -m "feat: 增加远程桌面设备页面"
```

## Task 7: End-to-end smoke test and docs

**Files:**
- Create: `src/desktop/desktop-auto-tunnel-smoke.test.ts`
- Modify: `docs/guide/management-ui.md`
- Modify: `README.md`

- [ ] **Step 1: Write failing smoke test**

Create `src/desktop/desktop-auto-tunnel-smoke.test.ts`:

```ts
import { describe, expect, it } from "bun:test"
import { createDesktopAutoTunnelOrchestrator } from "./auto-tunnel-orchestrator"
import { createLocalManagementRuntime } from "../management-api/local-management-runtime"
import { SERVER_CAPABILITIES } from "../core/app-config/types"
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
        provisionRoute: async () => ({ status: "ready", publicUrl: "https://alice.frp.example.com" }),
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
    expect(html).toContain("Alice Laptop")
    expect(html).toContain("https://alice.frp.example.com")
    expect(html).toContain("在线")
  })
})
```

- [ ] **Step 2: Run smoke test to verify failure or pass after prior tasks**

Run: `bun test src/desktop/desktop-auto-tunnel-smoke.test.ts`

Expected before prior implementation: FAIL. Expected after Tasks 1-6: PASS.

- [ ] **Step 3: Update docs**

In `docs/guide/management-ui.md`, add:

```md
## 桌面端自动 FRP 隧道

Phase 1 支持桌面端主动申请 FRP 隧道：桌面端启动或复用本机 OpenCode（仅监听 `127.0.0.1`），向服务器申请 `frp-panel` client/proxy，写入 `frpc.toml`，启动 `frpc`，并通过 heartbeat 上报 OpenCode、frpc、隧道和公网 URL 状态。

服务器管理界面新增 `远程设备` 页面，展示设备在线/离线/错误状态、公网 URL、诊断和删除设备记录操作。服务器不会远程执行桌面命令；第一期只接收桌面端主动请求。

安全边界：OpenCode 必须配置 `OPENCODE_SERVER_PASSWORD`，device token 用于桌面端 provision/heartbeat，FRP token/client secret/OpenCode password 不在 UI 明文展示，普通诊断输出会脱敏。
```

In `README.md`, add:

```md
### Desktop auto FRP tunnel

The desktop Phase 1 flow is client-initiated. Configure the server FRP panel settings and a desktop device token, then start the Tauri desktop app. The desktop app starts or reuses local OpenCode on `127.0.0.1:4096`, requests a server-provisioned FRP route, writes `frpc.toml`, starts `frpc`, and reports heartbeat status. The server UI shows the device under `远程设备` with the assigned public URL.
```

- [ ] **Step 4: Run smoke and docs-related tests**

Run: `bun test src/desktop/desktop-auto-tunnel-smoke.test.ts src/ui/app/management-ui-acceptance.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
$env:GIT_MASTER='1'; git add src/desktop/desktop-auto-tunnel-smoke.test.ts docs/guide/management-ui.md README.md
$env:GIT_MASTER='1'; git commit -m "test: 增加桌面自动隧道端到端验收"
```

## Task 8: Full verification and manual QA gate

**Files:**
- All changed files from Tasks 1-7.

- [ ] **Step 1: Run LSP diagnostics on changed TypeScript files**

Run `lsp_diagnostics` in parallel for changed files where the LSP server works. If TypeScript LSP exits with `code -4058`, record it and use `tsc --noEmit` as the authoritative type check for this environment.

Expected: no file-level diagnostics, or documented LSP startup failure only.

- [ ] **Step 2: Run full tests**

Run: `bun run test`

Expected: PASS with all tests green.

- [ ] **Step 3: Run typecheck**

Run: `bun node_modules/typescript/lib/tsc.js --noEmit`

Expected: exit 0 with no output.

- [ ] **Step 4: Run builds**

Run: `bun run build:ui`, `bun run build:server`, and `bun run build`.

Expected: all exit 0.

- [ ] **Step 5: Manual QA through library/UI surface**

Because a real FRP panel and real public DNS/TLS are not available in this workspace, use the local smoke surface as the manual QA gate:

```bash
bun test src/desktop/desktop-auto-tunnel-smoke.test.ts
bun -e "import { createLocalManagementRuntime } from './src/management-api/local-management-runtime.ts'; import { SERVER_CAPABILITIES } from './src/core/app-config/types.ts'; import { renderManagementApp } from './src/ui/app/App.tsx'; const server = createLocalManagementRuntime({ capabilities: SERVER_CAPABILITIES, defaultConfigDirectory: '/tmp/config', frpStatusMode: 'server', desktopTunnelProvisioning: { panelUrl: 'https://frp.example.com', panelApiUrl: 'https://frp.example.com', panelRpcUrl: 'wss://frp.example.com/rpc', authToken: 'restricted-token', serverAddr: 'frp.example.com', serverPort: 7000, provisionRoute: async () => ({ status: 'ready', publicUrl: 'https://alice.frp.example.com' }) } }); await server.provisionDesktopTunnel({ deviceId: 'desktop-alice', deviceName: 'Alice Laptop', localHost: '127.0.0.1', localPort: 4096, proxyName: 'opencode-alice', preferredSubdomain: 'alice' }); await server.sendDesktopTunnelHeartbeat({ deviceId: 'desktop-alice', opencodeStatus: 'running', frpcStatus: 'running', tunnelStatus: 'connected', publicUrl: 'https://alice.frp.example.com', lastError: null }); const html = await renderManagementApp(server); if (!html.includes('Alice Laptop') || !html.includes('https://alice.frp.example.com') || !html.includes('远程设备')) throw new Error('surface failed'); console.log('desktop tunnel surface ok')"
```

Expected: smoke test passes and the driver prints `desktop tunnel surface ok`.

- [ ] **Step 6: Inspect git diff and status**

Run:

```bash
$env:GIT_MASTER='1'; git status --short --branch
$env:GIT_MASTER='1'; git diff --stat HEAD
```

Expected: only intended desktop auto FRP tunnel files are changed in the feature branch.

- [ ] **Step 7: Post Multica issue update**

Post a concise HUA-49 comment with plan path, implementation summary, verification commands and outcomes, manual QA result, and explicit limitation that real public FRP/DNS connectivity was not verified if no real FRP panel was available. Do not include agent mention links.
