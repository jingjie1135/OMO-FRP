import type { RuntimeMode } from "../../../core/app-config/types"

const SERVER_ACTIONS = ["初始化 frp-panel", "配置 frps/Caddy", "管理 token/secret", "生成桌面端连接配置"] as const
const DESKTOP_ACTIONS = ["填写服务器地址和 token", "选择本机 OpenCode 端口", "生成 frpc 配置", "启动 frpc"] as const

export function getFrpPanelActions(mode: RuntimeMode): string[] {
  return mode === "server" ? [...SERVER_ACTIONS] : [...DESKTOP_ACTIONS]
}
