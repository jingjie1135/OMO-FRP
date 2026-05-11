import type {
  CloudflareTunnelDependency,
  CloudflareTunnelDiagnostic,
  CloudflareTunnelMode,
  CloudflareTunnelOptions,
  CloudflareTunnelPlan,
} from "./types"

const DEFAULT_PORT = 4096
const DEFAULT_TUNNEL_NAME = "opencode-local"
const OPENCODE_INSTALL_HINT = "Install OpenCode first, then rerun this command."
const OMO_INSTALL_HINT = "Install/configure the oh-my-openagent OpenCode plugin with bunx oh-my-openagent install --no-tui, then rerun this command."
const CLOUDFLARED_INSTALL_HINT = "Install cloudflared from Cloudflare, Homebrew, winget, apt, or your OS package manager."

function commandExists(command: string): boolean {
  return Bun.which(command) !== null
}

function normalizeMode(mode: CloudflareTunnelOptions["mode"], hostname: string | undefined): CloudflareTunnelMode {
  if (mode === "quick" || mode === "named") return mode
  return hostname ? "named" : "quick"
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function getPassword(options: CloudflareTunnelOptions): string | undefined {
  return options.password ?? process.env.OPENCODE_SERVER_PASSWORD
}

function buildDependencies(ohMyOpenagentCommand: string): CloudflareTunnelDependency[] {
  const ohMyOpenagentExecutable = ohMyOpenagentCommand.split(/\s+/)[0] ?? ohMyOpenagentCommand
  return [
    {
      name: "opencode",
      installed: commandExists("opencode"),
      command: "opencode --version",
      installHint: OPENCODE_INSTALL_HINT,
    },
    {
      name: "oh-my-openagent",
      installed:
        commandExists(ohMyOpenagentExecutable) || commandExists("oh-my-openagent") || commandExists("oh-my-opencode"),
      command: `${ohMyOpenagentCommand} doctor`,
      installHint: OMO_INSTALL_HINT,
    },
    {
      name: "cloudflared",
      installed: commandExists("cloudflared"),
      command: "cloudflared --version",
      installHint: CLOUDFLARED_INSTALL_HINT,
    },
  ]
}

function buildInstallCommands(ohMyOpenagentCommand: string): string[] {
  return [
    "opencode --version",
    `${ohMyOpenagentCommand} install --no-tui --claude=<yes|no|max20> --openai=<yes|no> --gemini=<yes|no> --copilot=<yes|no>`,
    `${ohMyOpenagentCommand} doctor`,
    "opencode auth login",
  ]
}

function buildConfigureCommands(port: number, password: string | undefined): string[] {
  const passwordValue = password ? shellQuote(password) : "<strong-password>"
  return [
    `export OPENCODE_SERVER_PASSWORD=${passwordValue}`,
    `opencode serve --hostname 127.0.0.1 --port ${port}`,
  ]
}

function buildWindowsConfigureCommands(port: number): string[] {
  return [
    "$env:OPENCODE_SERVER_PASSWORD = '<strong-password>'",
    `opencode serve --hostname 127.0.0.1 --port ${port}`,
  ]
}

function buildCloudflaredCommands(
  mode: CloudflareTunnelMode,
  port: number,
  hostname: string | undefined,
  tunnelName: string,
): string[] {
  if (mode === "quick") {
    return [`cloudflared tunnel --url http://127.0.0.1:${port}`]
  }

  return [
    "cloudflared tunnel login",
    `cloudflared tunnel create ${shellQuote(tunnelName)}`,
    `cloudflared tunnel route dns ${shellQuote(tunnelName)} ${shellQuote(hostname ?? "opencode.example.com")}`,
    `cloudflared tunnel run --url http://127.0.0.1:${port} ${shellQuote(tunnelName)}`,
  ]
}

function buildPublicUrl(mode: CloudflareTunnelMode, hostname: string | undefined): string {
  if (mode === "named" && hostname) {
    return `https://${hostname}`
  }
  return "https://<generated>.trycloudflare.com"
}

function buildDiagnostics(
  requestedMode: CloudflareTunnelOptions["mode"],
  resolvedMode: CloudflareTunnelMode,
  hostname: string | undefined,
  passwordConfigured: boolean,
  dependencies: CloudflareTunnelDependency[],
): CloudflareTunnelDiagnostic[] {
  const diagnostics: CloudflareTunnelDiagnostic[] = []

  if (!passwordConfigured) {
    diagnostics.push({
      code: "password-missing",
      severity: "error",
      message: "OPENCODE_SERVER_PASSWORD is not configured, so OpenCode must not be exposed remotely.",
      fix: "Set a strong OPENCODE_SERVER_PASSWORD before running cloudflared.",
    })
  }

  for (const dependency of dependencies) {
    if (!dependency.installed) {
      diagnostics.push({
        code: `${dependency.name}-missing`,
        severity: "error",
        message: `${dependency.name} was not found on PATH.`,
        fix: dependency.installHint,
      })
    }
  }

  if (requestedMode !== undefined && requestedMode !== "quick" && requestedMode !== "named") {
    diagnostics.push({
      code: "invalid-mode",
      severity: "error",
      message: `Unsupported tunnel mode: ${requestedMode}.`,
      fix: "Use --mode quick or --mode named.",
    })
  }

  if (resolvedMode === "named" && !hostname) {
    diagnostics.push({
      code: "hostname-missing",
      severity: "error",
      message: "Named tunnels require a hostname in a Cloudflare-managed domain.",
      fix: "Pass --hostname <subdomain.example.com> or use --mode quick for a temporary URL.",
    })
  }

  if (resolvedMode === "named") {
    diagnostics.push({
      code: "cloudflared-login",
      severity: "info",
      message: "Named tunnel setup requires an authenticated Cloudflare account.",
      fix: "Run cloudflared tunnel login before create/route/run when using --mode named.",
    })
  }

  diagnostics.push(
    {
      code: "route-or-domain",
      severity: "info",
      message: "A wrong DNS route or domain will make the public URL unreachable.",
      fix: "Verify the hostname belongs to the Cloudflare account and the tunnel route points to this tunnel.",
    },
    {
      code: "opencode-not-running",
      severity: "info",
      message: "Cloudflare Tunnel only forwards traffic if local OpenCode is running on the selected port.",
      fix: "Start opencode locally and verify the local URL before starting cloudflared.",
    },
    {
      code: "port-conflict",
      severity: "info",
      message: "If the selected port is already occupied by another process, OpenCode may start elsewhere or fail.",
      fix: "Choose another --port and use the same port in the cloudflared --url target.",
    },
    {
      code: "auth-failed",
      severity: "info",
      message: "A 401 or repeated password prompt means the password is missing or incorrect on the client side.",
      fix: "Use the same OPENCODE_SERVER_PASSWORD that was set before starting OpenCode.",
    },
  )

  return diagnostics
}

function buildSecurityNotes(publicUrl: string): string[] {
  return [
    "OpenCode can read and write local files and can execute terminal commands in the active workspace.",
    `Treat ${publicUrl} as remote access to this machine, not as a static web page.`,
    "Never expose OpenCode without a strong OPENCODE_SERVER_PASSWORD.",
    "Do not share the public URL or password with untrusted people.",
    "Prefer a named tunnel with your own hostname for stable use; quick tunnels are temporary and should be treated as ad hoc access.",
  ]
}

function buildSuccessChecks(localUrl: string, publicUrl: string): string[] {
  return [
    "cloudflared --version exits successfully.",
    `Open ${localUrl} locally and confirm OpenCode responds before exposing it.`,
    "Start cloudflared and confirm it prints a tunnel URL or running tunnel status.",
    `Open ${publicUrl} from another network and confirm it requires the OpenCode password.`,
    "Run a harmless OpenCode action, then close the tunnel when finished.",
  ]
}

export function createCloudflareTunnelPlan(options: CloudflareTunnelOptions = {}): CloudflareTunnelPlan {
  const port = options.port ?? DEFAULT_PORT
  const mode = normalizeMode(options.mode, options.hostname)
  const password = getPassword(options)
  const passwordConfigured = typeof password === "string" && password.length > 0
  const tunnelName = options.tunnelName ?? DEFAULT_TUNNEL_NAME
  const ohMyOpenagentCommand = options.ohMyOpenagentCommand ?? "bunx oh-my-openagent"
  const dependencies = buildDependencies(ohMyOpenagentCommand)
  const publicUrl = buildPublicUrl(mode, options.hostname)
  const localUrl = `http://127.0.0.1:${port}`
  const diagnostics = buildDiagnostics(options.mode, mode, options.hostname, passwordConfigured, dependencies)

  return {
    mode,
    hostname: options.hostname,
    tunnelName: mode === "named" ? tunnelName : undefined,
    localUrl,
    publicUrl,
    passwordConfigured,
    canExpose: passwordConfigured && diagnostics.every((diagnostic) => diagnostic.severity !== "error"),
    dependencies,
    installCommands: buildInstallCommands(ohMyOpenagentCommand),
    configureCommands: buildConfigureCommands(port, password),
    windowsConfigureCommands: buildWindowsConfigureCommands(port),
    cloudflaredCommands: buildCloudflaredCommands(mode, port, options.hostname, tunnelName),
    successChecks: buildSuccessChecks(localUrl, publicUrl),
    securityNotes: buildSecurityNotes(publicUrl),
    diagnostics,
  }
}
