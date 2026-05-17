import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { CloudflareTunnelConfigRequest, CloudflareTunnelPlan, CloudflareTunnelStatus } from "../../../management-api/types"
import type { RuntimeInfo } from "../../../core/app-config/types"
import { getRoutesForCapabilities } from "../../routes/routes"
import { CloudflareTunnelPage } from "./CloudflareTunnelPage"

const mountedRoots: Root[] = []

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

function changeFormControl(control: HTMLInputElement | HTMLSelectElement, value: string): void {
  const prototype = control instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  if (!valueSetter) throw new Error("Cannot set native form control value.")
  valueSetter.call(control, value)
  control.dispatchEvent(new Event("input", { bubbles: true }))
  control.dispatchEvent(new Event("change", { bubbles: true }))
}

const runtimeInfo: RuntimeInfo = {
  capabilities: {
    mode: "desktop",
    canManageFrpServer: false,
    canManageFrpClient: true,
    canInstallServerServices: false,
    canAccessLocalFilesystem: true,
    canManageSystemd: false,
    canManageLocalProcesses: true,
    canManageCloudflareTunnel: true,
  },
  config: {
    mode: "desktop",
    toolInstances: [
      {
        id: "opencode-desktop",
        kind: "opencode",
        displayName: "OpenCode",
        hostType: "desktop",
        installState: "configured",
        defaultPort: 4096,
        currentPort: 4096,
        status: "running",
      },
      {
        id: "cloudflared-desktop",
        kind: "cloudflared",
        displayName: "cloudflared",
        hostType: "desktop",
        installState: "installed",
        binaryPath: "cloudflared",
        defaultPort: 0,
        status: "stopped",
      },
    ],
    pluginConfigs: [],
    publicEndpoints: [
      {
        id: "cloudflare-route",
        name: "Cloudflare Route",
        domain: "opencode.example.com",
        protocol: "https",
        targetType: "cloudflare",
        targetToolInstanceId: "opencode-desktop",
        authMode: "opencode-password",
        status: "disabled",
      },
    ],
    frpClients: [],
  },
}

const quickConfig: CloudflareTunnelConfigRequest = {
  mode: "quick",
  localHost: "127.0.0.1",
  localPort: 4096,
}

const namedConfig: CloudflareTunnelConfigRequest = {
  mode: "named",
  localHost: "127.0.0.1",
  localPort: 4096,
  tunnelName: "local-opencode",
  hostname: "opencode.example.com",
  dnsRoute: "opencode.example.com",
}

const quickStatus: CloudflareTunnelStatus = {
  mode: "quick",
  running: false,
  message: "Quick tunnel is ready to start.",
  publicUrl: "https://blue-river.trycloudflare.com",
}

const quickPlan: CloudflareTunnelPlan = {
  mode: "quick",
  localUrl: "http://127.0.0.1:4096",
  publicUrl: "https://blue-river.trycloudflare.com",
  commandSummary: ["cloudflared tunnel --url http://127.0.0.1:4096 --token secret-token"],
  cloudflaredDetected: true,
  diagnostics: [],
  securityNotes: ["Quick tunnels are temporary and should be treated as ad hoc access."],
  steps: [],
}

const namedPlan: CloudflareTunnelPlan = {
  mode: "named",
  localUrl: "http://127.0.0.1:4096",
  publicUrl: "https://opencode.example.com",
  tunnelName: "local-opencode",
  hostname: "opencode.example.com",
  dnsRoute: "opencode.example.com",
  commandSummary: [
    "cloudflared tunnel login",
    "cloudflared tunnel create local-opencode",
    "cloudflared tunnel route dns local-opencode opencode.example.com",
    "cloudflared tunnel run local-opencode",
  ],
  cloudflaredDetected: true,
  diagnostics: [{ code: "dns_route_failed", severity: "error", message: "DNS route failed", fix: "Check DNS write permissions." }],
  securityNotes: ["Named tunnels use a Cloudflare-managed hostname and DNS route."],
  steps: [
    { id: "login", label: "Login", status: "succeeded", retryable: true },
    { id: "create_tunnel", label: "Create tunnel", status: "succeeded", retryable: true },
    { id: "configure_dns", label: "Configure DNS", status: "failed", message: "DNS route failed", retryable: true },
    { id: "write_config", label: "Write config", status: "idle", retryable: true },
    { id: "start_tunnel", label: "Start tunnel", status: "idle", retryable: true },
    { id: "verify_public_access", label: "Verify public access", status: "idle", retryable: true },
  ],
}

describe("Cloudflare Tunnel page", () => {
  it("adds route entry only when runtime capabilities expose tunnel support", () => {
    expect(getRoutesForCapabilities({ ...runtimeInfo.capabilities, canManageCloudflareTunnel: true }).map((route) => route.path)).toContain("/cloudflare")
    expect(getRoutesForCapabilities({ ...runtimeInfo.capabilities, canManageCloudflareTunnel: false }).map((route) => route.path)).not.toContain("/cloudflare")
  })

  it("renders quick tunnel flow with local target, command summary, generated public URL, detection, and redaction", () => {
    const container = render(
      <CloudflareTunnelPage
        runtimeInfo={runtimeInfo}
        status={quickStatus}
        config={quickConfig}
        plan={quickPlan}
        saveConfig={async () => {}}
        startTunnel={async () => {}}
        stopTunnel={async () => {}}
      />,
    )

    expect(container.querySelector("h1")?.textContent).toContain("Cloudflare Tunnel Management")
    expect(container.textContent).toContain("cloudflare:quick")
    expect(container.textContent).toContain("Quick tunnel flow")
    expect(container.textContent).toContain("http://127.0.0.1:4096")
    expect(container.textContent).toContain("https://blue-river.trycloudflare.com")
    expect(container.textContent).toContain("cloudflared:detected")
    expect(container.textContent).toContain("cloudflared tunnel --url http://127.0.0.1:4096 --token <redacted>")
    expect(container.textContent).not.toContain("secret-token")
  })

  it("lets users edit quick and named tunnel drafts", async () => {
    const saved: CloudflareTunnelConfigRequest[] = []
    const container = render(
      <CloudflareTunnelPage
        runtimeInfo={runtimeInfo}
        status={quickStatus}
        config={quickConfig}
        plan={quickPlan}
        saveConfig={async (config) => {
          saved.push(config)
        }}
        startTunnel={async () => {}}
        stopTunnel={async () => {}}
      />,
    )

    const mode = container.querySelector<HTMLSelectElement>('select[name="mode"]')
    const localPort = container.querySelector<HTMLInputElement>('input[name="localPort"]')
    const hostname = container.querySelector<HTMLInputElement>('input[name="hostname"]')
    const tunnelName = container.querySelector<HTMLInputElement>('input[name="tunnelName"]')
    const dnsRoute = container.querySelector<HTMLInputElement>('input[name="dnsRoute"]')
    if (!mode || !localPort || !hostname || !tunnelName || !dnsRoute) throw new Error("Cloudflare tunnel inputs did not render")

    await act(async () => {
      changeFormControl(mode, "named")
      changeFormControl(localPort, "5099")
      changeFormControl(hostname, "opencode.example.com")
      changeFormControl(tunnelName, "local-opencode")
      changeFormControl(dnsRoute, "opencode.example.com")
    })
    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="Cloudflare tunnel configuration form"]')?.requestSubmit()
    })

    expect(saved).toEqual([{ ...namedConfig, localPort: 5099 }])
  })

  it("renders named tunnel steps with failure guidance and retry affordance", async () => {
    const retried: string[] = []
    const container = render(
      <CloudflareTunnelPage
        runtimeInfo={runtimeInfo}
        status={{ mode: "named", running: false, message: "DNS route failed", failureReason: "dns_route_failed", suggestion: "Check Cloudflare DNS permissions." }}
        config={namedConfig}
        plan={namedPlan}
        saveConfig={async () => {}}
        startTunnel={async () => {}}
        stopTunnel={async () => {}}
        retryStep={async (stepId) => {
          retried.push(stepId)
        }}
      />,
    )

    expect(container.textContent).toContain("cloudflare:named")
    expect(container.textContent).toContain("Login")
    expect(container.textContent).toContain("Create tunnel")
    expect(container.textContent).toContain("Configure DNS")
    expect(container.textContent).toContain("DNS route failed")
    expect(container.textContent).toContain("Check Cloudflare DNS permissions")

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[data-testid="retry-cloudflare-step-configure_dns"]')?.click()
    })

    expect(retried).toEqual(["configure_dns"])
  })
})
