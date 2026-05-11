import color from "../../shared/colors"
import type { CloudflareTunnelDiagnostic, CloudflareTunnelPlan } from "./types"

const LABEL_WIDTH = 19

function formatList(title: string, values: string[]): string[] {
  if (values.length === 0) return []

  return [color.bold(title), ...values.map((value) => `  - ${value}`), ""]
}

function formatCommandList(title: string, commands: string[]): string[] {
  return [color.bold(title), "```bash", ...commands, "```", ""]
}

function formatDiagnostic(diagnostic: CloudflareTunnelDiagnostic): string {
  const prefix = diagnostic.severity === "error" ? color.red("error") : diagnostic.severity === "warning" ? color.yellow("warn") : color.blue("info")
  return `  - ${prefix} ${diagnostic.code}: ${diagnostic.message} Fix: ${diagnostic.fix}`
}

function field(label: string, value: string): string {
  return `  ${label.padEnd(LABEL_WIDTH)}${value}`
}

export function formatCloudflareTunnelPlan(plan: CloudflareTunnelPlan): string {
  const lines: string[] = []

  lines.push("")
  lines.push(color.bold("Cloudflare Tunnel guide for local OpenCode"))
  lines.push(color.dim("─".repeat(56)))
  lines.push(field("Mode", plan.mode))
  lines.push(field("Local URL", plan.localUrl))
  lines.push(field("Public URL", plan.publicUrl))
  lines.push(field("Password", plan.passwordConfigured ? color.green("configured") : color.red("missing")))
  lines.push(field("Remote exposure", plan.canExpose ? color.green("allowed") : color.red("blocked until errors are fixed")))
  lines.push("")

  lines.push(color.bold("Dependency checks"))
  for (const dependency of plan.dependencies) {
    const state = dependency.installed ? color.green("found") : color.yellow("missing")
    lines.push(`  - ${dependency.name}: ${state} (${dependency.command})`)
    if (!dependency.installed) {
      lines.push(`    ${dependency.installHint}`)
    }
  }
  lines.push("")

  lines.push(...formatCommandList("1. Install and configure local OpenCode", plan.installCommands))
  lines.push(color.bold("2. Set the password and start OpenCode"))
  lines.push("macOS/Linux:")
  lines.push("```bash")
  lines.push(...plan.configureCommands)
  lines.push("```")
  lines.push("Windows PowerShell:")
  lines.push("```powershell")
  lines.push(...plan.windowsConfigureCommands)
  lines.push("```")
  lines.push("")
  lines.push(...formatCommandList("3. Start Cloudflare Tunnel", plan.cloudflaredCommands))
  lines.push(...formatList("Success checks", plan.successChecks))
  lines.push(...formatList("Security notes", plan.securityNotes))

  if (plan.diagnostics.length > 0) {
    lines.push(color.bold("Diagnostics"))
    lines.push(...plan.diagnostics.map(formatDiagnostic))
    lines.push("")
  }

  return lines.join("\n")
}

export function formatCloudflareTunnelJson(plan: CloudflareTunnelPlan): string {
  return JSON.stringify(plan, null, 2)
}
