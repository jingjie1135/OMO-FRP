# 服务器部署

该服务器模板用于部署 OpenCode 远程平台的服务器流程。默认服务器流程只管理 FRP server、公共路由和受保护入口；OpenCode 安装、插件配置和启动必须通过 UI/CLI 显式动作执行：

- OpenCode 可通过 `opencode-remote.service` 管理，但不会在服务器 bootstrap 中默认启动。
- `oh-my-openagent` 会作为 OpenCode 插件安装到同一个 `OPENCODE_CONFIG_DIR`，但这是显式工具动作，不是服务器默认部署步骤。
- Caddy 负责终止 HTTPS，并在代理到 OpenCode 前强制执行 Basic Auth。
- frp-panel 通过 Docker Compose 运行，并为桌面端暴露 API/RPC 地址。

## 文件

- `deploy/server/.env.example`：环境变量和密钥模板。
- `deploy/server/install.sh`：可重复执行的服务器安装流程。
- `deploy/server/opencode-remote.service`：用于 OpenCode 的 systemd 单元。
- `deploy/server/docker-compose.yml`：frp-panel 和 Caddy 服务定义。
- `deploy/server/Caddyfile`：HTTPS、Basic Auth、OpenCode 反向代理和 frp-panel 反向代理配置。
- `deploy/server/healthcheck.sh`：针对 frp-panel、Caddy 和服务器入口的本地健康检查脚本；OpenCode/插件检查由显式工具动作执行。

## 必需密钥

启动服务前需要设置以下密钥：

- `OPENCODE_SERVER_PASSWORD`：OpenCode 服务器认证所需密码。
- `OPENCODE_REMOTE_BASIC_AUTH_PASSWORD_HASH`：通过 `caddy hash-password` 生成的 Caddy 哈希。
- `FRP_PANEL_APP_GLOBAL_SECRET`：frp-panel 全局密钥。

不要在缺少 `OPENCODE_SERVER_PASSWORD` 的情况下公开 OpenCode；当禁用自动生成密码时，平台规划器会阻止不安全的远程方案。

## 最小流程

```bash
sudo install -d -m 0750 /opt/opencode-remote-platform
sudo cp deploy/server/.env.example /opt/opencode-remote-platform/.env
sudo editor /opt/opencode-remote-platform/.env
sudo deploy/server/install.sh
```

开放公网流量前，请先确认防火墙规则：

- 为 Caddy 开放 80/443 端口。
- 除非由反向代理控制访问，否则 OpenCode 和 frp-panel API/RPC 应保持绑定到 localhost。
- 只有桌面端隧道确实需要时，才开放额外的 frp 业务端口。

## CLI 辅助命令

```bash
opencode-remote detect --remote --port 4096
bunx oh-my-openagent install --no-tui --claude=max20 --openai=no --gemini=no --copilot=no --skip-auth
opencode-remote start --remote --port 4096 --public-url https://opencode.example.com
opencode-remote server-deploy-plan --domain opencode.example.com --email admin@example.com
bunx oh-my-openagent doctor --status
```

`server-deploy-plan --json` 会输出路径、地址、必需密钥和自动化可用的命令序列。

## 显式 OpenCode 工具动作

服务器 bootstrap 完成后，如需公开 OpenCode，请按顺序执行：

```bash
opencode-remote detect --remote --port 4096
bunx oh-my-openagent install --no-tui --claude=max20 --openai=no --gemini=no --copilot=no --skip-auth
opencode-remote start --remote --port 4096 --public-url https://opencode.example.com
```

公开 route 启用前必须校验 `OPENCODE_SERVER_PASSWORD`、FRP token、域名 allowlist、TLS/反代状态和 route 唯一性。

## 健康检查

```bash
curl -fsSI http://127.0.0.1:9000 >/dev/null
docker compose --env-file /opt/opencode-remote-platform/.env -f /opt/opencode-remote-platform/docker-compose.yml ps
```

OpenCode 本地端口、`opencode-remote.service` 和 `bunx oh-my-openagent doctor --status` 属于显式 OpenCode 工具动作的检查项，不属于服务器默认部署健康检查。

公网 OpenCode 地址应先要求 Basic Auth，再要求 OpenCode 服务器密码。没有凭据的请求不能进入未认证的工作区。

## 交给桌面端的 frp-panel 信息

只向桌面端操作者提供以下信息，以及一个权限受限的 frp-panel 用户 token：

- `FRP_PANEL_CLIENT_API_URL`
- `FRP_PANEL_CLIENT_RPC_URL`
- 目标本地 OpenCode 端口
- 目标公网路由或端口策略

不要通过日志共享 `FRP_PANEL_APP_GLOBAL_SECRET`、frp 服务器密钥或 OpenCode 服务器密码。
