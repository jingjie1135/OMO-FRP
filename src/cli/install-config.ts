import { existsSync } from "node:fs"
import { join } from "node:path"
import { randomBytes } from "node:crypto"

import { getOpenCodeConfigPaths } from "../shared/opencode-config-dir"
import { isPortAvailable } from "../shared/port-utils"
import { spawnWithWindowsHide } from "../shared/spawn-with-windows-hide"
import type {
  CommandStatus,
  DetectOptions,
  DetectResult,
  ServerDeployOptions,
  ServerDeployPlan,
  StartOptions,
  StartPlan,
} from "./install-config-types"

const DEFAULT_OPENCODE_PORT = 4096
const DEFAULT_FRP_PANEL_VERSION = "latest"
const DEFAULT_FRP_PANEL_API_PORT = 9000
const DEFAULT_FRP_PANEL_RPC_PORT = 9001
const DEFAULT_INSTALL_ROOT = "/opt/opencode-remote-platform"

async function readStream(stream: ReadableStream<Uint8Array> | undefined): Promise<string> {
  if (!stream) return ""
  return new Response(stream).text()
}

async function getCommandStatus(name: string, args: string[] = ["--version"]): Promise<CommandStatus> {
  try {
    const proc = spawnWithWindowsHide([name, ...args], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [stdout, stderr] = await Promise.all([readStream(proc.stdout), readStream(proc.stderr)])
    const exitCode = await proc.exited
    const output = `${stdout}\n${stderr}`.trim()
    return {
      name,
      available: exitCode === 0,
      version: exitCode === 0 ? output.split("\n")[0]?.trim() || null : null,
    }
  } catch {
    return { name, available: false, version: null }
  }
}

async function getComposeStatus(): Promise<CommandStatus> {
  const dockerCompose = await getCommandStatus("docker", ["compose", "version"])
  if (dockerCompose.available) {
    return { ...dockerCompose, name: "docker compose" }
  }

  return getCommandStatus("docker-compose", ["--version"])
}

function getPasswordConfigured(): boolean {
  return Boolean(process.env.OPENCODE_SERVER_PASSWORD?.trim())
}

function getPluginConfigExists(configDir: string): boolean {
  return existsSync(join(configDir, "oh-my-openagent.json")) || existsSync(join(configDir, "oh-my-openagent.jsonc"))
}

export function createStrongPassword(): string {
  return randomBytes(24).toString("base64url")
}

export async function detectInstallConfig(options: Partial<DetectOptions> = {}): Promise<DetectResult> {
  const port = options.port ?? DEFAULT_OPENCODE_PORT
  const paths = getOpenCodeConfigPaths({ binary: "opencode", version: null })
  const [opencode, bun, docker, compose, portAvailable] = await Promise.all([
    getCommandStatus("opencode", ["--version"]),
    getCommandStatus("bun", ["--version"]),
    getCommandStatus("docker", ["--version"]),
    getComposeStatus(),
    isPortAvailable(port),
  ])
  const missingDependencies = [opencode, bun]
    .filter((dependency) => !dependency.available)
    .map((dependency) => dependency.name)
  const warnings: string[] = []

  if (options.remote && !getPasswordConfigured()) {
    warnings.push("Remote exposure requires OPENCODE_SERVER_PASSWORD before publishing any public URL.")
  }
  if (!portAvailable) {
    warnings.push(`Port ${port} is already in use on 127.0.0.1.`)
  }

  return {
    platform: process.platform,
    arch: process.arch,
    mode: options.remote ? "remote" : "local",
    port,
    configDir: paths.configDir,
    opencode,
    bun,
    docker,
    compose,
    pluginConfigExists: getPluginConfigExists(paths.configDir),
    passwordConfigured: getPasswordConfigured(),
    portAvailable,
    missingDependencies,
    warnings,
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

export function buildStartPlan(options: Partial<StartOptions> = {}): StartPlan {
  const port = options.port ?? DEFAULT_OPENCODE_PORT
  const remote = options.remote ?? false
  const existingPassword = process.env.OPENCODE_SERVER_PASSWORD?.trim()
  const generatedPassword = existingPassword ? null : options.generatePassword === false ? null : createStrongPassword()
  const password = existingPassword || generatedPassword

  if (remote && !password) {
    throw new Error("Remote OpenCode access requires OPENCODE_SERVER_PASSWORD.")
  }

  const host = remote ? "127.0.0.1" : "127.0.0.1"
  const publicUrl = options.publicUrl?.trim() || `http://127.0.0.1:${port}`
  const env: Record<string, string> = {
    OPENCODE_HOST: host,
    OPENCODE_PORT: String(port),
  }
  const warnings: string[] = []

  if (password) {
    env.OPENCODE_SERVER_PASSWORD = password
  } else {
    warnings.push("No OPENCODE_SERVER_PASSWORD is set; keep this endpoint local only.")
  }

  const envAssignments = Object.entries(env)
    .filter(([key]) => key !== "OPENCODE_SERVER_PASSWORD")
    .map(([key, value]) => `${key}=${shellQuote(value)}`)
    .join(" ")

  return {
    host,
    port,
    remote,
    generatedPassword,
    publicUrl,
    command: `${envAssignments} opencode serve --hostname ${host} --port ${port}`,
    env,
    warnings,
  }
}

function normalizeInstallRoot(installRoot: string | undefined): string {
  const root = installRoot?.trim()
  return root && root.length > 0 ? root.replace(/\/$/, "") : DEFAULT_INSTALL_ROOT
}

function normalizeDomain(domain: string | undefined): string {
  const value = domain?.trim()
  if (!value) throw new Error("Server deploy plan requires --domain.")
  return value
}

function normalizeEmail(email: string | undefined): string {
  const value = email?.trim()
  if (!value) throw new Error("Server deploy plan requires --email.")
  return value
}

export function buildServerDeployPlan(options: Partial<ServerDeployOptions>): ServerDeployPlan {
  const domain = normalizeDomain(options.domain)
  normalizeEmail(options.email)
  const installRoot = normalizeInstallRoot(options.installRoot)
  const opencodePort = options.opencodePort ?? DEFAULT_OPENCODE_PORT
  const frpPanelApiPort = options.frpPanelApiPort ?? DEFAULT_FRP_PANEL_API_PORT
  const frpPanelRpcPort = options.frpPanelRpcPort ?? DEFAULT_FRP_PANEL_RPC_PORT
  const frpPanelImage = `vaalacat/frp-panel:${options.frpPanelVersion?.trim() || DEFAULT_FRP_PANEL_VERSION}`
  const opencodePublicUrl = options.publicUrl?.trim() || `https://${domain}`
  const frpPanelApiUrl = `https://frp.${domain}`
  const frpPanelRpcUrl = `wss://frp.${domain}/rpc`

  return {
    installRoot,
    envPath: `${installRoot}/.env`,
    composePath: `${installRoot}/docker-compose.yml`,
    caddyfilePath: `${installRoot}/Caddyfile`,
    systemdPath: "/etc/systemd/system/opencode-remote.service",
    healthcheckPath: `${installRoot}/healthcheck.sh`,
    opencodePublicUrl,
    frpPanelApiUrl,
    frpPanelRpcUrl,
    frpPanelImage,
    requiredSecrets: [
      "OPENCODE_SERVER_PASSWORD",
      "OPENCODE_REMOTE_BASIC_AUTH_PASSWORD_HASH",
      "FRP_PANEL_APP_GLOBAL_SECRET",
    ],
    commands: [
      `install -d -m 0750 ${installRoot}`,
      `cp .env.example ${installRoot}/.env`,
      `cp docker-compose.yml Caddyfile healthcheck.sh ${installRoot}/`,
      `cp opencode-remote.service /etc/systemd/system/opencode-remote.service`,
      `OPENCODE_CONFIG_DIR=${installRoot}/opencode opencode-remote detect --remote --port ${opencodePort}`,
      `OPENCODE_CONFIG_DIR=${installRoot}/opencode bunx oh-my-openagent install --no-tui --claude=max20 --openai=no --gemini=no --copilot=no --skip-auth`,
      `opencode-remote start --remote --port ${opencodePort} --public-url ${opencodePublicUrl}`,
      `docker compose --env-file ${installRoot}/.env -f ${installRoot}/docker-compose.yml up -d frp-panel caddy`,
      "systemctl daemon-reload",
      "systemctl enable --now opencode-remote.service",
      `${installRoot}/healthcheck.sh`,
    ],
  }
}

export const SERVER_DEPLOY_DEFAULTS = {
  DEFAULT_OPENCODE_PORT,
  DEFAULT_FRP_PANEL_VERSION,
  DEFAULT_FRP_PANEL_API_PORT,
  DEFAULT_FRP_PANEL_RPC_PORT,
  DEFAULT_INSTALL_ROOT,
} as const
