# 服务器部署

该服务器模板用于部署 OpenCode 远程平台的服务器流程。默认 Docker 流程会启动 OMO-FRP 管理界面、frp-panel、Caddy 和受密码保护的 OpenCode 工具服务；OpenCode 插件配置和公网 endpoint 仍必须通过 UI/CLI 显式动作执行：

- OMO-FRP 管理界面由 `management-ui` 容器提供，内置 React 静态资源和 `/api/*` Management API。
- OpenCode 工具 Web UI 由 `opencode` 容器提供，并通过 `opencode.<domain>` 暴露在 Basic Auth 后面。
- `oh-my-openagent` 会作为 OpenCode 插件安装到同一个 `OPENCODE_CONFIG_DIR`，但这是显式工具动作，不是服务器默认部署步骤。
- Caddy 负责终止 HTTPS，并在代理到 OpenCode 前强制执行 Basic Auth。
- frp-panel 通过 Docker Compose 运行，并为桌面端暴露 API/RPC 地址。

服务器 Web 管理端会复用同一套 React 管理界面；桌面应用则通过 Tauri 桌面端接入同一套页面。FRP 页面在服务器中显示 FRP 服务端管理，在桌面中显示 FRP 客户端配置。

## 文件

- `deploy/server/.env.example`：环境变量和密钥模板。
- `deploy/server/install.sh`：可重复执行的服务器安装流程。
- `deploy/server/opencode-remote.service`：用于 OpenCode 的 systemd 单元。
- `deploy/server/docker-compose.yml`：management-ui、opencode、frp-panel 和 Caddy 服务定义。
- `deploy/server/docker-compose.control.yml`：可选 Docker socket 覆盖文件，仅在显式允许管理界面控制 OpenCode 容器生命周期时使用。
- `deploy/server/Caddyfile`：HTTPS、Basic Auth、管理界面、OpenCode 和 frp-panel 反向代理配置。
- `deploy/server/healthcheck.sh`：针对 frp-panel、Caddy 和服务器入口的本地健康检查脚本；OpenCode/插件检查由显式工具动作执行。

## 必需密钥

启动服务前需要设置以下密钥：

- `OPENCODE_SERVER_PASSWORD`：OpenCode 服务器认证所需密码。
- `MANAGEMENT_API_SESSION_TOKEN`：管理界面内嵌 API 的 Bearer token。启用 `docker-compose.control.yml` 前必须设置，否则容器生命周期控制请求会被拒绝。
- `OPENCODE_REMOTE_BASIC_AUTH_USER`：建议保持为 `opencode`，与 OpenCode 自身 Basic Auth 用户名一致。
- `OPENCODE_REMOTE_BASIC_AUTH_PASSWORD_HASH`：通过 `caddy hash-password --plaintext "$OPENCODE_SERVER_PASSWORD"` 生成的 Caddy 哈希。这样主入口和 `opencode.<domain>` 可以使用同一组凭据。bcrypt 哈希包含 `$`，写入 `.env` 时需要用单引号包住，例如 `OPENCODE_REMOTE_BASIC_AUTH_PASSWORD_HASH='$2a$14$...'`，否则 Docker Compose 会把 `$...` 当成变量插值。
- `FRP_PANEL_APP_GLOBAL_SECRET`：frp-panel 全局密钥。

还需要确认 `OPENCODE_REMOTE_MANAGEMENT_UI_IMAGE` 和 `OPENCODE_REMOTE_OPENCODE_IMAGE` 指向已构建或已发布的镜像。默认示例使用 GHCR `edge` 镜像；本地验证可改为 `opencode-remote-platform-management-ui:local` 和 `opencode-remote-platform-opencode:local`。

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

## 可选 OpenCode 容器控制

默认部署不会把 Docker socket 挂载到管理界面容器，因此 UI 中的 OpenCode 启动、停止、重启动作会返回明确的禁用提示。只有在你接受管理界面容器可以调用 Docker Engine 的风险后，才启用该能力：

```bash
OPENCODE_CONTAINER_CONTROL_ENABLED=true
MANAGEMENT_API_SESSION_TOKEN=replace-with-long-random-token
docker compose --env-file /opt/opencode-remote-platform/.env \
  -f /opt/opencode-remote-platform/docker-compose.yml \
  -f /opt/opencode-remote-platform/docker-compose.control.yml \
  up -d management-ui
```

启用后，`management-ui` 会把 `MANAGEMENT_API_SESSION_TOKEN` 注入管理页面，并要求所有 Docker 生命周期请求携带该 Bearer token；同时它会通过 Docker socket 查找 `OPENCODE_COMPOSE_PROJECT` / `OPENCODE_COMPOSE_SERVICE` 指定的 OpenCode 服务，并调用 Docker API 执行 start、stop、restart。不要在多租户或不可信管理界面中启用该覆盖文件。

## 健康检查

```bash
curl -fsSI http://127.0.0.1:9000 >/dev/null
docker compose --env-file /opt/opencode-remote-platform/.env -f /opt/opencode-remote-platform/docker-compose.yml ps
```

主域名应返回 OMO-FRP 管理界面，`opencode.<domain>` 应返回 OpenCode 自身 Web UI，`frp.<domain>` 应返回 frp-panel。`bunx oh-my-openagent doctor --status` 属于显式 OpenCode 插件动作的检查项，不属于服务器默认部署健康检查。

公网 OpenCode 地址应先要求 Basic Auth，再要求 OpenCode 服务器密码。没有凭据的请求不能进入未认证的工作区。

## 交给桌面端的 frp-panel 信息

只向桌面端操作者提供以下信息，以及一个权限受限的 frp-panel 用户 token：

- `FRP_PANEL_CLIENT_API_URL`
- `FRP_PANEL_CLIENT_RPC_URL`
- 目标本地 OpenCode 端口
- 目标公网路由或端口策略

在 Docker 服务器模板里，`FRP_PANEL_CLIENT_API_URL` / `FRP_PANEL_CLIENT_RPC_URL` 保留给桌面端操作者和外部客户端使用。容器内部的自连地址应使用单独的 `FRP_PANEL_INTERNAL_CLIENT_API_URL` / `FRP_PANEL_INTERNAL_CLIENT_RPC_URL`（默认 loopback），不要把对外 URL 覆盖成 `127.0.0.1`。

不要通过日志共享 `FRP_PANEL_APP_GLOBAL_SECRET`、frp 服务器密钥或 OpenCode 服务器密码。
