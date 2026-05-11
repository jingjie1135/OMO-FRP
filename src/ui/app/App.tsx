import type { RuntimeInfo } from "../../management-api/types"
import { AppLayout } from "../layout/AppLayout"
import { routes } from "../routes/routes"

export function App(runtimeInfo: RuntimeInfo): string {
  return AppLayout({ mode: runtimeInfo.capabilities.mode, routes })
}
