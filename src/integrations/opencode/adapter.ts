import { createCommandSpec } from "../../core/executor"
import type { Plan } from "../../core/planner"
import type { OperationRun, PublicRoute, ToolInstance } from "../../core/schema"

export const OPENCODE_ADAPTER_KIND = "opencode" as const

export function createOpenCodeTool(options: {
  id?: string
  executable?: string
  localUrl?: string
  passwordSecretId?: string
  installState?: ToolInstance["installState"]
} = {}): ToolInstance {
  return {
    id: options.id ?? "opencode-local",
    kind: OPENCODE_ADAPTER_KIND,
    executable: options.executable ?? "opencode",
    localUrl: options.localUrl,
    auth: {
      required: true,
      passwordRef: options.passwordSecretId ? { id: options.passwordSecretId, source: "env", name: "OPENCODE_SERVER_PASSWORD" } : undefined,
    },
    installState: options.installState ?? "unknown",
  }
}

export function planOpenCodeStart(tool: ToolInstance, port: number): Plan<OperationRun> {
  return {
    id: `${tool.id}:start`,
    title: "Start OpenCode locally",
    targetId: tool.id,
    output: { action: "start", targetId: tool.id, status: "planned", redactedLogPath: `logs/${tool.id}-start.log` },
    commands: [createCommandSpec("opencode", tool.executable, ["serve", "--hostname", "127.0.0.1", "--port", String(port)])],
    issues: tool.auth.passwordRef ? [] : [{ code: "tool-password-missing", message: `Tool '${tool.id}' requires OPENCODE_SERVER_PASSWORD before exposure.`, path: `tools.${tool.id}.auth.passwordRef`, severity: "error" }],
  }
}

export function planOpenCodeExpose(tool: ToolInstance, route: PublicRoute): Plan<PublicRoute> {
  return {
    id: `${tool.id}:expose:${route.id}`,
    title: "Expose OpenCode through a public route",
    targetId: route.id,
    output: route,
    commands: [],
    issues: route.authRequired && tool.auth.passwordRef ? [] : [{ code: "route-auth-required", message: `Route '${route.id}' requires route auth and a tool password.`, path: `routes.${route.id}`, severity: "error" }],
  }
}
