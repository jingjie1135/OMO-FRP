# 管理界面双运行时指南

OpenCode 远程平台的管理界面采用同一套 React 管理界面，同时服务于服务器 Web 和 Tauri 桌面端。UI 不直接读写文件、执行 shell 或管理 systemd，而是通过统一的 `ManagementClient` 调用当前运行时提供的能力。

## 双运行时职责

- **服务器 Web**：运行在服务器上，提供 Web 管理端、管理员登录、FRP 服务端配置、frp-panel/Caddy 路由、服务器本机 OpenCode 的显式检测/安装/启动动作。
- **Tauri 桌面端**：运行在用户本机，检测本地 OpenCode、Bun、oh-my-openagent、frpc、cloudflared，负责本机配置、启动本机 OpenCode Web，以及连接服务器 FRP 服务端。

服务器部署默认不安装 OpenCode，也不会默认启动 OpenCode。OpenCode 的检测、安装、配置和启动必须通过管理界面或 CLI 的显式动作完成，这样可以避免把未配置密码的 OpenCode 暴露到公网。

## UI 复用方式

同一套 React 管理界面包含 Dashboard、Tools、Config、Endpoints、FRP、Settings 等页面。页面通过 `RuntimeCapabilities` 判断当前能力：服务器模式显示服务器 OpenCode 状态、FRP 服务端状态和 endpoint 状态；桌面模式显示本机 OpenCode、frpc、服务器连接和公网访问地址。

大部分页面共享实现，只有 FRP 页面按能力分支：

- **FRP 服务端**：初始化 frp-panel，配置 frps/Caddy，管理 token/secret，查看客户端列表，生成桌面端连接配置。
- **FRP 客户端**：填写服务器地址和 token，选择本机 OpenCode 端口，生成 frpc 配置，启动/停止 frpc，并显示公网 URL。

## 多 endpoint 模型

公网入口统一使用 `PublicEndpoint` 描述。一个服务器可以同时管理多个 endpoint，例如：

1. `server-local`：指向服务器本机 OpenCode。
2. `desktop-frp`：指向桌面端通过 FRP 暴露的本机 OpenCode。
3. `cloudflare`：指向 Cloudflare Tunnel 提供的访问地址。

endpoint 默认保持 disabled。启用前必须检查 OpenCode 密码、Caddy Basic Auth、FRP token、域名 allowlist、TLS/反代状态和目标端口冲突。

## ToolAdapter 扩展

OpenCode 是第一种工具，后续其他 AI 编程工具通过 `ToolAdapter` 扩展。适配器负责检测、配置路径、启动命令、状态和日志，不允许 UI 把用户输入拼成任意 shell 字符串。

`oh-my-openagent` 始终作为 OpenCode 插件配置对象管理，而不是平台本体。配置和 preset 应用前必须通过 `StorageAdapter` 创建备份，日志中的 token、password、secret 和 Authorization header 必须脱敏。

## 当前骨架状态

- `src/core/app-config/` 定义双运行时模型和 capability。
- `src/management-api/` 定义 UI 调用的 `ManagementClient` 合同。
- `src/server/api/` 提供服务器 Web 的最小 HTTP API。
- `src/desktop/` 与 `src-tauri/` 提供桌面运行时骨架。
- `src/ui/` 提供共享 UI 路由和 FRP server/client 分支骨架。
