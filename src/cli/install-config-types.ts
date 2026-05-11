export type DeploymentMode = "local" | "remote"

export interface DetectOptions {
  port: number
  remote: boolean
}

export interface CommandStatus {
  name: string
  available: boolean
  version: string | null
}

export interface DetectResult {
  platform: NodeJS.Platform
  arch: string
  mode: DeploymentMode
  port: number
  configDir: string
  opencode: CommandStatus
  bun: CommandStatus
  docker: CommandStatus
  compose: CommandStatus
  pluginConfigExists: boolean
  passwordConfigured: boolean
  portAvailable: boolean
  missingDependencies: string[]
  warnings: string[]
}

export interface StartOptions {
  port: number
  remote: boolean
  generatePassword: boolean
  publicUrl?: string
}

export interface StartPlan {
  host: string
  port: number
  remote: boolean
  generatedPassword: string | null
  publicUrl: string
  command: string
  env: Record<string, string>
  warnings: string[]
}

export interface ServerDeployOptions {
  domain: string
  email: string
  installRoot: string
  opencodePort: number
  frpPanelVersion: string
  frpPanelApiPort: number
  frpPanelRpcPort: number
  publicUrl?: string
}

export interface ExplicitToolAction {
  id: string
  description: string
  command: string
}

export interface ServerDeployPlan {
  installRoot: string
  envPath: string
  composePath: string
  caddyfilePath: string
  systemdPath: string
  healthcheckPath: string
  opencodePublicUrl: string
  frpPanelApiUrl: string
  frpPanelRpcUrl: string
  frpPanelImage: string
  managesOpenCodeByDefault: boolean
  requiredSecrets: string[]
  commands: string[]
  explicitToolActions: ExplicitToolAction[]
}
