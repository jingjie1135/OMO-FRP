import type { RuntimeInfo } from "../../../management-api/types"

export function DashboardPage(info: RuntimeInfo): string {
  return `dashboard:${info.capabilities.mode}`
}
