export type CloudflareTunnelMode = "quick" | "named"

export interface CloudflareTunnelOptions {
  mode?: CloudflareTunnelMode | string
  hostname?: string
  tunnelName?: string
  port?: number
  password?: string
  json?: boolean
  ohMyOpenagentCommand?: string
}

export interface CloudflareTunnelDependency {
  name: "opencode" | "oh-my-openagent" | "cloudflared"
  installed: boolean
  command: string
  installHint: string
}

export interface CloudflareTunnelDiagnostic {
  code: string
  severity: "error" | "warning" | "info"
  message: string
  fix: string
}

export interface CloudflareTunnelPlan {
  mode: CloudflareTunnelMode
  hostname?: string
  tunnelName?: string
  localUrl: string
  publicUrl: string
  passwordConfigured: boolean
  canExpose: boolean
  dependencies: CloudflareTunnelDependency[]
  installCommands: string[]
  configureCommands: string[]
  windowsConfigureCommands: string[]
  cloudflaredCommands: string[]
  successChecks: string[]
  securityNotes: string[]
  diagnostics: CloudflareTunnelDiagnostic[]
}
