import type { LayoutRoute } from "../layout/AppLayout"
import type { RuntimeCapabilities } from "../../core/app-config/types"

const baseRoutes: LayoutRoute[] = [
  { path: "/", label: "主控台" },
  { path: "/tools", label: "工具管理" },
  { path: "/endpoints", label: "公网入口" },
  { path: "/config", label: "配置与备份" },
  { path: "/frp", label: "FRP 穿透" },
  { path: "/desktop-tunnels", label: "远程设备" },
  { path: "/settings", label: "系统设置" },
]

export const routes: LayoutRoute[] = baseRoutes

export function getRoutesForCapabilities(capabilities: RuntimeCapabilities): LayoutRoute[] {
  if (!capabilities.canManageCloudflareTunnel) {
    return baseRoutes
  }

  const insertAfterFrp = baseRoutes.findIndex((route) => route.path === "/frp") + 1
  return [
    ...baseRoutes.slice(0, insertAfterFrp),
    { path: "/cloudflare", label: "Cloudflare 隧道" },
    ...baseRoutes.slice(insertAfterFrp),
  ]
}
