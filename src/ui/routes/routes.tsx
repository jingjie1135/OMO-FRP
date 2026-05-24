import type { LayoutRoute } from "../layout/AppLayout"

export const routes: LayoutRoute[] = [
  { path: "/", label: "主控台", icon: "▦" },
  { path: "/tools", label: "工具管理", icon: "🔧" },
  { path: "/endpoints", label: "公网入口", icon: "◎" },
  { path: "/config", label: "配置与备份", icon: "⚙" },
  { path: "/frp", label: "FRP 穿透", icon: "◇" },
  { path: "/logs", label: "日志", icon: "▣" },
  { path: "/settings", label: "设置", icon: "⌘" },
  { path: "/cloudflare", label: "Cloudflare 隧道", icon: "☁" },
]
