import { buildServerDeployPlan, buildStartPlan, detectInstallConfig, SERVER_DEPLOY_DEFAULTS } from "./cli/install-config"
import { remoteAccess } from "./cli/remote-access"
import type { RemoteAccessOptions } from "./cli/remote-access"
import { cloudflareTunnel } from "./cli/cloudflare-tunnel"
import { createCloudflareTunnelPlan } from "./cli/cloudflare-tunnel/plan"

const VERSION = "0.1.0"

function valueAfter(args: string[], name: string): string | undefined {
  const prefix = `${name}=`
  const inline = args.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name)
}

function numberValue(args: string[], name: string, fallback?: number): number | undefined {
  const value = valueAfter(args, name)
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed)) throw new Error(`${name} must be an integer`)
  return parsed
}

function redactStartPlan(plan: ReturnType<typeof buildStartPlan>) {
  return {
    ...plan,
    generatedPassword: plan.generatedPassword ? "<redacted>" : null,
    env: {
      ...plan.env,
      OPENCODE_SERVER_PASSWORD: plan.env.OPENCODE_SERVER_PASSWORD ? "<redacted>" : undefined,
    },
  }
}

function printHelp(): void {
  console.log(`OpenCode Remote Platform ${VERSION}

Usage:
  opencode-remote <command> [options]

Commands:
  detect                 Detect OpenCode, Bun, plugin config, password, and port readiness
  start                  Print a password-aware local OpenCode serve command
  server-deploy-plan     Print server deploy paths, URLs, secrets, and commands
  remote-access          Expose local OpenCode through frp-panel routing
  cloudflare-tunnel      Generate Cloudflare Tunnel steps for local OpenCode
  smoke                  Run a local smoke validation of migrated planners
  version                Show version

oh-my-openagent is treated as an OpenCode plugin dependency, not this platform's CLI or package boundary.`)
}

async function detect(args: string[]): Promise<number> {
  const result = await detectInstallConfig({
    port: numberValue(args, "--port", 4096),
    remote: hasFlag(args, "--remote"),
  })

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(result, null, 2))
    return result.missingDependencies.length === 0 && result.warnings.length === 0 ? 0 : 1
  }

  console.log(`Platform: ${result.platform}/${result.arch}`)
  console.log(`Config dir: ${result.configDir}`)
  console.log(`OpenCode: ${result.opencode.available ? result.opencode.version ?? "available" : "missing"}`)
  console.log(`Bun: ${result.bun.available ? result.bun.version ?? "available" : "missing"}`)
  console.log(`Docker: ${result.docker.available ? result.docker.version ?? "available" : "missing"}`)
  console.log(`Compose: ${result.compose.available ? result.compose.version ?? "available" : "missing"}`)
  console.log(`oh-my-openagent plugin config: ${result.pluginConfigExists ? "present" : "missing"}`)
  console.log(`OPENCODE_SERVER_PASSWORD: ${result.passwordConfigured ? "set" : "missing"}`)
  console.log(`Port ${result.port}: ${result.portAvailable ? "available" : "busy"}`)
  for (const warning of result.warnings) console.log(`Warning: ${warning}`)
  return result.missingDependencies.length === 0 && result.warnings.length === 0 ? 0 : 1
}

function start(args: string[]): number {
  const plan = buildStartPlan({
    port: numberValue(args, "--port", 4096),
    remote: hasFlag(args, "--remote"),
    publicUrl: valueAfter(args, "--public-url"),
    generatePassword: !hasFlag(args, "--no-generate-password"),
  })

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(redactStartPlan(plan), null, 2))
    return 0
  }

  console.log(`Local OpenCode URL: http://127.0.0.1:${plan.port}`)
  console.log(`Public URL: ${plan.publicUrl}`)
  if (plan.generatedPassword) console.log("Generated OPENCODE_SERVER_PASSWORD; store it before exposing the server.")
  for (const warning of plan.warnings) console.log(`Warning: ${warning}`)
  console.log(plan.command)
  return 0
}

function serverDeployPlan(args: string[]): number {
  const plan = buildServerDeployPlan({
    domain: valueAfter(args, "--domain"),
    email: valueAfter(args, "--email"),
    installRoot: valueAfter(args, "--install-root") ?? SERVER_DEPLOY_DEFAULTS.DEFAULT_INSTALL_ROOT,
    opencodePort: numberValue(args, "--opencode-port", SERVER_DEPLOY_DEFAULTS.DEFAULT_OPENCODE_PORT),
    frpPanelApiPort: numberValue(args, "--frp-panel-api-port", SERVER_DEPLOY_DEFAULTS.DEFAULT_FRP_PANEL_API_PORT),
    frpPanelRpcPort: numberValue(args, "--frp-panel-rpc-port", SERVER_DEPLOY_DEFAULTS.DEFAULT_FRP_PANEL_RPC_PORT),
    frpPanelVersion: valueAfter(args, "--frp-panel-version") ?? SERVER_DEPLOY_DEFAULTS.DEFAULT_FRP_PANEL_VERSION,
    publicUrl: valueAfter(args, "--public-url"),
  })

  if (hasFlag(args, "--json")) {
    console.log(JSON.stringify(plan, null, 2))
    return 0
  }

  console.log(`OpenCode URL: ${plan.opencodePublicUrl}`)
  console.log(`frp-panel API URL: ${plan.frpPanelApiUrl}`)
  console.log(`frp-panel RPC URL: ${plan.frpPanelRpcUrl}`)
  console.log(`Manages OpenCode by default: ${plan.managesOpenCodeByDefault ? "yes" : "no"}`)
  console.log("Required secrets:")
  for (const secret of plan.requiredSecrets) console.log(`  - ${secret}`)
  console.log("Server commands:")
  for (const command of plan.commands) console.log(`  ${command}`)
  console.log("Explicit OpenCode actions:")
  for (const action of plan.explicitToolActions) console.log(`  ${action.id}: ${action.command}`)
  return 0
}

async function remoteAccessCommand(args: string[]): Promise<number> {
  const options: RemoteAccessOptions = {
    panelUrl: valueAfter(args, "--panel-url") ?? "",
    panelApiUrl: valueAfter(args, "--panel-api-url"),
    panelRpcUrl: valueAfter(args, "--panel-rpc-url"),
    authToken: valueAfter(args, "--auth-token") ?? "",
    serverId: valueAfter(args, "--server-id"),
    clientId: valueAfter(args, "--client-id"),
    clientSecret: valueAfter(args, "--client-secret"),
    password: valueAfter(args, "--password"),
    username: valueAfter(args, "--username"),
    proxyName: valueAfter(args, "--proxy-name"),
    frpBinary: valueAfter(args, "--frp-binary"),
    serverAddr: valueAfter(args, "--server-addr"),
    serverPort: numberValue(args, "--server-port"),
    transport: valueAfter(args, "--transport"),
    localPort: numberValue(args, "--local-port"),
    remotePort: numberValue(args, "--remote-port"),
    subdomain: valueAfter(args, "--subdomain"),
    customDomain: valueAfter(args, "--custom-domain"),
    https: !hasFlag(args, "--http"),
    outputConfig: valueAfter(args, "--output-config"),
    frpcBin: valueAfter(args, "--frpc-bin"),
    noStart: hasFlag(args, "--no-start"),
    noFrpc: hasFlag(args, "--no-frpc"),
    json: hasFlag(args, "--json"),
  }

  return remoteAccess(options)
}

async function cloudflareTunnelCommand(args: string[]): Promise<number> {
  return cloudflareTunnel({
    mode: valueAfter(args, "--mode"),
    hostname: valueAfter(args, "--hostname"),
    tunnelName: valueAfter(args, "--tunnel-name"),
    port: numberValue(args, "--port") ?? numberValue(args, "-p"),
    password: valueAfter(args, "--password"),
    json: hasFlag(args, "--json"),
    ohMyOpenagentCommand: valueAfter(args, "--plugin-command"),
  })
}

async function smoke(): Promise<number> {
  buildStartPlan({ remote: true, port: 4096, publicUrl: "https://opencode.example.com" })
  buildServerDeployPlan({ domain: "opencode.example.com", email: "admin@example.com" })
  await remoteAccess({
    panelUrl: "https://frp.example.com",
    authToken: "secret-token",
    password: "Strong-password-123!",
    subdomain: "alice-code",
    noStart: true,
    noFrpc: true,
    json: true,
  })
  const tunnelPlan = createCloudflareTunnelPlan({ password: "Strong-password-123!" })
  if (!tunnelPlan.cloudflaredCommands.some((command) => command.includes("cloudflared tunnel --url"))) {
    throw new Error("Cloudflare tunnel planner did not produce a quick tunnel command")
  }
  console.log("smoke passed")
  return 0
}

async function main(): Promise<number> {
  const [command, ...args] = process.argv.slice(2)
  try {
    switch (command) {
      case undefined:
      case "help":
      case "--help":
      case "-h":
        printHelp()
        return 0
      case "detect":
        return detect(args)
      case "start":
        return start(args)
      case "server-deploy-plan":
        return serverDeployPlan(args)
      case "remote-access":
        return remoteAccessCommand(args)
      case "cloudflare-tunnel":
        return cloudflareTunnelCommand(args)
      case "smoke":
        return smoke()
      case "version":
      case "--version":
      case "-v":
        console.log(`opencode-remote-platform v${VERSION}`)
        return 0
      default:
        console.error(`Unknown command: ${command}`)
        printHelp()
        return 1
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

process.exit(await main())
