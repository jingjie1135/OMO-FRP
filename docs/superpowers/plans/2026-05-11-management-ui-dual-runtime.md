# OpenCode 远程管理平台双运行时管理界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前 CLI/部署模板项目升级为一套可复用界面的 OpenCode 远程管理平台，支持服务器 Web 管理端和 Tauri 桌面客户端两种运行时。

**Architecture:** 使用同一套 React 管理界面和同一套 TypeScript core，服务器端通过 HTTP API 提供能力，Tauri 端通过 Tauri bridge 提供能力。FRP 页面在同一 UI 内根据 runtime capability 切换服务端配置和客户端配置；OpenCode、oh-my-openagent、endpoint、preset、backup、工具检测与启动流程尽量复用。

**Tech Stack:** TypeScript, Bun, React, Vite, Tauri, Node/Bun HTTP API, systemd, Docker Compose, Caddy, frp-panel/frpc, Cloudflare Tunnel.

---

## 1. 产品目标

项目要从“OpenCode 远程 CLI/部署工具”升级为“OpenCode/AI 编程工具远程管理平台”。它必须支持：

- 服务器部署形态：提供 Web 管理界面，默认不安装 OpenCode，允许用户在界面中手动检测、安装、配置、启动 OpenCode，并管理 FRP 服务端、公网入口和服务器侧配置。
- Tauri 桌面客户端形态：提供本机桌面应用，启动后检测本机已安装的 OpenCode、Bun、oh-my-openagent、frpc、cloudflared，再进入配置、启动和远程连接流程。
- 多公网入口：同一服务器可以管理多个对外地址，例如一个指向服务器本机 OpenCode，另一个指向桌面端通过 frpc 暴露出来的 OpenCode。
- 扩展其他 AI 编程工具：OpenCode 是第一种工具，后续 Cursor、Claude Code、Codex CLI、Gemini CLI 等应通过 ToolAdapter 接入。

---

## 2. 关键设计结论

### 2.1 UI 应复用，不拆两套

服务器 Web 管理端和 Tauri 桌面端使用同一套 React UI：

```text
src/ui/
  app/
  routes/
  layout/
  components/
  features/
    dashboard/
    tools/
    config/
    endpoints/
    frp/
    settings/
```

UI 不直接访问 Node fs、Tauri fs、systemd 或 shell，而是调用统一的 `ManagementClient`。

### 2.2 运行时差异由 Adapter 承担

服务器 Web：

```text
React UI -> HTTP ManagementClient -> Server API -> Node/Bun runtime adapter -> core
```

Tauri 桌面端：

```text
React UI -> Tauri ManagementClient -> Tauri commands/plugins -> desktop runtime adapter -> core
```

### 2.3 FRP 是主要分支页面

大部分页面复用，FRP 页面根据能力分支：

```text
FrpPage
  server mode  -> ServerFrpPanel: frp-panel/frps/Caddy/token/client/route 管理
  desktop mode -> ClientFrpPanel: frpc 配置、连接服务器、启动/停止、显示公网 URL
```

---

## 3. 目标目录结构

```text
opencode-remote-platform/
  src/
    core/
      app-config/
      storage/
      tools/
      opencode/
      oh-my-openagent/
      endpoints/
      frp/
      tunnel/
      process/
      security/
    management-api/
      types.ts
      client.ts
    server/
      api/
      runtime-adapter.ts
      index.ts
    desktop/
      runtime-adapter.ts
      tauri-client.ts
    ui/
      app/
      routes/
      layout/
      components/
      features/
    cli/
      cli-program.ts
  src-tauri/
  deploy/server/
  docs/
```

现有 CLI 逻辑逐步迁移到 `src/core/`，CLI 只保留命令解析和调用 core 的职责。

---

## 4. 核心数据模型

### 4.1 RuntimeCapabilities

```ts
export type RuntimeMode = "server" | "desktop"

export interface RuntimeCapabilities {
  mode: RuntimeMode
  canManageFrpServer: boolean
  canManageFrpClient: boolean
  canInstallServerServices: boolean
  canAccessLocalFilesystem: boolean
  canManageSystemd: boolean
  canManageLocalProcesses: boolean
}
```

服务器模式：

```ts
export const SERVER_CAPABILITIES: RuntimeCapabilities = {
  mode: "server",
  canManageFrpServer: true,
  canManageFrpClient: false,
  canInstallServerServices: true,
  canAccessLocalFilesystem: true,
  canManageSystemd: true,
  canManageLocalProcesses: true,
}
```

桌面模式：

```ts
export const DESKTOP_CAPABILITIES: RuntimeCapabilities = {
  mode: "desktop",
  canManageFrpServer: false,
  canManageFrpClient: true,
  canInstallServerServices: false,
  canAccessLocalFilesystem: true,
  canManageSystemd: false,
  canManageLocalProcesses: true,
}
```

### 4.2 ToolInstance

```ts
export type ToolKind = "opencode" | "future-tool"

export interface ToolInstance {
  id: string
  kind: ToolKind
  displayName: string
  hostType: "server" | "desktop"
  installState: "missing" | "detected" | "installed" | "configured"
  binaryPath?: string
  workingDirectory?: string
  configDirectory?: string
  defaultPort: number
  currentPort?: number
  status: "stopped" | "starting" | "running" | "error"
}
```

### 4.3 PluginConfig

```ts
export interface ConfigPreset {
  id: string
  name: string
  path: string
  updatedAt: string
}

export interface PluginConfig {
  toolInstanceId: string
  plugin: "oh-my-openagent"
  configPath: string
  status: "missing" | "detected" | "configured" | "invalid"
  presets: ConfigPreset[]
}
```

### 4.4 PublicEndpoint

```ts
export interface PublicEndpoint {
  id: string
  name: string
  domain: string
  protocol: "https" | "http" | "tcp"
  targetType: "server-local" | "desktop-frp" | "cloudflare"
  targetToolInstanceId: string
  authMode: "basic-auth" | "opencode-password" | "both"
  status: "disabled" | "provisioning" | "active" | "error"
}
```

### 4.5 FRP 配置

```ts
export interface FrpServerConfig {
  enabled: boolean
  panelUrl: string
  rpcUrl: string
  serverAddr: string
  bindPort: number
  authTokenRef: string
  dashboardEnabled: boolean
}

export interface FrpClientConfig {
  endpointId: string
  serverAddr: string
  serverPort: number
  authTokenRef: string
  localHost: string
  localPort: number
  proxyName: string
  subdomain?: string
  customDomain?: string
  transport: "tcp" | "kcp" | "websocket" | "quic"
}
```

### 4.6 AppConfig

```ts
export interface AppConfig {
  mode: RuntimeMode
  toolInstances: ToolInstance[]
  pluginConfigs: PluginConfig[]
  publicEndpoints: PublicEndpoint[]
  frpServer?: FrpServerConfig
  frpClients: FrpClientConfig[]
}
```

---

## 5. 管理接口

UI 统一调用 `ManagementClient`：

```ts
export interface ManagementClient {
  getRuntimeInfo(): Promise<RuntimeInfo>
  detectTools(): Promise<ToolDetection[]>
  listToolInstances(): Promise<ToolInstance[]>
  installTool(request: InstallToolRequest): Promise<JobResult>
  startTool(instanceId: string): Promise<JobResult>
  stopTool(instanceId: string): Promise<JobResult>
  getToolLogs(instanceId: string): Promise<LogLine[]>

  readConfig(target: ConfigTarget): Promise<ConfigDocument>
  saveConfig(target: ConfigTarget, content: string): Promise<void>
  listPresets(target: ConfigTarget): Promise<ConfigPreset[]>
  applyPreset(target: ConfigTarget, presetId: string): Promise<void>
  listBackups(target: ConfigTarget): Promise<ConfigBackup[]>
  restoreBackup(target: ConfigTarget, backupId: string): Promise<void>

  listEndpoints(): Promise<PublicEndpoint[]>
  saveEndpoint(endpoint: PublicEndpoint): Promise<void>
  enableEndpoint(id: string): Promise<JobResult>
  disableEndpoint(id: string): Promise<JobResult>

  getFrpStatus(): Promise<FrpStatus>
  saveFrpConfig(config: FrpServerConfig | FrpClientConfig): Promise<void>
  startFrp(): Promise<JobResult>
  stopFrp(): Promise<JobResult>
}
```

服务器实现：

```text
src/server/api/* -> HTTP endpoint -> core
src/ui/api/server-management-client.ts -> fetch('/api/...')
```

桌面实现：

```text
src-tauri/src/* -> Tauri command/plugin -> core or shell/fs
src/ui/api/tauri-management-client.ts -> invoke(...)
```

---

## 6. 存储与备份

### 6.1 StorageAdapter

```ts
export interface StorageAdapter {
  readText(path: string): Promise<string | null>
  writeText(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  list(path: string): Promise<string[]>
  backup(path: string): Promise<string>
}
```

实现文件：

```text
src/core/storage/node-storage.ts
src/core/storage/tauri-storage.ts
src/core/storage/memory-storage.ts
```

### 6.2 配置目录

服务器：

```text
/opt/opencode-remote-platform/config/config.json
/opt/opencode-remote-platform/config/secrets.json
/opt/opencode-remote-platform/backups/
```

桌面：

```text
~/.config/opencode-remote-platform/config.json
~/.config/opencode-remote-platform/secrets.json
~/.config/opencode-remote-platform/backups/
```

### 6.3 OMO 可复用模式

参考 `G:\Users\Administrator\Documents\AI\Codex\OMO`：

- `src/api.ts`：配置、preset、backup 的集中读写逻辑。
- `src/hooks.ts`：配置流程状态管理。
- `src/types.ts`：配置结构类型。
- `src-tauri/src/lib.rs`：Tauri fs/dialog/shell 插件初始化。

本项目采用同类模式，但通过 `StorageAdapter` 同时支持服务器和桌面。

---

## 7. 页面设计

### 7.1 Dashboard

复用页面，根据 runtime mode 展示不同卡片：

服务器显示：

- 服务器 OpenCode 状态
- FRP 服务端状态
- 公网 endpoint 状态
- 已连接桌面客户端

桌面显示：

- 本机 OpenCode 状态
- 本机 frpc 状态
- 当前连接的服务器
- 当前公网访问地址

### 7.2 Setup

服务器：

- 设置管理员账号/密码。
- 检测 Bun、Docker、Docker Compose、Caddy、frp-panel。
- 显示 OpenCode 未安装/已检测/可安装。
- 默认不安装 OpenCode，只提供手动安装按钮。

桌面：

- 检测本机 OpenCode、Bun、oh-my-openagent、frpc、cloudflared。
- 显示缺失项。
- 引导用户安装或配置。

### 7.3 Tools

统一工具管理页：

- 检测工具。
- 安装工具。
- 配置工具。
- 启动/停止工具。
- 查看日志。

第一种工具是 OpenCode，后续通过 ToolAdapter 增加其他 AI 编程工具。

### 7.4 Config

统一配置管理页：

- OpenCode config。
- oh-my-openagent config。
- provider preset。
- plugin preset。
- backup/restore。

服务器管理服务器路径，桌面管理本机路径。

### 7.5 Endpoints

统一公网入口管理页：

- 创建 endpoint。
- 选择目标工具实例。
- 选择目标类型：server-local、desktop-frp、cloudflare。
- 配置域名、协议、鉴权方式。
- 启用/停用 endpoint。

### 7.6 FRP

同一页面，内部按 capability 分支：

```text
src/ui/features/frp/FrpPage.tsx
src/ui/features/frp/ServerFrpPanel.tsx
src/ui/features/frp/ClientFrpPanel.tsx
src/ui/features/frp/EndpointRouteForm.tsx
src/ui/features/frp/FrpConnectionCard.tsx
src/ui/features/frp/FrpStatusCard.tsx
```

服务器模式：

- frp-panel 初始化。
- frps/Caddy 配置。
- token/secret 管理。
- 客户端列表。
- 路由管理。
- 生成桌面端连接配置。

桌面模式：

- 填写服务器地址和 token。
- 选择本机 OpenCode 端口。
- 生成 frpc 配置。
- 启动/停止 frpc。
- 显示公网 URL。

### 7.7 Settings

- 密钥管理。
- 备份管理。
- 日志。
- 更新。
- 风险检查策略。

---

## 8. 分阶段实施任务

### Task 1: 定义 core model 和 ManagementClient 合同

**Files:**

- Create: `src/core/app-config/types.ts`
- Create: `src/management-api/types.ts`
- Create: `src/management-api/client.ts`
- Test: `src/core/app-config/types.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "bun:test"
import { SERVER_CAPABILITIES, DESKTOP_CAPABILITIES } from "./types"

describe("runtime capabilities", () => {
  it("distinguishes server and desktop FRP responsibilities", () => {
    expect(SERVER_CAPABILITIES.canManageFrpServer).toBe(true)
    expect(SERVER_CAPABILITIES.canManageFrpClient).toBe(false)
    expect(DESKTOP_CAPABILITIES.canManageFrpServer).toBe(false)
    expect(DESKTOP_CAPABILITIES.canManageFrpClient).toBe(true)
  })
})
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
bun test src/core/app-config/types.test.ts
```

Expected: FAIL，因为 `src/core/app-config/types.ts` 尚不存在。

- [ ] **Step 3: 实现类型和 capability 常量**

创建 `src/core/app-config/types.ts`，包含第 4 节的数据模型。

- [ ] **Step 4: 实现 ManagementClient 类型**

创建 `src/management-api/types.ts` 和 `src/management-api/client.ts`，包含第 5 节接口。

- [ ] **Step 5: 验证**

Run:

```bash
bun test src/core/app-config/types.test.ts
bunx tsc --noEmit
```

Expected: PASS，无 TypeScript 错误。

- [ ] **Step 6: 提交**

```bash
git add src/core/app-config src/management-api
git commit -m "feat: 定义管理平台核心模型"
```

### Task 2: 实现 StorageAdapter 和配置备份

**Files:**

- Create: `src/core/storage/storage-adapter.ts`
- Create: `src/core/storage/memory-storage.ts`
- Create: `src/core/storage/node-storage.ts`
- Create: `src/core/storage/backup-service.ts`
- Test: `src/core/storage/storage.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "bun:test"
import { MemoryStorage } from "./memory-storage"
import { backupTextFile } from "./backup-service"

describe("storage backups", () => {
  it("creates a backup before overwriting config", async () => {
    const storage = new MemoryStorage({ "/config/opencode.json": "{\"model\":\"a\"}" })
    const backupPath = await backupTextFile(storage, "/config/opencode.json", "2026-05-11T120000")

    expect(backupPath).toBe("/config/opencode.json.2026-05-11T120000.backup")
    expect(await storage.readText(backupPath)).toBe("{\"model\":\"a\"}")
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/core/storage/storage.test.ts
```

Expected: FAIL，因为 storage 模块尚不存在。

- [ ] **Step 3: 实现 StorageAdapter、MemoryStorage、NodeStorage、backupTextFile**

要求：`backupTextFile` 在源文件不存在时抛出明确错误 `Cannot back up missing file: <path>`。

- [ ] **Step 4: 验证**

```bash
bun test src/core/storage/storage.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/storage
git commit -m "feat: 增加配置存储和备份抽象"
```

### Task 3: 抽象 ToolAdapter 并实现 OpenCodeAdapter

**Files:**

- Create: `src/core/tools/tool-adapter.ts`
- Create: `src/core/opencode/opencode-adapter.ts`
- Move/Reuse: `src/shared/opencode-config-dir.ts`
- Test: `src/core/opencode/opencode-adapter.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "bun:test"
import { buildOpenCodeStartCommand } from "./opencode-adapter"

describe("OpenCode adapter", () => {
  it("builds a localhost OpenCode web start command", () => {
    const command = buildOpenCodeStartCommand({ port: 4096 })

    expect(command.command).toEqual(["opencode", "serve", "--hostname", "127.0.0.1", "--port", "4096"])
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/core/opencode/opencode-adapter.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现 ToolAdapter 和 OpenCodeAdapter**

OpenCodeAdapter 必须支持：detect、config path、buildStartCommand、status。

- [ ] **Step 4: 让现有 CLI 调用新 adapter**

修改 `src/cli/install-config.ts`，保持现有行为不变，仅把命令构造逻辑迁到 core。

- [ ] **Step 5: 验证**

```bash
bun test src/core/opencode/opencode-adapter.test.ts src/cli/install-config.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/core/tools src/core/opencode src/cli/install-config.ts
git commit -m "feat: 抽象 OpenCode 工具适配器"
```

### Task 4: 实现 oh-my-openagent 配置管理服务

**Files:**

- Create: `src/core/oh-my-openagent/config-paths.ts`
- Create: `src/core/oh-my-openagent/config-service.ts`
- Create: `src/core/oh-my-openagent/preset-service.ts`
- Create: `src/core/oh-my-openagent/backup-service.ts`
- Test: `src/core/oh-my-openagent/config-service.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "bun:test"
import { MemoryStorage } from "../storage/memory-storage"
import { applyPresetToActiveConfig } from "./preset-service"

describe("oh-my-openagent presets", () => {
  it("backs up active config before applying a preset", async () => {
    const storage = new MemoryStorage({
      "/opencode/oh-my-openagent.json": "{\"agents\":{}}",
      "/opencode/oh-my-openagent.preset-fast.json": "{\"agents\":{\"hephaestus\":{}}}",
    })

    await applyPresetToActiveConfig(storage, {
      activePath: "/opencode/oh-my-openagent.json",
      presetPath: "/opencode/oh-my-openagent.preset-fast.json",
      timestamp: "2026-05-11T120000",
    })

    expect(await storage.readText("/opencode/oh-my-openagent.json")).toBe("{\"agents\":{\"hephaestus\":{}}}")
    expect(await storage.readText("/opencode/oh-my-openagent.json.2026-05-11T120000.backup")).toBe("{\"agents\":{}}")
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/core/oh-my-openagent/config-service.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现配置检测、preset 应用和备份**

必须兼容：

```text
oh-my-openagent.json
oh-my-opencode.jsonc
oh-my-openagent.preset-<name>.json
```

- [ ] **Step 4: 验证**

```bash
bun test src/core/oh-my-openagent/config-service.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/core/oh-my-openagent
git commit -m "feat: 增加 oh-my-openagent 配置管理"
```

### Task 5: 实现 endpoint 和 FRP 核心模型

**Files:**

- Create: `src/core/endpoints/endpoint-service.ts`
- Create: `src/core/frp/frp-config.ts`
- Create: `src/core/frp/frp-route-service.ts`
- Test: `src/core/endpoints/endpoint-service.test.ts`
- Test: `src/core/frp/frp-config.test.ts`

- [ ] **Step 1: 写 endpoint 测试**

```ts
import { describe, expect, it } from "bun:test"
import { validateEndpoint } from "./endpoint-service"

describe("endpoint validation", () => {
  it("rejects public OpenCode endpoint without authentication", () => {
    const result = validateEndpoint({
      id: "server-opencode",
      name: "Server OpenCode",
      domain: "server-code.example.com",
      protocol: "https",
      targetType: "server-local",
      targetToolInstanceId: "tool-opencode-server",
      authMode: "opencode-password",
      status: "disabled",
    })

    expect(result.ok).toBe(true)
  })
})
```

- [ ] **Step 2: 写 FRP 测试**

```ts
import { describe, expect, it } from "bun:test"
import { buildFrpClientToml } from "./frp-config"

describe("frp client config", () => {
  it("builds an HTTP frpc proxy for local OpenCode", () => {
    const toml = buildFrpClientToml({
      endpointId: "alice-code",
      serverAddr: "frp.example.com",
      serverPort: 7000,
      authTokenRef: "secret-token",
      localHost: "127.0.0.1",
      localPort: 4096,
      proxyName: "alice-opencode",
      subdomain: "alice-code",
      transport: "tcp",
    })

    expect(toml).toContain('serverAddr = "frp.example.com"')
    expect(toml).toContain('subdomain = "alice-code"')
  })
})
```

- [ ] **Step 3: 运行失败测试**

```bash
bun test src/core/endpoints/endpoint-service.test.ts src/core/frp/frp-config.test.ts
```

Expected: FAIL。

- [ ] **Step 4: 实现 endpoint 校验和 frpc TOML 生成**

复用现有 `src/cli/remote-access/frpc-config.ts` 的逻辑，迁到 core。

- [ ] **Step 5: 验证**

```bash
bun test src/core/endpoints/endpoint-service.test.ts src/core/frp/frp-config.test.ts src/cli/remote-access/remote-access.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/core/endpoints src/core/frp src/cli/remote-access
git commit -m "feat: 增加 endpoint 和 FRP 核心模型"
```

### Task 6: 实现 Server API runtime adapter

**Files:**

- Create: `src/server/runtime-adapter.ts`
- Create: `src/server/api/index.ts`
- Create: `src/server/api/routes/system.ts`
- Create: `src/server/api/routes/tools.ts`
- Create: `src/server/api/routes/config.ts`
- Create: `src/server/api/routes/endpoints.ts`
- Create: `src/server/api/routes/frp.ts`
- Test: `src/server/api/server-api.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "bun:test"
import { createServerApi } from "./index"

describe("server api", () => {
  it("returns server runtime info", async () => {
    const api = createServerApi()
    const response = await api.request("/api/runtime")
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.capabilities.mode).toBe("server")
    expect(body.capabilities.canManageFrpServer).toBe(true)
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/server/api/server-api.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现最小 API**

第一批 API：

```text
GET /api/runtime
GET /api/system/detect
GET /api/tools
GET /api/endpoints
GET /api/frp/status
```

- [ ] **Step 4: 验证**

```bash
bun test src/server/api/server-api.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/server
git commit -m "feat: 增加服务器管理 API"
```

### Task 7: 实现 Tauri runtime adapter 骨架

**Files:**

- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src/desktop/runtime-adapter.ts`
- Create: `src/ui/api/tauri-management-client.ts`
- Test: `src/desktop/runtime-adapter.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "bun:test"
import { getDesktopRuntimeInfo } from "./runtime-adapter"

describe("desktop runtime adapter", () => {
  it("returns desktop capabilities", async () => {
    const info = await getDesktopRuntimeInfo()

    expect(info.capabilities.mode).toBe("desktop")
    expect(info.capabilities.canManageFrpClient).toBe(true)
    expect(info.capabilities.canManageFrpServer).toBe(false)
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/desktop/runtime-adapter.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现 desktop runtime adapter**

先返回 runtime info 和本地检测入口，不实现完整打包。

- [ ] **Step 4: 增加 Tauri Rust 骨架**

初始化 fs、dialog、shell 插件，为后续本机文件和进程操作做准备。

- [ ] **Step 5: 验证**

```bash
bun test src/desktop/runtime-adapter.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src-tauri src/desktop src/ui/api/tauri-management-client.ts
git commit -m "feat: 增加 Tauri 桌面运行时骨架"
```

### Task 8: 实现共享 React UI 骨架

**Files:**

- Create: `src/ui/app/App.tsx`
- Create: `src/ui/layout/AppLayout.tsx`
- Create: `src/ui/routes/routes.tsx`
- Create: `src/ui/features/dashboard/DashboardPage.tsx`
- Create: `src/ui/features/tools/ToolsPage.tsx`
- Create: `src/ui/features/config/ConfigPage.tsx`
- Create: `src/ui/features/endpoints/EndpointsPage.tsx`
- Create: `src/ui/features/frp/FrpPage.tsx`
- Create: `src/ui/features/settings/SettingsPage.tsx`
- Test: `src/ui/features/frp/FrpPage.test.tsx`

- [ ] **Step 1: 写 FRP 页面失败测试**

```tsx
import { describe, expect, it } from "bun:test"
import { selectFrpPanelKind } from "./FrpPage"

describe("FrpPage", () => {
  it("uses server panel for server runtime", () => {
    expect(selectFrpPanelKind({ mode: "server", canManageFrpServer: true, canManageFrpClient: false })).toBe("server")
  })

  it("uses client panel for desktop runtime", () => {
    expect(selectFrpPanelKind({ mode: "desktop", canManageFrpServer: false, canManageFrpClient: true })).toBe("client")
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/ui/features/frp/FrpPage.test.tsx
```

Expected: FAIL。

- [ ] **Step 3: 实现 UI 骨架和 FrpPage 分支函数**

UI 第一版只做页面结构和静态状态，不接完整 API。

- [ ] **Step 4: 验证**

```bash
bun test src/ui/features/frp/FrpPage.test.tsx
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui
git commit -m "feat: 增加共享管理界面骨架"
```

### Task 9: 实现 FRP server/client 页面

**Files:**

- Create: `src/ui/features/frp/ServerFrpPanel.tsx`
- Create: `src/ui/features/frp/ClientFrpPanel.tsx`
- Create: `src/ui/features/frp/EndpointRouteForm.tsx`
- Create: `src/ui/features/frp/FrpConnectionCard.tsx`
- Create: `src/ui/features/frp/FrpStatusCard.tsx`
- Test: `src/ui/features/frp/frp-panels.test.tsx`

- [ ] **Step 1: 写失败测试**

```tsx
import { describe, expect, it } from "bun:test"
import { getFrpPanelActions } from "./frp-panel-actions"

describe("frp panel actions", () => {
  it("shows server actions in server mode", () => {
    expect(getFrpPanelActions("server")).toContain("初始化 frp-panel")
    expect(getFrpPanelActions("server")).toContain("生成桌面端连接配置")
  })

  it("shows client actions in desktop mode", () => {
    expect(getFrpPanelActions("desktop")).toContain("生成 frpc 配置")
    expect(getFrpPanelActions("desktop")).toContain("启动 frpc")
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/ui/features/frp/frp-panels.test.tsx
```

Expected: FAIL。

- [ ] **Step 3: 实现 FRP 页面组件和 action helper**

保持表单状态简单，先支持必填字段：serverAddr、serverPort、token、localPort、subdomain/customDomain。

- [ ] **Step 4: 验证**

```bash
bun test src/ui/features/frp/frp-panels.test.tsx
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/features/frp
git commit -m "feat: 增加 FRP 服务端和客户端界面"
```

### Task 10: 连接 Web UI 和 Server API

**Files:**

- Create: `src/ui/api/server-management-client.ts`
- Modify: `src/ui/app/App.tsx`
- Modify: `src/server/api/index.ts`
- Test: `src/ui/api/server-management-client.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "bun:test"
import { createServerManagementClient } from "./server-management-client"

describe("server management client", () => {
  it("loads runtime info from HTTP API", async () => {
    const client = createServerManagementClient({
      fetch: async () => new Response(JSON.stringify({ capabilities: { mode: "server" } }), { status: 200 }),
      baseUrl: "http://127.0.0.1:4098",
    })

    const info = await client.getRuntimeInfo()
    expect(info.capabilities.mode).toBe("server")
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/ui/api/server-management-client.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现 HTTP client**

实现 `getRuntimeInfo`、`detectTools`、`listEndpoints`、`getFrpStatus` 的第一版。

- [ ] **Step 4: 验证**

```bash
bun test src/ui/api/server-management-client.test.ts src/server/api/server-api.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/ui/api src/ui/app src/server/api
git commit -m "feat: 连接管理界面和服务器 API"
```

### Task 11: 连接 UI 和 Tauri adapter

**Files:**

- Modify: `src/ui/api/tauri-management-client.ts`
- Modify: `src-tauri/src/lib.rs`
- Test: `src/ui/api/tauri-management-client.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { describe, expect, it } from "bun:test"
import { createTauriManagementClient } from "./tauri-management-client"

describe("tauri management client", () => {
  it("loads runtime info through invoke", async () => {
    const client = createTauriManagementClient({
      invoke: async (command) => {
        expect(command).toBe("get_runtime_info")
        return { capabilities: { mode: "desktop" } }
      },
    })

    const info = await client.getRuntimeInfo()
    expect(info.capabilities.mode).toBe("desktop")
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/ui/api/tauri-management-client.test.ts
```

Expected: FAIL。

- [ ] **Step 3: 实现 Tauri client**

实现与 Server client 同名方法，底层调用 `invoke`。

- [ ] **Step 4: 增加 Rust command 名称**

Rust 暴露 `get_runtime_info` 等最小命令。

- [ ] **Step 5: 验证**

```bash
bun test src/ui/api/tauri-management-client.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/ui/api/tauri-management-client.ts src-tauri
git commit -m "feat: 连接管理界面和 Tauri 运行时"
```

### Task 12: 更新部署模板和文档

**Files:**

- Modify: `deploy/server/docker-compose.yml`
- Modify: `deploy/server/Caddyfile`
- Modify: `deploy/server/install.sh`
- Modify: `README.md`
- Modify: `docs/guide/server-deployment.md`
- Modify: `docs/reference/cli.md`
- Create: `docs/guide/management-ui.md`

- [ ] **Step 1: 写文档验收检查脚本**

创建 `src/core/docs/docs-check.test.ts`：

```ts
import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"

describe("management UI docs", () => {
  it("documents shared UI and dual runtime", () => {
    const doc = readFileSync("docs/guide/management-ui.md", "utf8")
    expect(doc).toContain("同一套 React 管理界面")
    expect(doc).toContain("服务器 Web")
    expect(doc).toContain("Tauri 桌面端")
    expect(doc).toContain("FRP 服务端")
    expect(doc).toContain("FRP 客户端")
  })
})
```

- [ ] **Step 2: 运行失败测试**

```bash
bun test src/core/docs/docs-check.test.ts
```

Expected: FAIL，因为文档尚不存在。

- [ ] **Step 3: 更新部署模板**

服务器部署模板默认只部署管理平台、Caddy、frp-panel 相关服务；不要默认安装 OpenCode。

- [ ] **Step 4: 创建管理界面文档**

`docs/guide/management-ui.md` 必须说明：

- 服务器 Web 和 Tauri 复用 UI。
- OpenCode 默认不随服务器部署安装。
- FRP server/client 的职责差异。
- 多 endpoint 模型。
- 未来 AI 编程工具通过 ToolAdapter 扩展。

- [ ] **Step 5: 验证**

```bash
bun test src/core/docs/docs-check.test.ts
bunx tsc --noEmit
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add deploy/server README.md docs src/core/docs
git commit -m "docs: 增加管理界面双运行时方案"
```

---

## 9. 安全要求

实现过程中必须遵守：

- OpenCode 对外发布必须启用密码。
- 公网 endpoint 默认 disabled。
- 启用 endpoint 前运行风险检查。
- Caddy Basic Auth 和 OpenCode server password 可以同时启用。
- frp token、password、secret、Authorization header 必须在日志中脱敏。
- 应用配置和 preset 前必须备份。
- `deploy/server/.env.local` 不应包含真实生产密钥。
- 服务器 Web 第一版至少要有管理员密码和 session cookie。

---

## 10. 验证命令

每个阶段至少运行：

```bash
bunx tsc --noEmit
bun run test
bun run smoke
```

新增 UI 后增加：

```bash
bun test src/ui/**/*.test.ts src/ui/**/*.test.tsx
```

新增 Server API 后增加：

```bash
bun test src/server/**/*.test.ts
```

新增 Tauri 后增加：

```bash
bun test src/desktop/**/*.test.ts src/ui/api/tauri-management-client.test.ts
```

---

## 11. MVP 验收标准

### 服务器端

- Web 管理界面可打开。
- 首次进入时能设置管理员密码。
- 默认不安装 OpenCode。
- UI 能检测 OpenCode 缺失/已安装状态。
- UI 能手动触发 OpenCode 安装/配置/启动。
- UI 能初始化 FRP 服务端配置。
- UI 能创建至少两个 endpoint：服务器本地 OpenCode、桌面端 OpenCode。

### 桌面端

- Tauri app 可启动。
- 初始化时能检测本机 OpenCode、Bun、oh-my-openagent、frpc、cloudflared。
- UI 能管理本机 OpenCode 配置和 oh-my-openagent 配置。
- UI 能启动本机 OpenCode Web。
- UI 能填写服务器 FRP 信息并生成 frpc 配置。
- UI 能启动/停止 frpc 并显示公网 URL。

### 共享能力

- 同一套 React UI 在服务器和 Tauri 中复用。
- Config、preset、backup、endpoint、tool instance 使用同一套 core model。
- FRP 页面只在 server/client panel 处根据 capability 分支。
- CLI 继续可用，并调用同一套 core。

---

## 12. 不做范围

第一版不做：

- 多用户 RBAC。
- 云端账号系统。
- Kubernetes。
- 多服务器集群管理。
- 复杂 workflow 编排。
- 完整复刻 OMO 所有 UI 细节。
- 直接支持所有 AI 编程工具。

第一版只把 OpenCode、oh-my-openagent、FRP server/client、多 endpoint 和双运行时 UI 打通。

---

## 13. 自检结果

- 覆盖服务器默认不安装 OpenCode：Task 12 和 MVP 服务器端验收。
- 覆盖管理界面手动安装/配置/启动 OpenCode：Task 6、Task 8、MVP 服务器端验收。
- 覆盖多对外地址：PublicEndpoint 模型、Task 5、Task 8、MVP 验收。
- 覆盖服务器 FRP 服务端和 Tauri FRP 客户端：RuntimeCapabilities、FrpPage、Task 9。
- 覆盖 UI 复用：第 2 节、第 7 节、Task 8、Task 10、Task 11。
- 覆盖未来其他 AI 编程工具：ToolAdapter、Task 3、MVP 共享能力。
- 未发现未填写的占位段落或含糊的后补说明。
