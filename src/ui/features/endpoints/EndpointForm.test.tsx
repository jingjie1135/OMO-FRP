import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { PublicEndpoint, RuntimeInfo } from "../../../core/app-config/types"
import { EndpointForm } from "./EndpointForm"

const mountedRoots: Root[] = []

afterEach(() => {
  for (const root of mountedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.innerHTML = ""
})

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
    publicEndpoints: [],
    frpClients: [],
  },
}

const endpoint: PublicEndpoint = {
  id: "ep1",
  name: "Test Endpoint",
  domain: "test.example.com",
  protocol: "https",
  targetType: "server-local",
  targetToolInstanceId: "tool1",
  authMode: "opencode-password",
  status: "disabled",
}

function renderForm(props: Partial<React.ComponentProps<typeof EndpointForm>> = {}) {
  let saved: PublicEndpoint | undefined
  let cancelled = false
  const container = document.createElement("div")
  document.body.append(container)
  const root = createRoot(container)
  mountedRoots.push(root)

  act(() => {
    root.render(
      <EndpointForm
        endpoint={endpoint}
        runtimeInfo={runtimeInfo}
        onSave={(nextEndpoint) => {
          saved = nextEndpoint
        }}
        onCancel={() => {
          cancelled = true
        }}
        {...props}
      />,
    )
  })

  return {
    container,
    saved: () => saved,
    cancelled: () => cancelled,
  }
}

function changeInput(container: HTMLElement, selector: string, value: string): void {
  const input = container.querySelector(selector)
  if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) {
    throw new Error(`Missing form control: ${selector}`)
  }
  act(() => {
    setNativeValue(input, value)
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }))
  })
}

function setNativeValue(input: HTMLInputElement | HTMLSelectElement, value: string): void {
  const prototype = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  if (!valueSetter) throw new Error("Cannot set native form control value.")
  valueSetter.call(input, value)
}

function submit(container: HTMLElement): void {
  const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === "Save")
  if (!(button instanceof HTMLButtonElement)) throw new Error("Save button not found")
  act(() => button.click())
}

describe("EndpointForm", () => {
  it("renders with initial values", () => {
    const { container } = renderForm()

    expect((container.querySelector('input[name="name"]') as HTMLInputElement | null)?.value).toBe("Test Endpoint")
    expect((container.querySelector('input[name="domain"]') as HTMLInputElement | null)?.value).toBe("test.example.com")
  })

  it("creates new endpoints in disabled state by default", () => {
    const { container, saved } = renderForm({ endpoint: undefined })
    changeInput(container, 'input[name="name"]', "New Endpoint")
    changeInput(container, 'input[name="domain"]', "new.example.com")

    submit(container)

    expect(saved()?.name).toBe("New Endpoint")
    expect(saved()?.domain).toBe("new.example.com")
    expect(saved()?.status).toBe("disabled")
    expect(saved()?.targetToolInstanceId).toBe("tool1")
  })

  it("validates domain format before save", () => {
    const { container, saved } = renderForm()
    changeInput(container, 'input[name="domain"]', "invalid-domain!")

    submit(container)

    expect(saved()).toBeUndefined()
    expect(container.textContent).toContain("Invalid domain format")
  })

  it("validates target tool instance before save", () => {
    const { container, saved } = renderForm({ runtimeInfo: { ...runtimeInfo, config: { ...runtimeInfo.config, toolInstances: [] } } })

    submit(container)

    expect(saved()).toBeUndefined()
    expect(container.textContent).toContain("Target tool instance is required")
  })

  it("validates auth mode safety before save", () => {
    const { container, saved } = renderForm()
    changeInput(container, 'select[name="authMode"]', "basic-auth")

    submit(container)

    expect(saved()).toBeUndefined()
    expect(container.textContent).toContain("OpenCode password gate")
  })

  it("normalizes full public URLs before save", () => {
    const { container, saved } = renderForm()
    changeInput(container, 'input[name="domain"]', "https://code.example.com/sessions")

    submit(container)

    expect(saved()?.protocol).toBe("https")
    expect(saved()?.domain).toBe("code.example.com")
  })

  it("allows desktop frp endpoints when the server runtime manages frp server", () => {
    const { container, saved } = renderForm()
    changeInput(container, 'select[name="targetType"]', "desktop-frp")

    submit(container)

    expect(saved()?.targetType).toBe("desktop-frp")
  })

  it("validates cloudflare provider availability before save", () => {
    const { container, saved } = renderForm()
    changeInput(container, 'select[name="targetType"]', "cloudflare")

    submit(container)

    expect(saved()).toBeUndefined()
    expect(container.textContent).toContain("Cloudflare endpoints require cloudflared")
  })

  it("calls onSave with updated values", () => {
    const { container, saved } = renderForm()
    changeInput(container, 'input[name="name"]', "Updated Name")

    submit(container)

    expect(saved()?.name).toBe("Updated Name")
  })
})
