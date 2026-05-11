import type { ToolCommand, ToolAdapter } from "../tools/tool-adapter"
import type { ToolDetection, ToolInstance } from "../../management-api/types"

export interface OpenCodeStartCommandOptions {
  executable?: string
  hostname?: string
  port: number
}

export function buildOpenCodeStartCommand(options: OpenCodeStartCommandOptions): ToolCommand {
  return {
    command: [options.executable ?? "opencode", "serve", "--hostname", options.hostname ?? "127.0.0.1", "--port", String(options.port)],
  }
}

export class OpenCodeAdapter implements ToolAdapter {
  readonly kind = "opencode" as const

  async detect(): Promise<ToolDetection> {
    return {
      kind: this.kind,
      displayName: "OpenCode",
      detected: false,
    }
  }

  getConfigPath(instance: ToolInstance): string | null {
    return instance.configDirectory ? `${instance.configDirectory}/opencode.json` : null
  }

  buildStartCommand(instance: ToolInstance): ToolCommand {
    return buildOpenCodeStartCommand({ executable: instance.binaryPath, port: instance.currentPort ?? instance.defaultPort })
  }

  async getStatus(instance: ToolInstance): Promise<ToolInstance["status"]> {
    return instance.status
  }
}
