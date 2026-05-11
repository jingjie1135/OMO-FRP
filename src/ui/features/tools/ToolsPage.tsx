import type { ToolInstance } from "../../../management-api/types"

export function ToolsPage(tools: ToolInstance[]): string {
  return `tools:${tools.length}`
}
