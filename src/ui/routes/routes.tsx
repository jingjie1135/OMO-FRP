import type { LayoutRoute } from "../layout/AppLayout"
import type { RuntimeCapabilities } from "../../core/app-config/types"

const baseRoutes: LayoutRoute[] = [
  { path: "/", label: "Dashboard" },
  { path: "/tools", label: "Tools" },
  { path: "/config", label: "Config" },
  { path: "/endpoints", label: "Endpoints" },
  { path: "/frp", label: "FRP" },
  { path: "/settings", label: "Settings" },
]

export const routes: LayoutRoute[] = baseRoutes

export function getRoutesForCapabilities(capabilities: RuntimeCapabilities): LayoutRoute[] {
  if (!capabilities.canManageCloudflareTunnel) {
    return baseRoutes
  }

  const insertAfterFrp = baseRoutes.findIndex((route) => route.path === "/frp") + 1
  return [
    ...baseRoutes.slice(0, insertAfterFrp),
    { path: "/cloudflare", label: "Cloudflare Tunnel" },
    ...baseRoutes.slice(insertAfterFrp),
  ]
}
