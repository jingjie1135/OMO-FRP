# OpenCode 远程平台

OpenCode 远程平台（OpenCode Remote Platform）是一个独立项目，用于安装、配置、启动 OpenCode，并安全地把 OpenCode 暴露到网络。项目包名是 `opencode-remote-platform`，平台 CLI 名称是 `opencode-remote` / `opencode-remote-platform`；`oh-my-openagent` 只是在流程中可安装、可配置的 OpenCode 插件，不是平台本体。

## 快速开始

### 1. 服务器模式：FRP server + 受保护入口

```bash
cd opencode-remote-platform
bun run cli -- server-deploy-plan --domain opencode.example.com --email admin@example.com
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
bun run cli -- remote-access \
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
bun run cli -- cloudflare-tunnel --mode quick --port 4096
bun run cli -- cloudflare-tunnel --mode named --hostname opencode.example.com --tunnel-name local-opencode
```

快速模式会输出 `cloudflared tunnel --url http://127.0.0.1:4096` 命令，并由 Cloudflare 生成临时访问地址。命名隧道模式会输出登录、创建隧道、配置 DNS 路由和启动隧道的命令。

## CLI

本项目的 CLI 是 `opencode-remote` / `opencode-remote-platform`。源码入口是 `src/cli-program.ts`，发布入口是 `bin/opencode-remote.js`，不要使用历史文档中的 `src/cli/` 旧入口。

```bash
bun run cli -- help
node bin/opencode-remote.js version
opencode-remote detect --remote --port 4096
opencode-remote start --remote --port 4096 --public-url https://opencode.example.com
opencode-remote server-deploy-plan --domain opencode.example.com --email admin@example.com
opencode-remote remote-access --panel-url https://frp.example.com --auth-token token --password 'Use-a-strong-password-123!' --subdomain alice-code --no-start --no-frpc
opencode-remote cloudflare-tunnel --password 'Use-a-strong-password-123!' --json
```

## CLI 命令清单

| 命令 | 用途 |
| --- | --- |
| `opencode-remote detect` | 检查 OpenCode、Bun、Docker/Compose、插件配置、密码和端口就绪状态 |
| `opencode-remote start` | 输出带密码保护意识的本地 OpenCode serve 命令 |
| `opencode-remote server-deploy-plan` | 输出服务器部署路径、地址、密钥和命令序列 |
| `opencode-remote remote-access` | 生成 frp-panel 路由配置，并可选择启动 OpenCode/frpc |
| `opencode-remote cloudflare-tunnel` | 为本地 OpenCode 生成 Cloudflare Tunnel 配置步骤 |
| `opencode-remote smoke` | 运行本地 smoke 验证 |
| `opencode-remote version` | 显示当前平台 CLI 版本 |

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

## 管理界面双运行时

项目正在扩展为“同一套 React 管理界面 + 两个薄运行时外壳”：服务器 Web 通过 HTTP ManagementClient 调用服务器 API，Tauri 桌面端通过 invoke bridge 调用本机能力。服务器侧提供 FRP 服务端、Caddy、公共 endpoint 和显式 OpenCode 操作；桌面侧提供 FRP 客户端、本机 OpenCode 检测和本机配置管理。

服务器 Docker 部署默认启动管理界面、frp-panel、Caddy 和受密码保护的 OpenCode 工具服务。主域名进入 OMO-FRP 管理界面；`opencode.<domain>` 指向 OpenCode 自身 Web UI。OpenCode、`oh-my-openagent` 插件和公网 endpoint 仍必须通过 UI/CLI 中的显式动作启用。完整说明见 `docs/guide/management-ui.md`。

服务器部署建议使用同一组 `opencode` / `OPENCODE_SERVER_PASSWORD` 凭据保护主管理界面和 OpenCode 子域名；Caddy 的 Basic Auth hash 应由 `OPENCODE_SERVER_PASSWORD` 生成，并在 `.env` 中用单引号包住。

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

本地和 CI 使用同一组基础质量门禁命令：

```bash
bun install
bun test
bun run typecheck
bun run build
bun run build:ui
bun run build:server
bun run lint
bun run smoke
(cd src-tauri && cargo check)
docker build --target management-ui -f deploy/server/Dockerfile .
docker build --target opencode -f deploy/server/Dockerfile .
node bin/opencode-remote.js version
```

这些测试覆盖迁移后的安装/服务器部署规划器、frp 远程访问规划器、Cloudflare Tunnel 规划器、共享 React 管理界面和质量门禁文档一致性。管理界面的最终整体验收入口是 `src/ui/app/management-ui-acceptance.test.tsx`，它覆盖后端不可达错误态、server/desktop 能力驱动导航、Cloudflare Tunnel capability gating、前端权限边界和发布检查清单。当前项目尚未引入专用 formatter 或 ESLint/Biome 配置，因此 `lint` 暂作为依赖零新增的 TypeScript 静态检查别名；后续如建立格式化基线，可再新增 `format:check` 并接入 CI。

## CI/CD 产物

项目的 CI/CD 产物分为 Docker 部署镜像和 Tauri 桌面端产物：

- Docker：`.github/workflows/docker-release.yml` 从 `deploy/server/Dockerfile` 构建并发布两个 GHCR 镜像。
- Docker 管理界面镜像使用 `management-ui` target，内置 `dist/ui` 和 `/api/*` Management API 入口。OpenCode 工具服务使用同一 Dockerfile 的 `opencode` target。
- Tauri：`.github/workflows/tauri-release.yml` 在手动触发或 `v*` tag 上构建 Windows、macOS 和 Linux 桌面端产物。

第一版 Tauri 产物是 unsigned workflow artifacts，不包含 Windows 代码签名、macOS 签名或 notarization。正式签名、校验和、Tauri updater metadata 和 GitHub Release 聚合会在后续阶段单独加入。
