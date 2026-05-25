import { describe, expect, it } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createDesktopRuntimeAdapter, getDesktopRuntimeInfo } from "./runtime-adapter"

describe("desktop runtime adapter", () => {
  it("returns desktop capabilities", async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-capabilities-"))
    const info = await createDesktopRuntimeAdapter({ runtimeDir, toolSpecs: [] }).getRuntimeInfo()

    expect(info.capabilities.mode).toBe("desktop")
    expect(info.capabilities.canManageFrpClient).toBe(true)
    expect(info.capabilities.canManageFrpServer).toBe(false)
  })

  it("detects configured desktop tool metadata and frp status", async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-"))
    const configDir = join(runtimeDir, "opencode-config")
    const frpDir = join(runtimeDir, "frp")
    const cloudflareDir = join(runtimeDir, "cloudflared")
    mkdirSync(configDir, { recursive: true })
    mkdirSync(frpDir, { recursive: true })
    mkdirSync(cloudflareDir, { recursive: true })
    writeFileSync(join(configDir, "opencode.json"), "{}")
    writeFileSync(join(configDir, "oh-my-openagent.json"), "{}")
    writeFileSync(join(frpDir, "frpc.toml"), 'serverAddr = "frp.example.com"\nserverPort = 7000\nlocalPort = 4096\nname = "desktop-opencode"\n')
    writeFileSync(join(cloudflareDir, "config.yml"), "url: http://127.0.0.1:4096\n")

    const adapter = createDesktopRuntimeAdapter({
      runtimeDir,
      isPortAvailable: async () => true,
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: "strong-password",
      },
      toolSpecs: [
        {
          id: "opencode-desktop",
          kind: "opencode",
          displayName: "OpenCode",
          binaryNames: ["opencode"],
          versionArgs: ["--version"],
          resolveBinaryPath: () => "C:/bin/opencode",
          resolveConfigDirectory: () => configDir,
          defaultPort: 4096,
          buildStartCommand: () => ({ command: ["C:/bin/opencode", "serve", "--hostname", "127.0.0.1", "--port", "4096"], currentPort: 4096, configDirectory: configDir }),
        },
        {
          id: "frpc-desktop",
          kind: "frpc",
          displayName: "frpc",
          binaryNames: ["frpc"],
          versionArgs: ["-v"],
          resolveBinaryPath: () => "C:/bin/frpc",
          resolveConfigDirectory: () => frpDir,
          resolveConfigFile: (dir) => join(dir, "frpc.toml"),
          resolveCurrentPort: () => 4096,
          defaultPort: 4096,
          buildStartCommand: () => ({ command: ["C:/bin/frpc", "-c", join(frpDir, "frpc.toml")], currentPort: 4096, configDirectory: frpDir }),
        },
        {
          id: "cloudflared-desktop",
          kind: "cloudflared",
          displayName: "cloudflared",
          binaryNames: ["cloudflared"],
          versionArgs: ["--version"],
          resolveBinaryPath: () => "C:/bin/cloudflared",
          resolveConfigDirectory: () => cloudflareDir,
          resolveConfigFile: (dir) => join(dir, "config.yml"),
          resolveCurrentPort: () => 4096,
          defaultPort: 4096,
          buildStartCommand: () => ({ command: ["C:/bin/cloudflared", "tunnel", "--url", "http://127.0.0.1:4096"], currentPort: 4096, configDirectory: cloudflareDir }),
        },
      ],
    })

    const detections = await adapter.detectTools()
    expect(detections.map((item) => item.kind)).toEqual(["opencode", "frpc", "cloudflared"])
    expect(detections.every((item) => item.detected)).toBe(true)

    const info = await adapter.getRuntimeInfo()
    expect(info.config.toolInstances).toHaveLength(3)
    expect(info.config.pluginConfigs).toHaveLength(1)
    expect(info.config.frpClients).toHaveLength(1)

    const frpStatus = await adapter.getFrpStatus()
    expect(frpStatus.mode).toBe("client")
    expect(frpStatus.running).toBe(false)
    expect(frpStatus.message).toContain("frpc 未运行")
  })

  it("starts, restarts, stops, and logs managed desktop processes", async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-lifecycle-"))
    const nodePath = Bun.which("node")
    expect(nodePath).toBeString()

    const adapter = createDesktopRuntimeAdapter({
      runtimeDir,
      env: {
        ...process.env,
        OPENCODE_SERVER_PASSWORD: "strong-password",
      },
      toolSpecs: [
        {
          id: "opencode-desktop",
          kind: "opencode",
          displayName: "OpenCode",
          binaryNames: ["node"],
          versionArgs: ["--version"],
          resolveBinaryPath: () => nodePath!,
          resolveConfigDirectory: () => runtimeDir,
          defaultPort: 4196,
          buildStartCommand: () => ({
            command: [nodePath!, "-e", 'console.log("boot Authorization: Bearer session-secret token=client-secret password=Strong-password-123!"); setInterval(() => console.log("tick"), 25)'],
            currentPort: 4196,
            configDirectory: runtimeDir,
          }),
        },
      ],
    })

    const startResult = await adapter.startTool("opencode-desktop")
    expect(startResult.status).toBe("succeeded")

    await new Promise((resolve) => setTimeout(resolve, 120))

    const runningTools = await adapter.listToolInstances()
    expect(runningTools[0]?.status).toBe("running")
    expect(runningTools[0]?.pid).toBeNumber()

    const restartResult = await adapter.restartTool("opencode-desktop")
    expect(restartResult.status).toBe("succeeded")

    await new Promise((resolve) => setTimeout(resolve, 120))

    const logsAfterRestart = await adapter.getToolLogs("opencode-desktop")
    expect(logsAfterRestart.some((line) => line.message.includes("boot") || line.message.includes("tick"))).toBe(true)
    expect(logsAfterRestart.some((line) => line.message.includes("session-secret") || line.message.includes("client-secret") || line.message.includes("Strong-password-123"))).toBe(false)
    expect(logsAfterRestart.some((line) => line.message.includes("[REDACTED]"))).toBe(true)

    const stopResult = await adapter.stopTool("opencode-desktop")
    expect(stopResult.status).toBe("succeeded")

    await new Promise((resolve) => setTimeout(resolve, 120))

    const stoppedTools = await adapter.listToolInstances()
    expect(stoppedTools[0]?.status).toBe("stopped")
    expect(stoppedTools[0]?.pid).toBeUndefined()
  })

  it("caches desktop detection metadata between tool instance reads", async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-cache-"))
    let resolveBinaryCalls = 0

    const adapter = createDesktopRuntimeAdapter({
      runtimeDir,
      toolSpecs: [
        {
          id: "opencode-desktop",
          kind: "opencode",
          displayName: "OpenCode",
          binaryNames: ["opencode"],
          versionArgs: ["--version"],
          resolveBinaryPath: () => {
            resolveBinaryCalls++
            return "C:/bin/opencode"
          },
          resolveConfigDirectory: () => runtimeDir,
          defaultPort: 4096,
          buildStartCommand: () => ({ command: ["C:/bin/opencode", "serve"], currentPort: 4096, configDirectory: runtimeDir }),
        },
      ],
    })

    await adapter.listToolInstances()
    await adapter.listToolInstances()

    expect(resolveBinaryCalls).toBe(1)
  })

  it("uses the configured port availability checker before starting OpenCode", async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-port-checker-"))
    const checkedPorts: number[] = []

    const adapter = createDesktopRuntimeAdapter({
      runtimeDir,
      isPortAvailable: async (port) => {
        checkedPorts.push(port)
        return false
      },
      toolSpecs: [
        {
          id: "opencode-desktop",
          kind: "opencode",
          displayName: "OpenCode",
          binaryNames: ["opencode"],
          versionArgs: ["--version"],
          resolveBinaryPath: () => "C:/bin/opencode",
          resolveConfigDirectory: () => runtimeDir,
          defaultPort: 4396,
          buildStartCommand: () => ({ command: ["C:/bin/opencode", "serve"], currentPort: 4396, configDirectory: runtimeDir }),
        },
      ],
    })

    const result = await adapter.startTool("opencode-desktop")

    expect(result.status).toBe("failed")
    expect(result.message).toContain("端口冲突")
    expect(checkedPorts).toEqual([4396])
  })


  it("reuses an externally running OpenCode listener on the configured port", async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-opencode-reuse-"))
    const bunPath = Bun.which("bun")
    expect(bunPath).toBeString()

    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 4496,
      fetch() {
        return new Response("opencode ready")
      },
    })

    try {
      const adapter = createDesktopRuntimeAdapter({
        runtimeDir,
        isPortAvailable: async () => false,
        canReuseOpenCodePort: async (port) => port === 4496,
        env: {
          ...process.env,
          OPENCODE_SERVER_PASSWORD: "strong-password",
        },
        toolSpecs: [
          {
            id: "opencode-desktop",
            kind: "opencode",
            displayName: "OpenCode",
            binaryNames: ["bun"],
            versionArgs: ["--version"],
            resolveBinaryPath: () => bunPath!,
            resolveConfigDirectory: () => runtimeDir,
            defaultPort: 4496,
            buildStartCommand: () => ({
              command: [bunPath!, "-e", 'setInterval(() => console.log("tick"), 25)'],
              currentPort: 4496,
              configDirectory: runtimeDir,
            }),
          },
        ],
      })

      const result = await adapter.startTool("opencode-desktop")

      expect(result.status).toBe("succeeded")
      expect(result.message).toContain("已复用")
      const tools = await adapter.listToolInstances()
      expect(tools[0]?.status).toBe("running")
      expect(tools[0]?.pid).toBeUndefined()
      expect(tools[0]?.lastError).toBeUndefined()
    } finally {
      server.stop(true)
    }
  })
  it("reports a clear diagnostic when the managed OpenCode port is already occupied", async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-port-"))
    const bunPath = Bun.which("bun")
    expect(bunPath).toBeString()

    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 4296,
      fetch() {
        return new Response("busy")
      },
    })

    try {
      const adapter = createDesktopRuntimeAdapter({
        runtimeDir,
        isPortAvailable: async () => false,
        canReuseOpenCodePort: async () => false,
        env: {
          ...process.env,
          OPENCODE_SERVER_PASSWORD: "strong-password",
        },
        toolSpecs: [
          {
            id: "opencode-desktop",
            kind: "opencode",
            displayName: "OpenCode",
            binaryNames: ["bun"],
            versionArgs: ["--version"],
            resolveBinaryPath: () => bunPath!,
            resolveConfigDirectory: () => runtimeDir,
            defaultPort: 4296,
            buildStartCommand: () => ({
              command: [bunPath!, "-e", 'setInterval(() => console.log("tick"), 25)'],
              currentPort: 4296,
              configDirectory: runtimeDir,
            }),
          },
        ],
      })

      const result = await adapter.startTool("opencode-desktop")
      expect(result.status).toBe("failed")
      expect(result.message).toContain("端口冲突")

      const tools = await adapter.listToolInstances()
      expect(tools[0]?.status).toBe("error")
      expect(tools[0]?.lastError).toContain("端口冲突")
    } finally {
      server.stop(true)
    }
  })
  it("does not reuse an externally running OpenCode listener that does not ask for a password", async () => {
    const runtimeDir = mkdtempSync(join(tmpdir(), "omo-desktop-runtime-unprotected-opencode-"))
    const bunPath = Bun.which("bun")
    expect(bunPath).toBeString()

    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 4596,
      fetch() {
        return new Response("opencode ready")
      },
    })

    try {
      const adapter = createDesktopRuntimeAdapter({
        runtimeDir,
        isPortAvailable: async () => false,
        env: {
          ...process.env,
          OPENCODE_SERVER_PASSWORD: "strong-password",
        },
        toolSpecs: [
          {
            id: "opencode-desktop",
            kind: "opencode",
            displayName: "OpenCode",
            binaryNames: ["bun"],
            versionArgs: ["--version"],
            resolveBinaryPath: () => bunPath!,
            resolveConfigDirectory: () => runtimeDir,
            defaultPort: 4596,
            buildStartCommand: () => ({
              command: [bunPath!, "-e", 'setInterval(() => console.log("tick"), 25)'],
              currentPort: 4596,
              configDirectory: runtimeDir,
            }),
          },
        ],
      })

      const result = await adapter.startTool("opencode-desktop")

      expect(result.status).toBe("failed")
      expect(result.message).toContain("端口冲突")
    } finally {
      server.stop(true)
    }
  })
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
})
