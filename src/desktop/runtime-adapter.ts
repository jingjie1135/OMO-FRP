import { existsSync, readFileSync } from "node:fs"
import { appendFile, mkdir, readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join, win32 } from "node:path"
import { spawn, type ChildProcessByStdio } from "node:child_process"
import type { Readable } from "node:stream"

import {
  DESKTOP_CAPABILITIES,
  type AppConfig,
  type FrpClientConfig,
  type PluginConfig,
  type RuntimeInfo,
  type ToolInstance,
  type ToolKind,
} from "../core/app-config/types"
import type { FrpStatus, JobResult, LogLine, ToolDetection } from "../management-api/types"
import { CONFIG_BASENAME, LEGACY_CONFIG_BASENAME } from "../shared/plugin-identity"
import { isPortAvailable } from "../shared/port-utils"
import { spawnSync } from "../shared/bun-spawn-shim"
import { getOpenCodeConfigPaths } from "../shared/opencode-config-dir"

const DEFAULT_OPENCODE_PORT = 4096
const DEFAULT_FRPC_SERVER_PORT = 7000
const PID_NONE = -1
const LOG_TAIL_LIMIT = 4096

export interface DesktopToolSpec {
  id: string
  kind: ToolKind
  displayName: string
  binaryNames: string[]
  versionArgs: string[]
  defaultPort: number
  resolveBinaryPath?: (env: NodeJS.ProcessEnv) => string | null
  resolveConfigDirectory: (runtimeDir: string, env: NodeJS.ProcessEnv) => string | undefined
  resolveConfigFile?: (configDirectory: string, runtimeDir: string) => string | undefined
  resolveCurrentPort?: (configFile: string | undefined, opencodePort: number) => number | undefined
  buildStartCommand: (context: DesktopToolContext) => DesktopStartCommand
}

interface DesktopToolContext {
  binaryPath: string
  env: NodeJS.ProcessEnv
  instance: ToolInstance
  opencodePort: number
  runtimeDir: string
}

interface DesktopStartCommand {
  command: string[]
  env?: Record<string, string | undefined>
  currentPort?: number
  configDirectory?: string
  workingDirectory?: string
  diagnostics?: string[]
}

interface ManagedToolState {
  status: ToolInstance["status"]
  binaryPath?: string
  version?: string
  configDirectory?: string
  configFile?: string
  workingDirectory?: string
  currentPort?: number
  pid?: number
  process?: ChildProcessByStdio<null, Readable, Readable>
  logPath?: string
  stopRequested: boolean
  lastExitCode?: number
  lastError?: string
  logTail: string
}

export interface DesktopRuntimeAdapter {
  getRuntimeInfo(): Promise<RuntimeInfo>
  detectTools(): Promise<ToolDetection[]>
  listToolInstances(): Promise<ToolInstance[]>
  startTool(instanceId: string): Promise<JobResult>
  stopTool(instanceId: string): Promise<JobResult>
  restartTool(instanceId: string): Promise<JobResult>
  getToolLogs(instanceId: string): Promise<LogLine[]>
  getFrpStatus(): Promise<FrpStatus>
  startFrp(): Promise<JobResult>
  stopFrp(): Promise<JobResult>
}

export interface DesktopRuntimeAdapterOptions {
  env?: NodeJS.ProcessEnv
  runtimeDir?: string
  toolSpecs?: DesktopToolSpec[]
}

const DEFAULT_TOOL_SPECS: DesktopToolSpec[] = [
  {
    id: "opencode-desktop",
    kind: "opencode",
    displayName: "OpenCode",
    binaryNames: ["opencode"],
    versionArgs: ["--version"],
    defaultPort: DEFAULT_OPENCODE_PORT,
    resolveConfigDirectory: () => getOpenCodeConfigPaths({ binary: "opencode", version: null }).configDir,
    buildStartCommand(context) {
      const port = context.instance.currentPort ?? context.instance.defaultPort
      return {
        command: [context.binaryPath, "serve", "--hostname", "127.0.0.1", "--port", String(port)],
        currentPort: port,
        configDirectory: context.instance.configDirectory,
      }
    },
  },
  {
    id: "frpc-desktop",
    kind: "frpc",
    displayName: "frpc",
    binaryNames: ["frpc"],
    versionArgs: ["-v"],
    defaultPort: DEFAULT_OPENCODE_PORT,
    resolveConfigDirectory(runtimeDir) {
      return join(runtimeDir, "frp")
    },
    resolveConfigFile(configDirectory) {
      return join(configDirectory, "frpc.toml")
    },
    resolveCurrentPort(configFile) {
      if (!configFile || !existsSync(configFile)) {
        return DEFAULT_OPENCODE_PORT
      }
      const content = readFileSync(configFile, "utf8")
      return readNumericAssignment(content, ["localPort", "local_port"]) ?? DEFAULT_OPENCODE_PORT
    },
    buildStartCommand(context) {
      const configDirectory = context.instance.configDirectory ?? join(context.runtimeDir, "frp")
      const configFile = join(configDirectory, "frpc.toml")
      const diagnostics: string[] = []

      if (!context.env.OPENCODE_SERVER_PASSWORD?.trim()) {
        diagnostics.push("认证失败：启动 frpc 前必须先设置 OPENCODE_SERVER_PASSWORD。")
      }
      if (!existsSync(configFile)) {
        diagnostics.push(`缺少 frpc 配置文件：${configFile}`)
      }

      return {
        command: [context.binaryPath, "-c", configFile],
        configDirectory,
        currentPort: context.instance.currentPort ?? DEFAULT_OPENCODE_PORT,
        diagnostics,
      }
    },
  },
  {
    id: "cloudflared-desktop",
    kind: "cloudflared",
    displayName: "cloudflared",
    binaryNames: ["cloudflared"],
    versionArgs: ["--version"],
    defaultPort: DEFAULT_OPENCODE_PORT,
    resolveConfigDirectory() {
      return process.platform === "win32"
        ? join(process.env.USERPROFILE ?? homedir(), ".cloudflared")
        : join(homedir(), ".cloudflared")
    },
    resolveConfigFile(configDirectory) {
      const yaml = join(configDirectory, "config.yml")
      if (existsSync(yaml)) return yaml
      const yml = join(configDirectory, "config.yaml")
      return existsSync(yml) ? yml : yaml
    },
    resolveCurrentPort(configFile, opencodePort) {
      if (!configFile || !existsSync(configFile)) {
        return opencodePort
      }
      const content = readFileSync(configFile, "utf8")
      return readPortFromUrl(content) ?? opencodePort
    },
    buildStartCommand(context) {
      const diagnostics: string[] = []
      const configDirectory = context.instance.configDirectory
      const configFile = configDirectory ? resolveCloudflaredConfigFile(configDirectory) : undefined
      const currentPort = context.instance.currentPort ?? context.opencodePort

      if (!context.env.OPENCODE_SERVER_PASSWORD?.trim()) {
        diagnostics.push("认证失败：启动 cloudflared 前必须先设置 OPENCODE_SERVER_PASSWORD。")
      }

      if (configFile && existsSync(configFile)) {
        return {
          command: [context.binaryPath, "tunnel", "--config", configFile, "run"],
          currentPort,
          configDirectory,
          diagnostics,
        }
      }

      return {
        command: [context.binaryPath, "tunnel", "--url", `http://127.0.0.1:${currentPort}`],
        currentPort,
        configDirectory,
        diagnostics,
      }
    },
  },
]

class DesktopRuntimeAdapterImpl implements DesktopRuntimeAdapter {
  private readonly env: NodeJS.ProcessEnv
  private readonly runtimeDir: string
  private readonly specs: DesktopToolSpec[]
  private readonly states = new Map<string, ManagedToolState>()

  constructor(options: DesktopRuntimeAdapterOptions = {}) {
    this.env = options.env ?? process.env
    this.runtimeDir = options.runtimeDir ?? getDesktopRuntimeDir(this.env)
    this.specs = options.toolSpecs ?? DEFAULT_TOOL_SPECS

    for (const spec of this.specs) {
      this.states.set(spec.id, {
        status: "stopped",
        stopRequested: false,
        currentPort: spec.defaultPort,
        logTail: "",
      })
    }
  }

  async getRuntimeInfo(): Promise<RuntimeInfo> {
    const toolInstances = await this.listToolInstances()
    return {
      capabilities: DESKTOP_CAPABILITIES,
      config: {
        mode: "desktop",
        toolInstances,
        pluginConfigs: buildPluginConfigs(toolInstances),
        publicEndpoints: [],
        frpClients: buildFrpClients(toolInstances),
      },
    }
  }

  async detectTools(): Promise<ToolDetection[]> {
    return Promise.all(this.specs.map((spec) => this.detectTool(spec)))
  }

  async listToolInstances(): Promise<ToolInstance[]> {
    await this.detectTools()
    return Promise.all(this.specs.map((spec) => this.buildToolInstance(spec)))
  }

  async startTool(instanceId: string): Promise<JobResult> {
    const spec = this.getSpec(instanceId)
    const state = this.getState(instanceId)

    if (state.process && state.status === "running") {
      return createJobResult(instanceId, "succeeded", `${spec.displayName} 已在运行。`)
    }

    const detection = await this.detectTool(spec)
    if (!detection.detected || !detection.binaryPath) {
      state.lastError = `${spec.displayName} 未检测到可执行文件。`
      state.status = "error"
      return createJobResult(instanceId, "failed", state.lastError)
    }

    const instance = await this.buildToolInstance(spec)
    const opencodePort = await this.resolveOpenCodePort()
    const startCommand = spec.buildStartCommand({
      binaryPath: detection.binaryPath,
      env: this.env,
      instance,
      opencodePort,
      runtimeDir: this.runtimeDir,
    })

    if (startCommand.diagnostics && startCommand.diagnostics.length > 0) {
      state.lastError = startCommand.diagnostics[0]
      state.status = "error"
      return createJobResult(instanceId, "failed", startCommand.diagnostics.join(" "))
    }

    const currentPort = startCommand.currentPort ?? instance.currentPort ?? instance.defaultPort
    if (spec.kind === "opencode" && !(await isPortAvailable(currentPort))) {
      state.lastError = `端口冲突：${currentPort} 已被占用。`
      state.status = "error"
      return createJobResult(instanceId, "failed", state.lastError)
    }

    const logPath = join(this.runtimeDir, "logs", `${instanceId}.log`)
    await mkdir(join(this.runtimeDir, "logs"), { recursive: true })
    await appendFile(logPath, "")

    const proc = spawn(startCommand.command[0]!, startCommand.command.slice(1), {
      cwd: startCommand.workingDirectory ?? this.runtimeDir,
      env: {
        ...this.env,
        ...startCommand.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }) as ChildProcessByStdio<null, Readable, Readable>

    state.process = proc
    state.pid = proc.pid ?? PID_NONE
    state.stopRequested = false
    state.status = "running"
    state.binaryPath = detection.binaryPath
    state.version = detection.version
    state.configDirectory = startCommand.configDirectory ?? detection.configDirectory
    state.configFile = state.configDirectory ? resolveConfigFile(spec, state.configDirectory, this.runtimeDir) : undefined
    state.workingDirectory = startCommand.workingDirectory ?? this.runtimeDir
    state.currentPort = currentPort
    state.logPath = logPath
    state.lastExitCode = undefined
    state.lastError = undefined
    state.logTail = ""

    this.attachLogging(spec, state, proc)
    void appendTimestampedLog(state, "info", `${spec.displayName} started pid=${state.pid} command=${startCommand.command.join(" ")}`)

    return createJobResult(instanceId, "succeeded", `${spec.displayName} 已启动，PID=${state.pid}。`)
  }

  async stopTool(instanceId: string): Promise<JobResult> {
    const spec = this.getSpec(instanceId)
    const state = this.getState(instanceId)

    if (!state.process) {
      return createJobResult(instanceId, "failed", `${spec.displayName} 当前不是由 OMO-FRP 启动的运行态进程。`)
    }

    state.stopRequested = true
    state.process.kill("SIGTERM")

    await Promise.race([
      onceExit(state.process),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)).then(async () => {
        if (state.process) {
          state.process.kill("SIGKILL")
          await onceExit(state.process)
        }
      }),
    ])

    return createJobResult(instanceId, "succeeded", `${spec.displayName} 已停止。`)
  }

  async restartTool(instanceId: string): Promise<JobResult> {
    const state = this.getState(instanceId)
    if (state.process) {
      await this.stopTool(instanceId)
    }
    return this.startTool(instanceId)
  }

  async getToolLogs(instanceId: string): Promise<LogLine[]> {
    const state = this.getState(instanceId)
    if (!state.logPath || !existsSync(state.logPath)) {
      return []
    }

    const content = await readFile(state.logPath, "utf8")
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map(parseLogLine)
  }

  async getFrpStatus(): Promise<FrpStatus> {
    const instance = await this.buildToolInstance(this.getSpec("frpc-desktop"))
    if (instance.status === "running") {
      return {
        mode: "client",
        running: true,
        message: `frpc 运行中，PID=${instance.pid ?? PID_NONE}，本地端口=${instance.currentPort ?? DEFAULT_OPENCODE_PORT}，日志=${instance.logPath ?? ""}`,
      }
    }

    if (instance.lastError) {
      return {
        mode: "client",
        running: false,
        message: instance.lastError,
      }
    }

    if (!instance.binaryPath) {
      return {
        mode: "client",
        running: false,
        message: "frpc 未检测到。",
      }
    }

    const configFile = instance.configDirectory ? join(instance.configDirectory, "frpc.toml") : ""
    if (!configFile || !existsSync(configFile)) {
      return {
        mode: "client",
        running: false,
        message: `frpc 未运行，且缺少配置文件：${configFile}`,
      }
    }

    return {
      mode: "client",
      running: false,
      message: `frpc 未运行，配置文件位于 ${configFile}。`,
    }
  }

  startFrp(): Promise<JobResult> {
    return this.startTool("frpc-desktop")
  }

  stopFrp(): Promise<JobResult> {
    return this.stopTool("frpc-desktop")
  }

  private getSpec(instanceId: string): DesktopToolSpec {
    const spec = this.specs.find((item) => item.id === instanceId)
    if (!spec) {
      throw new Error(`Unknown desktop tool instance: ${instanceId}`)
    }
    return spec
  }

  private getState(instanceId: string): ManagedToolState {
    const state = this.states.get(instanceId)
    if (!state) {
      throw new Error(`Missing runtime state for ${instanceId}`)
    }
    return state
  }

  private async resolveOpenCodePort(): Promise<number> {
    const opencode = await this.buildToolInstance(this.getSpec("opencode-desktop"))
    return opencode.currentPort ?? DEFAULT_OPENCODE_PORT
  }

  private async detectTool(spec: DesktopToolSpec): Promise<ToolDetection> {
    const state = this.getState(spec.id)
    const binaryPath = spec.resolveBinaryPath?.(this.env) ?? resolveBinaryPath(spec.binaryNames)
    const configDirectory = spec.resolveConfigDirectory(this.runtimeDir, this.env)
    const configFile = configDirectory ? resolveConfigFile(spec, configDirectory, this.runtimeDir) : undefined
    const currentPort = spec.resolveCurrentPort?.(configFile, await this.resolveOpenCodePortFallback())

    state.binaryPath = binaryPath ?? undefined
    state.configDirectory = configDirectory
    state.configFile = configFile
    state.currentPort = currentPort ?? state.currentPort ?? spec.defaultPort
    state.version = binaryPath ? resolveVersion(binaryPath, spec.versionArgs) : undefined

    return {
      kind: spec.kind,
      displayName: spec.displayName,
      detected: Boolean(binaryPath),
      binaryPath: binaryPath ?? undefined,
      version: state.version,
      configDirectory,
    }
  }

  private async resolveOpenCodePortFallback(): Promise<number> {
    const opencodeState = this.states.get("opencode-desktop")
    return opencodeState?.currentPort ?? DEFAULT_OPENCODE_PORT
  }

  private async buildToolInstance(spec: DesktopToolSpec): Promise<ToolInstance> {
    const state = this.getState(spec.id)
    const configDirectory = state.configDirectory ?? spec.resolveConfigDirectory(this.runtimeDir, this.env)
    const configFile = configDirectory ? resolveConfigFile(spec, configDirectory, this.runtimeDir) : undefined
    const configured = Boolean(configFile && existsSync(configFile)) || hasConfigDirectorySignal(spec.kind, configDirectory)

    return {
      id: spec.id,
      kind: spec.kind,
      displayName: spec.displayName,
      hostType: "desktop",
      installState: !state.binaryPath ? "missing" : configured ? "configured" : "detected",
      binaryPath: state.binaryPath,
      workingDirectory: state.workingDirectory ?? configDirectory ?? this.runtimeDir,
      configDirectory,
      defaultPort: spec.defaultPort,
      currentPort: state.currentPort ?? spec.defaultPort,
      status: state.status,
      pid: state.process ? state.pid : undefined,
      logPath: state.logPath,
      lastExitCode: state.lastExitCode,
      lastError: state.lastError,
    }
  }

  private attachLogging(spec: DesktopToolSpec, state: ManagedToolState, proc: ChildProcessByStdio<null, Readable, Readable>): void {
    const forward = (level: LogLine["level"], chunk: string) => {
      for (const line of chunk.split(/\r?\n/)) {
        if (!line.trim()) continue
        void appendTimestampedLog(state, level, line)
      }
    }

    if (!proc.stdout || !proc.stderr) {
      return
    }

    proc.stdout.setEncoding("utf8")
    proc.stdout.on("data", (chunk: string) => {
      forward("info", chunk)
    })

    proc.stderr.setEncoding("utf8")
    proc.stderr.on("data", (chunk: string) => {
      forward("error", chunk)
    })

    proc.once("error", (error) => {
      state.status = "error"
      state.lastError = `${spec.displayName} 启动失败：${error.message}`
      void appendTimestampedLog(state, "error", state.lastError)
      state.process = undefined
      state.pid = undefined
    })

    proc.once("exit", (code) => {
      const exitCode = code ?? 1
      state.lastExitCode = exitCode
      state.process = undefined
      state.pid = undefined

      if (state.stopRequested || exitCode === 0) {
        state.status = "stopped"
        state.lastError = undefined
        void appendTimestampedLog(state, "info", `${spec.displayName} stopped exit=${exitCode}`)
        return
      }

      state.status = "error"
      state.lastError = classifyFailure(spec, exitCode, state.logTail)
      void appendTimestampedLog(state, "error", state.lastError)
    })
  }
}

export function createDesktopRuntimeAdapter(options: DesktopRuntimeAdapterOptions = {}): DesktopRuntimeAdapter {
  return new DesktopRuntimeAdapterImpl(options)
}

export async function getDesktopRuntimeInfo(_config: AppConfig = createEmptyDesktopConfig()): Promise<RuntimeInfo> {
  return createDesktopRuntimeAdapter().getRuntimeInfo()
}

export async function detectDesktopTools(): Promise<ToolDetection[]> {
  return createDesktopRuntimeAdapter().detectTools()
}

export function createEmptyDesktopConfig(): AppConfig {
  return {
    mode: "desktop",
    toolInstances: [],
    pluginConfigs: [],
    publicEndpoints: [],
    frpClients: [],
  }
}

function getDesktopRuntimeDir(env: NodeJS.ProcessEnv): string {
  if (process.platform === "win32") {
    const appData = env.APPDATA || join(homedir(), "AppData", "Roaming")
    return win32.join(appData, "opencode-remote-platform")
  }

  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "opencode-remote-platform")
  }

  return join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "opencode-remote-platform")
}

function resolveBinaryPath(binaryNames: string[]): string | null {
  for (const binaryName of binaryNames) {
    const resolved = Bun.which(binaryName)
    if (resolved) return resolved
  }
  return null
}

function resolveVersion(binaryPath: string, versionArgs: string[]): string | undefined {
  try {
    const result = spawnSync([binaryPath, ...versionArgs], {
      stdout: "pipe",
      stderr: "pipe",
    })

    if (!result.success) {
      return undefined
    }

    const output = `${result.stdout?.toString("utf8") ?? ""}\n${result.stderr?.toString("utf8") ?? ""}`.trim()
    return output.split(/\r?\n/)[0]?.trim() || undefined
  } catch {
    return undefined
  }
}

function resolveConfigFile(spec: DesktopToolSpec, configDirectory: string, runtimeDir: string): string | undefined {
  return spec.resolveConfigFile?.(configDirectory, runtimeDir)
}

function resolveCloudflaredConfigFile(configDirectory: string): string {
  const yaml = join(configDirectory, "config.yml")
  if (existsSync(yaml)) return yaml
  return join(configDirectory, "config.yaml")
}

function readNumericAssignment(content: string, keys: string[]): number | undefined {
  for (const key of keys) {
    const match = content.match(new RegExp(`${key}\\s*=\\s*(\\d+)`, "i"))
    if (match) {
      return Number.parseInt(match[1]!, 10)
    }
  }
  return undefined
}

function readPortFromUrl(content: string): number | undefined {
  const match = content.match(/https?:\/\/[^:\s]+:(\d+)/i)
  if (!match) return undefined
  return Number.parseInt(match[1]!, 10)
}

function hasConfigDirectorySignal(kind: ToolKind, configDirectory: string | undefined): boolean {
  if (!configDirectory) return false
  if (kind === "opencode") {
    return existsSync(join(configDirectory, "opencode.json")) || existsSync(join(configDirectory, "opencode.jsonc"))
  }
  if (kind === "frpc") {
    return existsSync(join(configDirectory, "frpc.toml"))
  }
  if (kind === "cloudflared") {
    return existsSync(join(configDirectory, "config.yml")) || existsSync(join(configDirectory, "config.yaml"))
  }
  return false
}

function buildPluginConfigs(toolInstances: ToolInstance[]): PluginConfig[] {
  const opencodeInstance = toolInstances.find((tool) => tool.kind === "opencode")
  if (!opencodeInstance?.configDirectory) {
    return []
  }

  const configPath = resolvePluginConfigPath(opencodeInstance.configDirectory)
  if (!configPath) {
    return []
  }

  return [
    {
      toolInstanceId: opencodeInstance.id,
      plugin: "oh-my-openagent",
      configPath,
      status: "configured",
      presets: [],
    },
  ]
}

function resolvePluginConfigPath(configDirectory: string): string | null {
  const primaryJson = join(configDirectory, `${CONFIG_BASENAME}.json`)
  if (existsSync(primaryJson)) return primaryJson
  const primaryJsonc = join(configDirectory, `${CONFIG_BASENAME}.jsonc`)
  if (existsSync(primaryJsonc)) return primaryJsonc
  const legacyJson = join(configDirectory, `${LEGACY_CONFIG_BASENAME}.json`)
  if (existsSync(legacyJson)) return legacyJson
  const legacyJsonc = join(configDirectory, `${LEGACY_CONFIG_BASENAME}.jsonc`)
  if (existsSync(legacyJsonc)) return legacyJsonc
  return null
}

function buildFrpClients(toolInstances: ToolInstance[]): FrpClientConfig[] {
  const frpc = toolInstances.find((tool) => tool.kind === "frpc")
  if (!frpc?.configDirectory) {
    return []
  }

  const configPath = join(frpc.configDirectory, "frpc.toml")
  if (!existsSync(configPath)) {
    return []
  }

  const content = readFileSync(configPath, "utf8")
  return [
    {
      endpointId: "desktop-frpc",
      serverAddr: readStringAssignment(content, ["serverAddr", "server_addr"]) ?? "",
      serverPort: readNumericAssignment(content, ["serverPort", "server_port"]) ?? DEFAULT_FRPC_SERVER_PORT,
      authTokenRef: "env:FRP_TOKEN",
      localHost: readStringAssignment(content, ["localIP", "local_ip", "localHost", "local_host"]) ?? "127.0.0.1",
      localPort: readNumericAssignment(content, ["localPort", "local_port"]) ?? DEFAULT_OPENCODE_PORT,
      proxyName: readStringAssignment(content, ["name"]) ?? "desktop-opencode",
      transport: "tcp",
    },
  ]
}

function readStringAssignment(content: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const match = content.match(new RegExp(`${key}\\s*=\\s*["']([^"']+)["']`, "i"))
    if (match) {
      return match[1]
    }
  }
  return undefined
}

async function appendTimestampedLog(state: ManagedToolState, level: LogLine["level"], message: string): Promise<void> {
  if (!state.logPath) {
    return
  }

  const line = `${new Date().toISOString()} ${level} ${message}\n`
  state.logTail = `${state.logTail}${line}`.slice(-LOG_TAIL_LIMIT)
  await appendFile(state.logPath, line)
}

function classifyFailure(spec: DesktopToolSpec, exitCode: number, logTail: string): string {
  const normalized = logTail.toLowerCase()
  if (normalized.includes("eaddrinuse") || normalized.includes("address already in use")) {
    return "端口冲突：目标端口已被其他进程占用。"
  }
  if (normalized.includes("401") || normalized.includes("unauthorized") || normalized.includes("authentication failed") || normalized.includes("token")) {
    return `认证失败：${spec.displayName} 启动后收到鉴权错误，请检查密码或 token。`
  }
  if (normalized.includes("login") && spec.kind === "cloudflared") {
    return "认证失败：cloudflared 需要先完成 Cloudflare 登录。"
  }
  return `${spec.displayName} 异常退出，exit=${exitCode}。`
}

function createJobResult(jobId: string, status: JobResult["status"], message: string): JobResult {
  return {
    jobId: `${jobId}:${Date.now()}`,
    status,
    message,
  }
}

function parseLogLine(line: string): LogLine {
  const match = line.match(/^(\S+)\s+(debug|info|warn|error)\s+(.*)$/)
  if (!match) {
    return {
      timestamp: new Date(0).toISOString(),
      level: "info",
      message: line,
    }
  }

  return {
    timestamp: match[1]!,
    level: match[2]! as LogLine["level"],
    message: match[3]!,
  }
}

function onceExit(proc: ChildProcessByStdio<null, Readable, Readable>): Promise<number | null> {
  return new Promise((resolve) => {
    if (proc.exitCode !== null) {
      resolve(proc.exitCode)
      return
    }

    proc.once("exit", (code) => resolve(code))
  })
}
