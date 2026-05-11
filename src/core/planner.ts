import type { CommandSpec } from "./executor"
import type { OperationRun, PublicRoute, ToolInstance } from "./schema"
import type { ValidationIssue } from "./validator"

export interface Plan<TOutput> {
  id: string
  title: string
  targetId: string
  output: TOutput
  commands: CommandSpec[]
  issues: ValidationIssue[]
}

export interface ToolAdapter {
  kind: ToolInstance["kind"]
  detect(): Promise<ToolInstance>
  planConfigure(tool: ToolInstance): Promise<Plan<ToolInstance>>
  start(tool: ToolInstance): Promise<Plan<OperationRun>>
  health(tool: ToolInstance): Promise<ValidationIssue[]>
  expose(tool: ToolInstance, route: PublicRoute): Promise<Plan<PublicRoute>>
}
