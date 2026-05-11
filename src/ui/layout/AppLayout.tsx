import type { RuntimeMode } from "../../core/app-config/types"

export interface LayoutRoute {
  path: string
  label: string
}

export function AppLayout(input: { mode: RuntimeMode; routes: LayoutRoute[] }): string {
  return `${input.mode}:${input.routes.map((route) => route.label).join("|")}`
}
