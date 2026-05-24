import { afterEach, describe, expect, it } from "bun:test"
import React, { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import type { FrpStatus } from "../../../management-api/types"
import type { FrpClientConfig, FrpServerConfig, PublicEndpoint, RuntimeCapabilities, RuntimeInfo } from "../../../core/app-config/types"
import { ClientFrpPanel } from "./ClientFrpPanel"
import { EndpointRouteForm } from "./EndpointRouteForm"
import { FrpConnectionCard } from "./FrpConnectionCard"
import { FrpPage } from "./FrpPage"
import { FrpStatusCard } from "./FrpStatusCard"
import { getFrpPanelActions } from "./frp-panel-actions"

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

function changeFormControl(control: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = control instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set
  if (!valueSetter) throw new Error("Cannot set native form control value.")
  valueSetter.call(control, value)
  control.dispatchEvent(new Event("input", { bubbles: true }))
}

const serverCapabilities: RuntimeCapabilities = {
  mode: "server",
  canManageFrpServer: true,
  canManageFrpClient: false,
  canInstallServerServices: true,
  canAccessLocalFilesystem: true,
  canManageSystemd: true,
  canManageLocalProcesses: true,
}

const serverConfig: FrpServerConfig = {
  enabled: true,
  panelUrl: "https://frp.example.com",
  rpcUrl: "https://frp.example.com/rpc",
  serverAddr: "frp.example.com",
  bindPort: 7000,
  authTokenRef: "FRP_TOKEN",
  dashboardEnabled: true,
}

const clientConfig: FrpClientConfig = {
  endpointId: "desktop-route",
  serverAddr: "frp.example.com",
  serverPort: 7000,
  authTokenRef: "FRP_TOKEN",
  localHost: "127.0.0.1",
  localPort: 4096,
  proxyName: "desktop-opencode",
  subdomain: "desktop",
  transport: "tcp",
}

const endpoint: PublicEndpoint = {
  id: "desktop-route",
  name: "Desktop Route",
  domain: "desktop.example.com",
  protocol: "https",
  targetType: "desktop-frp",
  targetToolInstanceId: "opencode-desktop",
  authMode: "opencode-password",
  status: "active",
}

const status: FrpStatus = {
  mode: "server",
  running: true,
  status: "ready",
  message: "FRP server is running.",
  publicUrl: "https://desktop.example.com",
  client: { id: "desktop-client", status: "online", lastSeenAt: "2026-05-16T12:00:00Z", frpsUrl: "https://frp.example.com" },
  proxy: { name: "desktop-opencode", type: "http", status: "running", publicUrl: "https://desktop.example.com" },
}

const runtimeInfo: RuntimeInfo = {
  capabilities: serverCapabilities,
  config: {
    mode: "server",
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [endpoint],
    frpServer: serverConfig,
    frpClients: [],
  },
}

describe("frp panel actions", () => {
  it("shows server actions in server mode", () => {
    expect(getFrpPanelActions("server")).toContain("初始化 frp-panel")
    expect(getFrpPanelActions("server")).toContain("生成桌面端连接配置")
  })

  it("shows client actions in desktop mode", () => {
    expect(getFrpPanelActions("desktop")).toContain("生成 frpc 配置")
    expect(getFrpPanelActions("desktop")).toContain("启动 frpc")
  })
})

describe("FRP panels", () => {
  it("renders server configuration, client resources, and masked token details", () => {
    const container = render(
      <FrpPage
        capabilities={serverCapabilities}
        status={status}
        endpoints={[endpoint]}
        runtimeInfo={runtimeInfo}
        serverConfig={serverConfig}
        saveServerConfig={async () => {}}
        startFrp={async () => {}}
        stopFrp={async () => {}}
      />,
    )

    expect(container.querySelector("h2#frp-server-heading")).toBeTruthy()
    expect(container.textContent).toContain("Panel 地址")
    expect(container.textContent).toContain("https://frp.example.com")
    expect(container.textContent).toContain("RPC 地址")
    expect(container.textContent).toContain("https://frp.example.com/rpc")
    expect(container.textContent).toContain("服务端地址")
    expect(container.textContent).toContain("绑定端口")
    expect(container.textContent).toContain("已启用")
    expect(container.textContent).toContain("FRP_TOKEN (masked)")
    expect(container.textContent).toContain("desktop-client")
    expect(container.textContent).toContain("Desktop Route")
    expect(container.textContent).not.toContain("super-secret-token")
  })

  it("renders the fomo-style FRP connection card and toggles the active connection", async () => {
    let stopped = false
    let started = false
    const container = render(
      <FrpPage
        capabilities={serverCapabilities}
        status={status}
        endpoints={[endpoint]}
        runtimeInfo={runtimeInfo}
        serverConfig={serverConfig}
        saveServerConfig={async () => {}}
        startFrp={async () => {
          started = true
        }}
        stopFrp={async () => {
          stopped = true
        }}
      />,
    )

    expect(container.textContent).toContain("FRP 服务端")
    expect(container.textContent).toContain("运行中")
    expect(container.textContent).toContain("https://desktop.example.com")
    const disconnectButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("断开连接"))
    expect(disconnectButton).toBeDefined()

    await act(async () => disconnectButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })))

    expect(stopped).toBe(true)
    expect(started).toBe(false)
  })

  it("lets users edit and save FRP server configuration", async () => {
    const saved: FrpServerConfig[] = []
    const container = render(
      <FrpPage
        capabilities={serverCapabilities}
        status={{ ...status, running: false }}
        endpoints={[endpoint]}
        runtimeInfo={runtimeInfo}
        serverConfig={serverConfig}
        saveServerConfig={async (config) => {
          saved.push(config)
        }}
        startFrp={async () => {}}
        stopFrp={async () => {}}
      />,
    )

    const panelUrl = container.querySelector<HTMLInputElement>('input[name="panelUrl"]')
    const rpcUrl = container.querySelector<HTMLInputElement>('input[name="rpcUrl"]')
    const serverAddr = container.querySelector<HTMLInputElement>('input[name="serverAddr"]')
    const bindPort = container.querySelector<HTMLInputElement>('input[name="bindPort"]')
    const tokenRef = container.querySelector<HTMLInputElement>('input[name="authTokenRef"]')
    if (!panelUrl || !rpcUrl || !serverAddr || !bindPort || !tokenRef) throw new Error("Server config inputs did not render")

    await act(async () => {
      changeFormControl(panelUrl, "https://new-panel.example.com")
      changeFormControl(rpcUrl, "https://new-panel.example.com/rpc")
      changeFormControl(serverAddr, "new-frp.example.com")
      changeFormControl(bindPort, "7100")
      changeFormControl(tokenRef, "NEW_FRP_TOKEN")
    })

    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="FRP server configuration form"]')?.requestSubmit()
    })

    expect(saved).toEqual([{ ...serverConfig, panelUrl: "https://new-panel.example.com", rpcUrl: "https://new-panel.example.com/rpc", serverAddr: "new-frp.example.com", bindPort: 7100, authTokenRef: "NEW_FRP_TOKEN" }])
  })

  it("renders client configuration, generated frpc config, public URL, and connection state", () => {
    const container = render(
      <ClientFrpPanel
        status={{ ...status, mode: "client" }}
        config={clientConfig}
        endpoints={[endpoint]}
        runtimeInfo={{
          ...runtimeInfo,
          capabilities: { ...serverCapabilities, mode: "desktop", canManageFrpServer: false, canManageFrpClient: true },
          config: { ...runtimeInfo.config, mode: "desktop", frpClients: [clientConfig] },
        }}
        saveConfig={async () => {}}
        startFrp={async () => {}}
        stopFrp={async () => {}}
      />,
    )

    expect(container.querySelector("h2#frp-client-heading")).toBeTruthy()
    expect(container.textContent).toContain("frp.example.com")
    expect(container.textContent).toContain("7000")
    expect(container.textContent).toContain("FRP_TOKEN (masked)")
    expect(container.textContent).toContain("4096")
    expect(container.textContent).toContain("desktop-opencode")
    expect(container.textContent).toContain("desktop")
    expect(container.textContent).toContain("https://desktop.example.com")
    expect(container.textContent).toContain("serverAddr = \"frp.example.com\"")
  })

  it("lets users edit/import and save FRP client configuration", async () => {
    const saved: FrpClientConfig[] = []
    const container = render(
      <ClientFrpPanel
        status={{ ...status, mode: "client", running: false }}
        config={clientConfig}
        endpoints={[endpoint]}
        runtimeInfo={{
          ...runtimeInfo,
          capabilities: { ...serverCapabilities, mode: "desktop", canManageFrpServer: false, canManageFrpClient: true },
          config: { ...runtimeInfo.config, mode: "desktop", frpClients: [clientConfig] },
        }}
        saveConfig={async (config) => {
          saved.push(config)
        }}
        startFrp={async () => {}}
        stopFrp={async () => {}}
      />,
    )

    const importBox = container.querySelector<HTMLTextAreaElement>('textarea[name="connectionConfig"]')
    if (!importBox) throw new Error("Connection import textarea did not render")

    await act(async () => {
      changeFormControl(importBox, JSON.stringify({ serverAddr: "imported.example.com", serverPort: 7200, authTokenRef: "IMPORTED_FRP_TOKEN", proxyName: "imported-proxy", subdomain: "imported" }))
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[data-testid="import-frp-client-config"]')?.click()
    })

    expect(container.querySelector<HTMLInputElement>('input[name="serverAddr"]')?.value).toBe("imported.example.com")
    expect(container.querySelector<HTMLInputElement>('input[name="serverPort"]')?.value).toBe("7200")
    expect(container.querySelector<HTMLInputElement>('input[name="authTokenRef"]')?.value).toBe("IMPORTED_FRP_TOKEN")

    await act(async () => {
      changeFormControl(container.querySelector<HTMLInputElement>('input[name="localPort"]')!, "5099")
    })
    await act(async () => {
      container.querySelector<HTMLFormElement>('form[aria-label="FRP client configuration form"]')?.requestSubmit()
    })

    expect(saved).toEqual([{ ...clientConfig, serverAddr: "imported.example.com", serverPort: 7200, authTokenRef: "IMPORTED_FRP_TOKEN", localPort: 5099, proxyName: "imported-proxy", subdomain: "imported" }])
  })

  it("renders semantic status, connection, and endpoint route summaries", () => {
    const statusContainer = render(<FrpStatusCard {...status} />)
    expect(statusContainer.textContent).toContain("ready")
    expect(statusContainer.textContent).toContain("FRP server is running")

    document.body.innerHTML = ""
    const connectionContainer = render(<FrpConnectionCard serverAddr="frp.example.com" serverPort={7000} publicUrl="https://desktop.example.com" connected={true} tokenRef="FRP_TOKEN" />)
    expect(connectionContainer.textContent).toContain("已连接")
    expect(connectionContainer.textContent).toContain("frp.example.com:7000")
    expect(connectionContainer.textContent).toContain("FRP_TOKEN (masked)")

    document.body.innerHTML = ""
    const routeContainer = render(<EndpointRouteForm {...clientConfig} publicUrl="https://desktop.example.com" />)
    expect(routeContainer.textContent).toContain("desktop-opencode")
    expect(routeContainer.textContent).toContain("127.0.0.1:4096")
    expect(routeContainer.textContent).toContain("https://desktop.example.com")

    document.body.innerHTML = ""
    const secretRouteContainer = render(<EndpointRouteForm {...clientConfig} authTokenRef="super-secret-token" publicUrl="https://desktop.example.com" />)
    expect(secretRouteContainer.textContent).toContain("已配置密钥（已遮罩）")
    expect(secretRouteContainer.textContent).not.toContain("super-secret-token")
  })
})
