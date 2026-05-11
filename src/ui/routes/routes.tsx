import type { LayoutRoute } from "../layout/AppLayout"

export const routes: LayoutRoute[] = [
  { path: "/", label: "Dashboard" },
  { path: "/tools", label: "Tools" },
  { path: "/config", label: "Config" },
  { path: "/endpoints", label: "Endpoints" },
  { path: "/frp", label: "FRP" },
  { path: "/settings", label: "Settings" },
]
