# OpenCode 远程平台

OpenCode 远程平台（OpenCode Remote Platform）是一个独立项目，用于安装、配置、启动 OpenCode，并安全地把 OpenCode 暴露到网络。项目自己的 CLI 名称是 `opencode-remote`；`oh-my-openagent` 只是在流程中可安装、可配置的 OpenCode 插件，不是平台本体。

## 快速开始

### 1. 服务器模式：FRP server + 受保护入口

```bash
cd opencode-remote-platform
bun run src/cli-program.ts server-deploy-plan --domain opencode.example.com --email admin@example.com
sudo cp -r deploy/server /opt/opencode-remote-platform-template
sudo /opt/opencode-remote-platform-template/install.sh
```

服务器默认只管理 FRP server、公共路由和受保护入口，不会隐式安装、配置或启动 OpenCode。OpenCode 和 `oh-my-openagent` 插件必须通过 CLI/UI 中的显式动作执行。

服务器流程如下：

1. 配置 FRP server、Caddy 和受保护入口；
2. 将 `deploy/server/.env.example` 复制为 `/opt/opencode-remote-platform/.env`，并设置 Caddy Basic Auth 与 FRP 密钥；
3. 使用 `deploy/server/docker-compose.yml` 部署 frp-panel 和 Caddy；
4. 需要公开 OpenCode 时，先显式检测 OpenCode 和 `OPENCODE_SERVER_PASSWORD`；
5. 使用 `bunx oh-my-openagent install --no-tui ...` 显式安装并配置 `oh-my-openagent` OpenCode 插件；
6. 通过 `opencode-remote start --remote ...` 显式启动 OpenCode，并输出受保护访问地址。

### 2. 桌面端 + 服务器 frp-panel

```bash
cd opencode-remote-platform
export OPENCODE_SERVER_PASSWORD='Use-a-strong-password-123!'
opencode serve --hostname 127.0.0.1 --port 4096
bun run src/cli-program.ts remote-access \
  --panel-url https://frp.example.com \
  --auth-token "$FRP_TOKEN" \
  --subdomain alice-code \
  --no-start \
  --no-frpc \
  --output-config ./frpc.toml
```

该命令会生成 frpc TOML 配置和类似 `https://alice-code.frp.example.com` 的公网访问地址。如果希望 CLI 同时启动本机 `frpc` 二进制，请移除 `--no-frpc`。

### 3. 本机 OpenCode + Cloudflare Tunnel

```bash
cd opencode-remote-platform
export OPENCODE_SERVER_PASSWORD='Use-a-strong-password-123!'
opencode serve --hostname 127.0.0.1 --port 4096
bun run src/cli-program.ts cloudflare-tunnel --mode quick --port 4096
bun run src/cli-program.ts cloudflare-tunnel --mode named --hostname opencode.example.com --tunnel-name local-opencode
```

快速模式会输出 `cloudflared tunnel --url http://127.0.0.1:4096` 命令，并由 Cloudflare 生成临时访问地址。命名隧道模式会输出登录、创建隧道、配置 DNS 路由和启动隧道的命令。

## CLI

本项目的 CLI 是 `opencode-remote` / `opencode-remote-platform`。

```bash
bun run src/cli-program.ts help
bun run src/cli-program.ts detect --remote --port 4096
bun run src/cli-program.ts start --remote --port 4096 --public-url https://opencode.example.com
bun run src/cli-program.ts server-deploy-plan --domain opencode.example.com --email admin@example.com
bun run src/cli-program.ts remote-access --panel-url https://frp.example.com --auth-token token --password 'Use-a-strong-password-123!' --subdomain alice-code --no-start --no-frpc
bun run src/cli-program.ts cloudflare-tunnel --password 'Use-a-strong-password-123!' --json
```

## 目录结构

```text
opencode-remote-platform/
  README.md
  package.json
  bin/opencode-remote.js
  src/cli-program.ts
  src/cli/install-config.ts
  src/cli/install-config-types.ts
  src/cli/remote-access/
  src/core/
  src/integrations/
  src/server-app/
  src/desktop-app/
  deploy/server/
  docs/guide/server-deployment.md
  docs/reference/cli.md
```

## 共享核心架构

项目边界冻结为“共享核心 + 两个薄外壳”：

- `src/core/`：`AppConfig`、`ToolInstance`、`PluginInstance`、`PublicRoute`、`OperationRun`、FRP profile、校验器、日志脱敏和受控命令执行接口。
- `src/integrations/*`：OpenCode、oh-my-openagent、FRP、Cloudflare 适配器；适配器只产出 plan 和参数数组，不接收任意 shell 字符串。
- `src/server-app/`：未来 Web/API/auth/audit 边界；只负责交互和状态展示。
- `src/desktop-app/`：未来 Tauri UI、本地检测、FRP client 和健康状态展示边界。

公开 endpoint 统一从 `routes[]` 派生，并通过 FRP/Cloudflare 适配器生成配置，避免每个工具重复实现暴露逻辑。配置只保存 `SecretRef`，真实密码和 token 应放在环境、权限受限文件或系统密钥库中。

## 迁移的实现

本项目从 `fe4d06af/workdir/oh-my-openagent` 迁移了真实实现：

- `src/cli/install-config.ts`, `src/cli/install-config-types.ts`, `src/cli/install-config.test.ts`
- `src/cli/remote-access/`，包括密码校验、选项归一化、frpc 配置生成、公网地址构造、诊断、进程启动器和测试
- `src/cli/cloudflare-tunnel/`，包括依赖检查、快速/命名隧道规划、输出格式化和测试
- `deploy/server/`，包括服务器 `.env`、Caddy、Docker Compose、systemd、安装器和健康检查模板，并已按本平台重命名
- `docs/reference/cli.md` 和 `docs/guide/server-deployment.md`，已改写为 `opencode-remote` 的文档

未迁移的内容包括完整的 oh-my-openagent 插件安装器、doctor、模型编排、OAuth 和 run-completion 系统。这些仍属于插件项目职责；平台在需要时通过 `bunx oh-my-openagent install/doctor` 调用它们。

## 验证

```bash
bun test src/core/core.test.ts src/cli/install-config.test.ts src/cli/remote-access/remote-access.test.ts src/cli/cloudflare-tunnel/plan.test.ts
bun run src/cli-program.ts smoke
```

这些测试覆盖迁移后的安装/服务器部署规划器、frp 远程访问规划器和 Cloudflare Tunnel 规划器。
