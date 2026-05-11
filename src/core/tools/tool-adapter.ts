import type { ToolDetection, ToolInstance } from "../../management-api/types"

export interface ToolCommand {
  command: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface ToolAdapter {
  readonly kind: ToolInstance["kind"]
  detect(): Promise<ToolDetection>
  getConfigPath(instance: ToolInstance): string | null
  buildStartCommand(instance: ToolInstance): ToolCommand
  getStatus(instance: ToolInstance): Promise<ToolInstance["status"]>
}
