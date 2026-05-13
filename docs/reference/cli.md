# CLI 参考

`opencode-remote` / `opencode-remote-platform` 是 OpenCode 远程平台的命令入口。源码入口是 `src/cli-program.ts`，发布入口是 `bin/opencode-remote.js`。`oh-my-openagent` 不是本项目的 CLI；它只会作为 OpenCode 插件出现在特定安装/配置流程中。

CLI 与管理界面共享 core 模型。服务器 Web 和 Tauri 桌面端会复用同一套 React 管理界面；CLI 继续提供自动化入口，用于生成部署计划、frpc 配置和 Cloudflare Tunnel 引导。

## 命令

| 命令 | 说明 |
| --- | --- |
| `detect` | 检查 OpenCode、Bun、Docker/Compose、插件配置、密码和端口就绪状态 |
| `start` | 输出带密码保护意识的本地 OpenCode 服务器启动命令 |
| `server-deploy-plan` | 输出服务器部署路径、地址、密钥和命令序列 |
| `remote-access` | 生成 frp-panel 路由配置，并可选择启动 OpenCode/frpc |
| `cloudflare-tunnel` | 为本地 OpenCode 生成 Cloudflare Tunnel 配置步骤 |
| `smoke` | 对迁移后的规划器运行本地 smoke 验证 |
| `version` | 显示包版本 |

## 本地入口与验证命令

```bash
bun run cli -- help
bun run smoke
bun run typecheck
bun run build
node bin/opencode-remote.js version
```

这些基础验证命令均由 `package.json` scripts 或 `bin/opencode-remote.js` 覆盖；README 和测试说明不应再把平台 CLI 写成 `oh-my-openagent`。

## detect

```bash
opencode-remote detect --remote --port 4096
opencode-remote detect --json
```

远程模式会在缺少 `OPENCODE_SERVER_PASSWORD` 时给出警告。插件配置检查会在 OpenCode 配置目录中查找 `oh-my-openagent.json` / `oh-my-openagent.jsonc`，因为该插件仍是平台流程中的依赖。

## start

```bash
opencode-remote start --port 4096
OPENCODE_SERVER_PASSWORD=secret opencode-remote start --remote --public-url https://opencode.example.com
```

当自动化流程需要在缺少密码时直接失败，而不是自动生成密码时，请使用 `--no-generate-password`。

## server-deploy-plan

```bash
opencode-remote server-deploy-plan --domain opencode.example.com --email admin@example.com
opencode-remote server-deploy-plan --domain opencode.example.com --email admin@example.com --json
```

该规划会包含 `/opt/opencode-remote-platform` 路径、必需密钥名称、OpenCode 公网地址、frp-panel API/RPC 地址和服务器命令。服务器命令默认只部署 FRP server、公共路由和受保护入口；OpenCode 检测、`oh-my-openagent` 插件安装和 OpenCode 启动会以 `explicitToolActions` 单独输出，必须由 UI/CLI 显式触发。

## remote-access

```bash
opencode-remote remote-access \
  --panel-url https://frp.example.com \
  --auth-token "$FRP_TOKEN" \
  --password 'Use-a-strong-password-123!' \
  --subdomain alice-code \
  --output-config ./frpc.toml
```

选项：

| 选项 | 说明 |
| --- | --- |
| `--panel-url <url>` | frp-panel 公网地址 |
| `--panel-api-url <url>` | 显式覆盖 frp-panel API 地址 |
| `--panel-rpc-url <url>` | 显式覆盖 frp-panel RPC 地址 |
| `--auth-token <token>` | 服务器或面板使用的 frp token |
| `--server-id <id>` | 多 server 场景下显式指定 frp-panel server |
| `--client-id <id>` | 指定或复用 frp-panel client 标识 |
| `--client-secret <secret>` | 预置 frp-panel restricted client secret |
| `--password <password>` | OpenCode Basic Auth 强密码；默认读取 `OPENCODE_SERVER_PASSWORD` |
| `--username <username>` | OpenCode Basic Auth 用户名；默认读取 `OPENCODE_SERVER_USERNAME`，未设置时使用 `opencode` |
| `--proxy-name <name>` | frp 代理名称 |
| `--frp-binary <path>` | frp-panel client 可执行文件路径 |
| `--server-addr <host>` | frp 服务器地址；默认使用面板主机名 |
| `--server-port <port>` | frp 服务器绑定端口；默认值为 `7000` |
| `--transport <protocol>` | 可选 `tcp`、`kcp`、`websocket` 或 `quic` |
| `--local-port <port>` | 本地 OpenCode 服务器端口；默认值为 `4096` |
| `--remote-port <port>` | 基于 TCP/端口的公网路由 |
| `--subdomain <name>` | frp HTTP 公网路由使用的子域名 |
| `--custom-domain <domain>` | frp HTTP 公网路由使用的自定义域名 |
| `--http` | 显示 `http` 公网地址，而不是 `https` |
| `--output-config <path>` | 将生成的 frpc TOML 写入文件 |
| `--frpc-bin <path>` | frpc 二进制路径；默认值为 `frpc` |
| `--no-start` | 不启动 OpenCode，只生成配置和诊断信息 |
| `--no-frpc` | 不启动 frpc 或 frp-panel client，只打印或写入生成的配置 |
| `--json` | 输出结构化 JSON |

frp HTTP 路由请使用 `--subdomain` 或 `--custom-domain`；TCP/端口路由请使用 `--remote-port`。

## cloudflare-tunnel

```bash
OPENCODE_SERVER_PASSWORD=secret opencode-remote cloudflare-tunnel --mode quick --port 4096
opencode-remote cloudflare-tunnel --mode named --hostname opencode.example.com --tunnel-name local-opencode
opencode-remote cloudflare-tunnel --json
```

该命令只会打印本地 OpenCode 和 `cloudflared` 的操作步骤，不会直接启动公网隧道。

## 退出码

命令成功时返回 `0`；校验或诊断失败时返回 `1`。

## 工程质量门禁

本地验证命令与 GitHub Actions CI 保持一致：

```bash
bun install
bun test
bun run typecheck
bun run build
bun run lint
```

`lint` 目前是 `typecheck` 的别名，用作不新增 lint 依赖的最小静态检查门禁。项目尚未建立 formatter 基线，因此暂不在 CI 中强制格式化检查。
