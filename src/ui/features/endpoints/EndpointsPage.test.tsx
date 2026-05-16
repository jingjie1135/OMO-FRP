import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { EndpointsPage } from "./EndpointsPage"
import type { EndpointSafetyCheck } from "./use-endpoints-state"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

const endpoint: PublicEndpoint = {
  id: "ep1",
  name: "OpenCode Endpoint",
  domain: "code.example.com",
  protocol: "https",
  targetType: "server-local",
  targetToolInstanceId: "tool1",
  authMode: "opencode-password",
  status: "active",
}

const runtimeInfo: RuntimeInfo = {
  capabilities: {
    mode: "server",
    canManageFrpServer: true,
    canManageFrpClient: false,
    canInstallServerServices: true,
    canAccessLocalFilesystem: true,
    canManageSystemd: true,
    canManageLocalProcesses: true,
  },
  config: {
    mode: "server",
    toolInstances: [
      {
        id: "tool1",
        kind: "opencode",
        displayName: "OpenCode",
        hostType: "server",
        installState: "configured",
        defaultPort: 4096,
        currentPort: 4096,
        status: "running",
      },
    ],
    pluginConfigs: [],
    publicEndpoints: [endpoint],
    frpClients: [],
  },
}

function renderPage(options: {
  endpoints?: PublicEndpoint[]
  checkSafety?: (endpoint: PublicEndpoint) => EndpointSafetyCheck
  onEnable?: (id: string) => Promise<void>
  onDisable?: (id: string) => Promise<void>
} = {}) {
  const enabledIds: string[] = []
  const disabledIds: string[] = []
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)
  act(() => {
    root.render(
      <EndpointsPage
        endpoints={options.endpoints ?? [endpoint]}
        runtimeInfo={runtimeInfo}
        saveEndpoint={async () => undefined}
        enableEndpoint={options.onEnable ?? (async (id) => {
          enabledIds.push(id)
        })}
        disableEndpoint={options.onDisable ?? (async (id) => {
          disabledIds.push(id)
        })}
        checkSafety={options.checkSafety ?? (() => ({ ok: true, issues: [], suggestion: "Endpoint is ready to enable." }))}
      />,
    )
  })
  return { container, enabledIds, disabledIds }
}

function clickButton(container: HTMLElement, label: string): void {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label)
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${label}`)
  act(() => button.click())
}

describe("EndpointsPage", () => {
  it("renders task 6 semantic sections and endpoint fields", () => {
    const { container } = renderPage()

    expect(container.querySelector("h2#endpoint-list-heading")).toBeTruthy()
    expect(container.querySelector("h2#endpoint-editor-heading")).toBeTruthy()
    expect(container.querySelector("h2#endpoint-validation-heading")).toBeTruthy()
    expect(container.querySelector("h2#endpoint-enable-heading")).toBeTruthy()
    expect(container.querySelector("h2#endpoint-disable-heading")).toBeTruthy()
    expect(container.querySelector("h2#diagnostics-heading")).toBeTruthy()
    expect(container.textContent).toContain("OpenCode Endpoint")
    expect(container.textContent).toContain("https://code.example.com")
    expect(container.textContent).toContain("server-local")
    expect(container.textContent).toContain("opencode-password")
  })

  it("blocks enable button when safety checks fail", () => {
    const disabledEndpoint: PublicEndpoint = { ...endpoint, status: "disabled" }
    const { container, enabledIds } = renderPage({
      endpoints: [disabledEndpoint],
      checkSafety: () => ({ ok: false, issues: ["Target tool is not running."], suggestion: "Target tool is not running." }),
    })

    clickButton(container, "Enable")

    expect(enabledIds).toEqual([])
    expect(container.textContent).toContain("Target tool is not running.")
  })

  it("confirms disable and preserves endpoint configuration in the view", () => {
    const originalConfirm = window.confirm
    window.confirm = () => true
    try {
      const { container, disabledIds } = renderPage()

      clickButton(container, "Disable")

      expect(disabledIds).toEqual([endpoint.id])
      expect(container.textContent).toContain("code.example.com")
      expect(container.textContent).toContain("opencode-password")
    } finally {
      window.confirm = originalConfirm
    }
  })

  it("requires confirmation before enabling a public endpoint", () => {
    const disabledEndpoint: PublicEndpoint = { ...endpoint, status: "disabled" }
    const originalConfirm = window.confirm
    const confirmationMessages: string[] = []
    window.confirm = (message?: string) => {
      confirmationMessages.push(String(message))
      return false
    }
    try {
      const { container, enabledIds } = renderPage({ endpoints: [disabledEndpoint] })

      clickButton(container, "Enable")

      expect(enabledIds).toEqual([])
      expect(confirmationMessages[0]).toContain("Enable public endpoint")
      expect(confirmationMessages[0]).toContain("opencode-password")
      expect(confirmationMessages[0]).toContain("https://code.example.com")
    } finally {
      window.confirm = originalConfirm
    }
  })
})
