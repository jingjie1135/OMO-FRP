# 桌面端自动 FRP 隧道设计方案

## 背景

当前项目已经具备部分基础能力：CLI 侧可以通过 frp-panel 创建或更新 client/proxy，并计算公网访问地址；桌面 runtime 已有启动本地 `frpc` 进程的能力；管理 UI 已有 FRP、Cloudflare、端点和设置相关页面骨架。但这些能力尚未串成“打开桌面端后自动启动 OpenCode、自动建立公网隧道、服务器管理界面显示公网 URL”的完整产品链路。

本方案选择先实现“桌面端主动建隧道，服务器端分配和展示地址”的最小可用路径。它等价于 Ngrok 的产品模型：本地客户端主动连接公网中继，公网 URL 的流量再转回本机服务。第一期不做服务器直接远程启动用户电脑中的 OpenCode，因为那会引入常驻控制通道、远程命令权限、审计和离线处理，复杂度和安全风险都更高。

## 目标

用户打开 Tauri 桌面端后，系统自动完成以下链路：

1. 检测或启动本机 OpenCode Web，监听 `127.0.0.1:4096`。
2. 桌面端向服务器申请 FRP 隧道配置。
3. 服务器调用 frp-panel 创建或更新 client/proxy，并分配公网访问地址。
4. 桌面端写入 `frpc.toml` 并启动 `frpc`。
5. 桌面端定期向服务器上报 OpenCode、frpc、隧道和公网 URL 状态。
6. 服务器管理界面显示设备在线状态、公网 URL、复制和打开入口。

第一期完成后的用户体验应为：打开桌面端后，服务器管理界面出现一台在线设备，显示 `https://<subdomain>.<domain>`，点击后可以访问 OpenCode 登录页。

## 非目标

第一期不实现以下能力：

- 服务器直接启动离线电脑上的 OpenCode。
- 服务器向桌面端下发任意命令。
- 远程唤醒关机或休眠电脑。
- 完整多租户权限模型。
- UI 明文展示 FRP token、client secret、OpenCode password。
- 自动安装所有系统依赖；第一期只做缺失依赖的明确诊断和引导。

## 推荐架构

```text
Tauri 桌面端
  |
  | 1. 携带 device token 请求隧道分配
  v
服务器 Management API
  |
  | 2. 调用 frp-panel 创建或更新 client/proxy
  v
frp-panel / frps
  |
  | 3. 返回 serverAddr/serverPort/proxyName/publicUrl/连接凭据
  v
Tauri 桌面端
  |
  | 4. 写入 frpc.toml
  | 5. 启动 frpc
  | 6. 心跳上报状态
  v
服务器管理界面
  |
  | 7. 展示设备在线状态和公网 URL
  v
浏览器访问公网 OpenCode
```

该架构的关键边界是：桌面端主动连接服务器，服务器不直接控制本机进程。服务器可以保存设备状态、分配地址、展示 URL；桌面端负责实际启动 OpenCode 和 `frpc`。

## 组件设计

### 桌面端自动隧道编排器

新增一个 desktop auto tunnel orchestrator，运行在 Tauri 桌面端启动流程中。它负责把现有能力串起来：

1. 读取本地桌面端配置：服务器地址、device token、设备名、OpenCode 端口、自动连接开关。
2. 检查 OpenCode 是否可执行，OpenCode password 是否已配置，目标端口是否可用。
3. 启动或复用本地 OpenCode Web 进程。
4. 调用服务器 tunnel provisioning API。
5. 生成并保存 `frpc.toml`。
6. 启动或重启 `frpc`。
7. 按固定间隔上报 heartbeat。

编排器应暴露一个清晰状态对象给 Tauri UI：

```ts
interface DesktopTunnelState {
  deviceId: string
  deviceName: string
  opencodeStatus: "unknown" | "starting" | "running" | "stopped" | "error"
  tunnelStatus: "unknown" | "provisioning" | "connected" | "disconnected" | "error"
  frpcStatus: "unknown" | "starting" | "running" | "stopped" | "error"
  publicUrl?: string
  localPort: number
  lastHeartbeatAt?: string
  lastError?: string
}
```

### 服务器 tunnel provisioning API

新增服务器 API：

```http
POST /api/desktop-tunnels/provision
```

请求：

```json
{
  "deviceId": "desktop-alice-laptop",
  "deviceName": "Alice Laptop",
  "localHost": "127.0.0.1",
  "localPort": 4096,
  "proxyName": "opencode-alice-laptop",
  "preferredSubdomain": "alice-code"
}
```

响应：

```json
{
  "deviceId": "desktop-alice-laptop",
  "publicUrl": "https://alice-code.example.com",
  "serverAddr": "frp.example.com",
  "serverPort": 7000,
  "proxyName": "opencode-alice-laptop",
  "subdomain": "alice-code"
}
```

服务器内部复用现有 `ensurePanelProvisioning()` / `createRemoteAccessPlan()` 能力。若现有函数耦合 CLI options，应抽出一个可被 CLI、server API 和 desktop runtime 共同调用的 tunnel provisioning service，而不是复制逻辑。

### 服务器 heartbeat API

新增服务器 API：

```http
POST /api/desktop-tunnels/heartbeat
```

请求：

```json
{
  "deviceId": "desktop-alice-laptop",
  "opencodeStatus": "running",
  "frpcStatus": "running",
  "tunnelStatus": "connected",
  "publicUrl": "https://alice-code.example.com",
  "lastError": null
}
```

服务器保存最后状态和 `lastSeenAt`。管理 UI 根据 `lastSeenAt` 判断在线或离线。第一期可以使用内存或现有轻量状态存储；如果项目已有持久化存储约定，应按现有约定落盘。

### 管理 UI 设备视图

新增或扩展管理 UI 页面，展示远程桌面 OpenCode 设备：

```text
设备名           状态       OpenCode     隧道       公网地址
Alice Laptop    在线       运行中       已连接     https://alice-code.example.com
```

第一期操作按钮：

- 打开 OpenCode。
- 复制 URL。
- 查看诊断。
- 删除设备记录。

第一期不提供“服务器远程启动 OpenCode”按钮。后续若需要远程重连，应通过桌面端主动 polling 或 WebSocket 拉取受限命令实现。

## 数据模型

建议新增共享类型：

```ts
interface DesktopTunnelDevice {
  id: string
  name: string
  status: "online" | "offline" | "error"
  opencodeStatus: "unknown" | "starting" | "running" | "stopped" | "error"
  tunnelStatus: "unknown" | "provisioning" | "connected" | "disconnected" | "error"
  frpcStatus: "unknown" | "starting" | "running" | "stopped" | "error"
  publicUrl?: string
  localPort: number
  proxyName: string
  subdomain?: string
  lastSeenAt?: string
  lastError?: string
}
```

`status` 是服务器派生值：若最近一次 heartbeat 在阈值内且无致命错误，则为 `online`；超过阈值则为 `offline`；最近状态包含不可恢复错误则为 `error`。

## 错误处理

桌面端和服务器 UI 必须区分可行动错误，避免只显示“连接失败”。第一期至少覆盖：

- OpenCode 未安装。
- OpenCode 启动失败。
- `OPENCODE_SERVER_PASSWORD` 未配置。
- 本地端口被占用。
- `frpc` 未安装或不可执行。
- 服务器不可达。
- device token 无效。
- frp-panel token 无效。
- proxy 创建失败。
- proxy 已存在但配置冲突。
- `frpc` 运行中但公网 URL 不可访问。

错误文案应包含下一步建议，例如安装 `frpc`、修改端口、重新登录、检查服务器配置或查看诊断日志。

## 安全设计

第一期必须遵守以下边界：

- OpenCode 只监听 `127.0.0.1`。
- 公网 OpenCode 必须要求 password。
- 桌面端使用 device token 调用服务器 API。
- FRP token、client secret、OpenCode password 不在 UI 明文展示。
- 日志输出脱敏 password、token、authorization header 和连接密钥。
- 服务器第一期只接收桌面端主动请求和心跳，不主动执行桌面命令。
- 删除设备记录不应自动删除用户本地配置，除非桌面端后续主动同步并确认。

## 实施分期

### Phase 1：最小可用自动隧道

目标：桌面端启动后自动建立 OpenCode 公网 URL，服务器管理界面显示设备和 URL。

主要工作：

1. 抽出可复用 tunnel provisioning service。
2. 新增服务器 `POST /api/desktop-tunnels/provision`。
3. 新增服务器 `POST /api/desktop-tunnels/heartbeat`。
4. 新增服务器设备状态查询接口。
5. 桌面端新增 auto tunnel orchestrator。
6. 桌面端生成并保存 `frpc.toml`。
7. 桌面端启动 `frpc` 并上报状态。
8. 管理 UI 展示设备、状态、公网 URL 和诊断。

验收标准：

- 启动桌面端后，服务器管理界面出现设备。
- 设备状态显示在线。
- 公网 URL 可打开 OpenCode 登录页。
- 关闭桌面端后，服务器状态在心跳超时后变为离线。
- token、password、client secret 不出现在 UI 或普通日志中。

### Phase 2：体验增强

目标：提升“一键连接”体验。

主要工作：

- 桌面设置页增加服务器地址、设备名、自动连接开关和当前公网 URL。
- 桌面端增加“重新连接”按钮。
- 服务器 UI 增加复制 URL、诊断详情、删除设备和最近心跳时间。
- 更清晰展示 OpenCode、frpc、隧道三段状态。

### Phase 3：远程请求重连

目标：服务器管理界面可以请求在线桌面端重连，但仍不做服务器直接强控本机。

主要工作：

- 桌面端通过 polling 或 WebSocket 主动连接服务器。
- 服务器记录受限 pending command，例如 `restart_opencode`、`restart_tunnel`、`refresh_status`。
- 桌面端拉取命令后本地执行。
- 所有命令写审计日志。

## 测试与验证

Phase 1 至少需要以下验证：

- provisioning service 单元测试：创建 client/proxy、复用已有配置、处理冲突。
- server API 测试：provision、heartbeat、设备查询、认证失败。
- desktop orchestrator 测试：OpenCode 已运行、OpenCode 未运行、frpc 启动失败、服务器不可达。
- UI 测试：设备在线、离线、错误、复制和打开 URL。
- 类型检查：`bun node_modules/typescript/lib/tsc.js --noEmit`。
- 集成 smoke：用 fake frp-panel 和 mock desktop process 跑完整 provision -> write config -> start -> heartbeat -> UI 展示链路。

手动 QA gate：在本地启动服务器和桌面端模拟流程，确认管理 UI 能看到在线设备和公网 URL；若真实 FRP 环境不可用，至少使用 fake frp-panel + mock process 验证端到端表面行为，并明确记录未覆盖真实公网连通性。

## 方案结论

第一期应实现“桌面端自动建立隧道 + 服务器显示公网 URL”。这是最小、最安全、最接近 Ngrok 的实现路径。服务器远程启动桌面 OpenCode 应作为后续 Phase 3 的受限远程请求能力，而不是 MVP 的前置条件。
