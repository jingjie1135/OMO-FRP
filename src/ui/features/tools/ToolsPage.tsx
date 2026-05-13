import type { ToolDetection, ToolInstance } from "../../../management-api/types"

export interface ToolsPageState {
  tools: ToolInstance[]
  detections: ToolDetection[]
  lastAction?: string
  error?: string
}

export function ToolsPage(state: ToolsPageState): string {
  if (state.error) {
    return `tools:error:${state.error}`
  }

  if (state.tools.length === 0 && state.detections.length === 0) {
    return "tools:empty:no-tools-detected"
  }

  const detectionSummary = state.detections.map((tool) => `${tool.displayName}=${tool.detected ? "detected" : "missing"}`).join("|")
  const toolSummary = state.tools.map((tool) => `${tool.displayName}:${tool.installState}:${tool.status}`).join("|")
  return [
    `tools:${state.tools.length}`,
    `detections:${detectionSummary || "none"}`,
    `instances:${toolSummary || "none"}`,
    `lastAction:${state.lastAction ?? "idle"}`,
  ].join("\n")
}
