# Runtime Execution Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn OMO-FRP from a UI/CLI/Docker Beta with simulated runtime state into a server-first runtime that can persist configuration, report real status, and progressively execute OpenCode, FRP, and Cloudflare actions.

**Architecture:** Keep the existing React UI, Management API contract, CLI planners, Docker Compose deployment, and Tauri shell. Split the current local in-memory runtime into a test executor and a real server executor, then add file-backed state, controlled process/container integration, and finally desktop bridge implementations. Docker/server runtime is the first production path; Tauri remains preview until its bridge stops returning hardcoded/no-op responses.

**Tech Stack:** Bun, TypeScript, React, Vite, Docker Compose, Caddy, Tauri/Rust, existing `management-api` contracts, existing `StorageAdapter`, existing CLI FRP/Cloudflare planners.

---

## Current Completion Baseline

The repository currently has strong UI, CLI, CI, and Docker scaffolding, but weak real execution depth.

- `bun test` passes with 207 tests.
- `bun run typecheck` passes.
- `bun run build && bun run build:ui && bun run build:server` passes.
- `bun run smoke` passes.
- `cargo check` in `src-tauri` passes.
- `docker build --target management-ui -f deploy/server/Dockerfile .` passes.
- `src/management-api/local-management-runtime.ts` toggles in-memory state for many actions instead of starting real tools.
- `src-tauri/src/lib.rs` contains hardcoded/no-op/static bridge responses for many desktop actions.
- UI pages intentionally expose placeholders such as `手动备份待接入`, `旧备份清理待接入`, `后端能力占位`, and `后端自动启动待接入`.

## Recommended Delivery Strategy

Implement Docker/server runtime first, then Tauri.

1. Freeze current UI/Docker/CI baseline.
2. Extract runtime execution interfaces without changing UI behavior.
3. Add persistent server state and real backups.
4. Add real OpenCode status/log management.
5. Add FRP/frp-panel status and endpoint activation.
6. Add Cloudflare quick tunnel execution.
7. Replace Tauri bridge placeholders with native filesystem/process implementations.
8. Harden jobs, logs, security, and release workflows.

## File Boundary Map

### New files

- `src/management-api/runtime-executor.ts` — shared executor interface used by memory, server, and later Tauri-backed runtimes.
- `src/management-api/memory-runtime-executor.ts` — preserves current simulated behavior for tests and non-production fixtures.
- `src/server/server-runtime-executor.ts` — server implementation for filesystem, HTTP health, controlled commands, and later Docker/frp/cloudflared operations.
- `src/server/server-runtime-state.ts` — load/save app config, job history, process state, and log metadata from disk.
- `src/server/server-runtime-paths.ts` — resolves `/opt/opencode-remote-platform` paths from environment variables.
- `src/server/command-runner.ts` — controlled command execution with argument arrays, timeout, cwd, env allowlist, stdout/stderr capture, and redaction.
- `src/server/docker-compose-control.ts` — optional Docker Compose/container control wrapper if server runtime is allowed to manage containers.
- `src/server/frp-panel-client.ts` — frp-panel HTTP client and status/route operations.
- `src/server/cloudflared-process.ts` — quick tunnel process lifecycle and URL extraction.
- `src/server/log-store.ts` — append/read/redact bounded logs.
- `src/server/job-store.ts` — durable job records for pending/running/succeeded/failed actions.
- `src/server/*.test.ts` files for each new server module.

### Modified files

- `src/management-api/local-management-runtime.ts` — depend on `RuntimeExecutor` and `StorageAdapter` instead of embedding all simulated execution behavior.
- `src/server/runtime-adapter.ts` — wire server runtime to file-backed storage and server executor.
- `src/server/api/index.ts` — keep route contract; add validation only where needed to protect real execution.
- `src/server/management-ui-server.ts` — pass server runtime paths and environment into API creation if needed.
- `deploy/server/docker-compose.yml` — mount config/log/state volumes and expose environment variables used by server runtime.
- `deploy/server/.env.example` — document runtime paths and whether Docker/container control is enabled.
- `deploy/server/healthcheck.sh` — include management API and persisted runtime smoke checks.
- `docs/guide/management-ui.md` — update UI capability claims as placeholders are replaced.
- `docs/guide/server-deployment.md` — document real runtime behavior and operational risks.
- `src-tauri/src/lib.rs` — later phases replace placeholder bridge responses.

---

## Phase 0: Freeze the Current Baseline

**Purpose:** Turn the current verified but uncommitted state into a clean baseline before invasive runtime work.

### Task 0.1: Review and split current working tree

**Files:**
- Inspect only: all currently modified/untracked files from `git status --short`.

- [ ] **Step 1: Inspect working tree**

Run:

```bash
git status --short
git diff --stat
```

Expected: shows the current UI, server, Docker, docs, and CI changes.

- [ ] **Step 2: Verify baseline quality**

Run:

```bash
bun test
bun run typecheck
bun run build && bun run build:ui && bun run build:server
bun run smoke
(cd src-tauri && cargo check)
docker build --target management-ui -f deploy/server/Dockerfile .
```

Expected:

```text
bun test: 0 fail
typecheck: exit 0
build/build:ui/build:server: exit 0
smoke: smoke passed
cargo check: Finished dev profile
docker build management-ui: exit 0
```

- [ ] **Step 3: Commit baseline in focused commits**

Use Chinese Conventional Commits. Suggested split:

```bash
git add src/ui src/server package.json .dockerignore
git commit -m "feat: 完善管理界面与服务端入口"

git add deploy .github docs README.md
git commit -m "build: 完善 Docker 与发布流水线"
```

Expected: `git status --short` is clean or only contains intentionally deferred files.

---

## Phase 1: Extract RuntimeExecutor Without Behavior Changes

**Purpose:** Separate management state from execution. This prevents future real execution work from breaking UI and tests.

### Task 1.1: Add executor interface

**Files:**
- Create: `src/management-api/runtime-executor.ts`
- Modify: `src/management-api/local-management-runtime.ts`
- Test: `src/management-api/local-management-runtime.test.ts`

- [ ] **Step 1: Write failing interface integration test**

Add a test to `src/management-api/local-management-runtime.test.ts` that proves runtime execution is delegated:

```ts
import { expect, test } from "bun:test"
import { createLocalManagementRuntime } from "./local-management-runtime"
import type { RuntimeExecutor } from "./runtime-executor"
import { SERVER_CAPABILITIES } from "../core/app-config/types"

test("delegates tool start to the runtime executor", async () => {
  const calls: string[] = []
  const executor: RuntimeExecutor = {
    async detectTools() { return [] },
    async installTool() { throw new Error("not used") },
    async startTool(instanceId) {
      calls.push(instanceId)
      return { jobId: `start:${instanceId}`, status: "succeeded", message: "started by executor" }
    },
    async stopTool() { throw new Error("not used") },
    async restartTool() { throw new Error("not used") },
    async getToolLogs() { return [] },
    async getFrpStatus() { return { mode: "server", running: false, message: "not running" } },
    async saveFrpConfig() {},
    async startFrp() { throw new Error("not used") },
    async stopFrp() { throw new Error("not used") },
    async getCloudflareTunnelStatus() { return { mode: "unavailable", running: false, message: "not configured" } },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() { throw new Error("not used") },
    async startCloudflareTunnel() { throw new Error("not used") },
    async stopCloudflareTunnel() { throw new Error("not used") },
    async retryCloudflareTunnelStep(stepId) {
      return { jobId: `retry:${stepId}`, status: "succeeded", message: "retried" }
    },
  }

  const runtime = createLocalManagementRuntime({
    capabilities: SERVER_CAPABILITIES,
    defaultConfigDirectory: "/config",
    frpStatusMode: "server",
    executor,
    config: {
      mode: "server",
      toolInstances: [{
        id: "opencode-server",
        kind: "opencode",
        displayName: "OpenCode",
        hostType: "server",
        installState: "installed",
        defaultPort: 4096,
        status: "stopped",
      }],
      pluginConfigs: [],
      publicEndpoints: [],
      frpClients: [],
    },
  })

  const result = await runtime.startTool("opencode-server")

  expect(result.message).toBe("started by executor")
  expect(calls).toEqual(["opencode-server"])
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
bun test src/management-api/local-management-runtime.test.ts
```

Expected: fails because `RuntimeExecutor` and `executor` option do not exist.

- [ ] **Step 3: Create `RuntimeExecutor` interface**

Create `src/management-api/runtime-executor.ts`:

```ts
import type {
  CloudflareTunnelConfigRequest,
  CloudflareTunnelPlan,
  CloudflareTunnelStatus,
  CloudflareTunnelStepId,
  FrpConfigRequest,
  FrpStatus,
  InstallToolRequest,
  JobResult,
  LogLine,
  ToolDetection,
} from "./types"

export interface RuntimeExecutor {
  detectTools(): Promise<ToolDetection[]>
  installTool(request: InstallToolRequest): Promise<JobResult>
  startTool(instanceId: string): Promise<JobResult>
  stopTool(instanceId: string): Promise<JobResult>
  restartTool(instanceId: string): Promise<JobResult>
  getToolLogs(instanceId: string): Promise<LogLine[]>

  getFrpStatus(): Promise<FrpStatus>
  saveFrpConfig(config: FrpConfigRequest): Promise<void>
  startFrp(): Promise<JobResult>
  stopFrp(): Promise<JobResult>

  getCloudflareTunnelStatus(): Promise<CloudflareTunnelStatus>
  saveCloudflareTunnelConfig(config: CloudflareTunnelConfigRequest): Promise<void>
  createCloudflareTunnelPlan(config: CloudflareTunnelConfigRequest): Promise<CloudflareTunnelPlan>
  startCloudflareTunnel(config: CloudflareTunnelConfigRequest): Promise<JobResult>
  stopCloudflareTunnel(): Promise<JobResult>
  retryCloudflareTunnelStep(stepId: CloudflareTunnelStepId): Promise<JobResult>
}
```

- [ ] **Step 4: Extend runtime options**

Modify `CreateLocalManagementRuntimeOptions` in `src/management-api/local-management-runtime.ts`:

```ts
import type { RuntimeExecutor } from "./runtime-executor"

export interface CreateLocalManagementRuntimeOptions {
  capabilities: RuntimeCapabilities
  defaultConfigDirectory: string
  frpStatusMode: FrpStatus["mode"]
  config?: AppConfig
  storage?: StorageAdapter
  executor?: RuntimeExecutor
  now?: () => Date
}
```

- [ ] **Step 5: Run test to verify pass**

Run:

```bash
bun test src/management-api/local-management-runtime.test.ts
```

Expected: pass after `startTool()` delegates when `options.executor` is present.

- [ ] **Step 6: Run full verification**

Run:

```bash
bun test
bun run typecheck
```

Expected: 0 failures and typecheck exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/management-api/runtime-executor.ts src/management-api/local-management-runtime.ts src/management-api/local-management-runtime.test.ts
git commit -m "refactor: 抽象运行时执行接口"
```

---

## Phase 2: Add File-Backed Server State and Backups

**Purpose:** Server runtime state must survive container restarts before real process management is meaningful.

### Task 2.1: Add server runtime path resolver

**Files:**
- Create: `src/server/server-runtime-paths.ts`
- Test: `src/server/server-runtime-paths.test.ts`

- [ ] **Step 1: Write path resolver test**

Create `src/server/server-runtime-paths.test.ts`:

```ts
import { expect, test } from "bun:test"
import { createServerRuntimePaths } from "./server-runtime-paths"

test("uses OPENCODE_REMOTE_STATE_ROOT for config, logs, and state paths", () => {
  const paths = createServerRuntimePaths({ root: "/srv/omo-frp" })

  expect(paths.root).toBe("/srv/omo-frp")
  expect(paths.configDirectory).toBe("/srv/omo-frp/config")
  expect(paths.logDirectory).toBe("/srv/omo-frp/logs")
  expect(paths.stateDirectory).toBe("/srv/omo-frp/state")
  expect(paths.appConfigPath).toBe("/srv/omo-frp/config/app-config.json")
  expect(paths.jobsPath).toBe("/srv/omo-frp/state/jobs.jsonl")
})
```

- [ ] **Step 2: Run failing test**

```bash
bun test src/server/server-runtime-paths.test.ts
```

Expected: fails because module does not exist.

- [ ] **Step 3: Implement resolver**

Create `src/server/server-runtime-paths.ts`:

```ts
import { join, resolve } from "node:path"

export interface ServerRuntimePaths {
  root: string
  configDirectory: string
  logDirectory: string
  stateDirectory: string
  appConfigPath: string
  jobsPath: string
  processStatePath: string
}

export interface CreateServerRuntimePathsOptions {
  root?: string
}

export function createServerRuntimePaths(options: CreateServerRuntimePathsOptions = {}): ServerRuntimePaths {
  const root = resolve(options.root ?? process.env.OPENCODE_REMOTE_STATE_ROOT ?? "/opt/opencode-remote-platform")
  const configDirectory = join(root, "config")
  const logDirectory = join(root, "logs")
  const stateDirectory = join(root, "state")

  return {
    root,
    configDirectory,
    logDirectory,
    stateDirectory,
    appConfigPath: join(configDirectory, "app-config.json"),
    jobsPath: join(stateDirectory, "jobs.jsonl"),
    processStatePath: join(stateDirectory, "processes.json"),
  }
}
```

- [ ] **Step 4: Verify**

```bash
bun test src/server/server-runtime-paths.test.ts
bun run typecheck
```

Expected: pass.

### Task 2.2: Persist server app config

**Files:**
- Create: `src/server/server-runtime-state.ts`
- Test: `src/server/server-runtime-state.test.ts`
- Modify: `src/server/runtime-adapter.ts`

- [ ] **Step 1: Write persistence test**

Create `src/server/server-runtime-state.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, test } from "bun:test"
import { createEmptyServerConfig } from "./runtime-adapter"
import { loadServerAppConfig, saveServerAppConfig } from "./server-runtime-state"

test("saves and loads server app config from disk", async () => {
  const root = await mkdtemp(join(tmpdir(), "omo-frp-state-"))
  try {
    const path = join(root, "config", "app-config.json")
    const config = createEmptyServerConfig()
    config.toolInstances.push({
      id: "opencode-server",
      kind: "opencode",
      displayName: "OpenCode",
      hostType: "server",
      installState: "installed",
      defaultPort: 4096,
      status: "stopped",
    })

    await saveServerAppConfig(path, config)
    const loaded = await loadServerAppConfig(path)

    expect(loaded.toolInstances).toHaveLength(1)
    expect(loaded.toolInstances[0]?.id).toBe("opencode-server")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Run failing test**

```bash
bun test src/server/server-runtime-state.test.ts
```

Expected: fails because module does not exist.

- [ ] **Step 3: Implement JSON persistence**

Create `src/server/server-runtime-state.ts`:

```ts
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { AppConfig } from "../core/app-config/types"
import { createEmptyServerConfig } from "./runtime-adapter"

export async function loadServerAppConfig(path: string): Promise<AppConfig> {
  try {
    const content = await readFile(path, "utf8")
    return JSON.parse(content) as AppConfig
  } catch (error) {
    if (isMissingFileError(error)) return createEmptyServerConfig()
    throw error
  }
}

export async function saveServerAppConfig(path: string, config: AppConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf8")
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT")
}
```

- [ ] **Step 4: Wire runtime adapter to persisted config**

Modify `src/server/runtime-adapter.ts` by adding an async factory while keeping the existing sync factory for tests:

```ts
import { createServerRuntimePaths } from "./server-runtime-paths"
import { loadServerAppConfig } from "./server-runtime-state"

export async function createPersistedServerRuntimeAdapter(): Promise<ServerRuntimeAdapter> {
  const paths = createServerRuntimePaths()
  const config = await loadServerAppConfig(paths.appConfigPath)
  return createServerRuntimeAdapter(config)
}
```

- [ ] **Step 5: Verify**

```bash
bun test src/server/server-runtime-state.test.ts src/server/runtime-adapter.test.ts
bun run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/server/server-runtime-paths.ts src/server/server-runtime-paths.test.ts src/server/server-runtime-state.ts src/server/server-runtime-state.test.ts src/server/runtime-adapter.ts
git commit -m "feat: 增加服务端运行时持久化状态"
```

---

## Phase 3: Add Jobs and Logs Before Real Execution

**Purpose:** Real commands need durable jobs and bounded logs so failures are visible and debuggable.

### Task 3.1: Add job store

**Files:**
- Create: `src/server/job-store.ts`
- Test: `src/server/job-store.test.ts`

- [ ] **Step 1: Write job append/read test**

Create `src/server/job-store.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, test } from "bun:test"
import { appendJobRecord, readJobRecords } from "./job-store"

test("appends and reads JSONL job records", async () => {
  const root = await mkdtemp(join(tmpdir(), "omo-frp-jobs-"))
  try {
    const path = join(root, "jobs.jsonl")
    await appendJobRecord(path, {
      jobId: "start:opencode",
      action: "start",
      targetId: "opencode",
      status: "succeeded",
      message: "OpenCode started.",
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:01.000Z",
    })

    const records = await readJobRecords(path)

    expect(records).toHaveLength(1)
    expect(records[0]?.jobId).toBe("start:opencode")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Implement job store**

Create `src/server/job-store.ts`:

```ts
import { mkdir, readFile, appendFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { JobResult } from "../management-api/types"

export interface JobRecord extends JobResult {
  action: string
  targetId: string
  createdAt: string
  updatedAt: string
}

export async function appendJobRecord(path: string, record: JobRecord): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(record)}\n`, "utf8")
}

export async function readJobRecords(path: string): Promise<JobRecord[]> {
  try {
    const content = await readFile(path, "utf8")
    return content.split("\n").filter(Boolean).map((line) => JSON.parse(line) as JobRecord)
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return []
    throw error
  }
}
```

- [ ] **Step 3: Verify and commit**

```bash
bun test src/server/job-store.test.ts
bun run typecheck
git add src/server/job-store.ts src/server/job-store.test.ts
git commit -m "feat: 增加运行时任务记录"
```

### Task 3.2: Add redacted bounded log store

**Files:**
- Create: `src/server/log-store.ts`
- Test: `src/server/log-store.test.ts`

- [ ] **Step 1: Write log redaction test**

Create `src/server/log-store.test.ts`:

```ts
import { mkdtemp, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { expect, test } from "bun:test"
import { appendRuntimeLog, readRuntimeLogs } from "./log-store"

test("redacts secrets when reading runtime logs", async () => {
  const root = await mkdtemp(join(tmpdir(), "omo-frp-logs-"))
  try {
    const path = join(root, "opencode.log")
    await appendRuntimeLog(path, {
      timestamp: "2026-05-20T00:00:00.000Z",
      level: "info",
      message: "started with token=secret-token and password=hunter2",
    })

    const logs = await readRuntimeLogs(path)

    expect(logs[0]?.message).not.toContain("secret-token")
    expect(logs[0]?.message).not.toContain("hunter2")
    expect(logs[0]?.message).toContain("[REDACTED]")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Implement log store**

Create `src/server/log-store.ts`:

```ts
import { mkdir, readFile, appendFile } from "node:fs/promises"
import { dirname } from "node:path"
import type { LogLine } from "../management-api/types"
import { redactSensitiveText } from "../shared/redact-sensitive-text"

export async function appendRuntimeLog(path: string, line: LogLine): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(line)}\n`, "utf8")
}

export async function readRuntimeLogs(path: string, limit = 500): Promise<LogLine[]> {
  try {
    const content = await readFile(path, "utf8")
    return content
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line) as LogLine)
      .map((line) => ({ ...line, message: redactSensitiveText(line.message) }))
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return []
    throw error
  }
}
```

- [ ] **Step 3: Verify and commit**

```bash
bun test src/server/log-store.test.ts
bun run typecheck
git add src/server/log-store.ts src/server/log-store.test.ts
git commit -m "feat: 增加脱敏运行时日志存储"
```

---

## Phase 4: Add Controlled Command Runner

**Purpose:** Any real execution must use argument arrays, timeouts, and redacted logs. No arbitrary shell strings.

### Task 4.1: Implement command runner

**Files:**
- Create: `src/server/command-runner.ts`
- Test: `src/server/command-runner.test.ts`

- [ ] **Step 1: Write command runner test**

Create `src/server/command-runner.test.ts`:

```ts
import { expect, test } from "bun:test"
import { runCommand } from "./command-runner"

test("runs a command with args and captures output", async () => {
  const result = await runCommand({
    command: process.execPath,
    args: ["-e", "console.log('hello')"],
    timeoutMs: 5_000,
  })

  expect(result.exitCode).toBe(0)
  expect(result.stdout.trim()).toBe("hello")
  expect(result.stderr).toBe("")
})

test("redacts sensitive command output", async () => {
  const result = await runCommand({
    command: process.execPath,
    args: ["-e", "console.log('token=secret-token password=hunter2')"],
    timeoutMs: 5_000,
  })

  expect(result.stdout).not.toContain("secret-token")
  expect(result.stdout).not.toContain("hunter2")
  expect(result.stdout).toContain("[REDACTED]")
})
```

- [ ] **Step 2: Implement command runner**

Create `src/server/command-runner.ts`:

```ts
import { spawn } from "node:child_process"
import { redactSensitiveText } from "../shared/redact-sensitive-text"

export interface RunCommandOptions {
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
  timeoutMs: number
}

export interface RunCommandResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
}

export function runCommand(options: RunCommandOptions): Promise<RunCommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      windowsHide: true,
    })

    let stdout = ""
    let stderr = ""
    let settled = false

    const timer = setTimeout(() => {
      settled = true
      child.kill("SIGTERM")
      resolve({ exitCode: null, stdout: redactSensitiveText(stdout), stderr: redactSensitiveText(stderr), timedOut: true })
    }, options.timeoutMs)

    child.stdout.on("data", (chunk) => { stdout += String(chunk) })
    child.stderr.on("data", (chunk) => { stderr += String(chunk) })
    child.on("error", (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (exitCode) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode, stdout: redactSensitiveText(stdout), stderr: redactSensitiveText(stderr), timedOut: false })
    })
  })
}
```

- [ ] **Step 3: Verify and commit**

```bash
bun test src/server/command-runner.test.ts
bun run typecheck
git add src/server/command-runner.ts src/server/command-runner.test.ts
git commit -m "feat: 增加受控命令执行器"
```

---

## Phase 5: Server OpenCode Real Status and Logs

**Purpose:** Replace fake OpenCode start/stop reporting with real status and logs for the Docker/server path.

### Task 5.1: Add OpenCode HTTP status detection

**Files:**
- Modify: `src/server/server-runtime-executor.ts`
- Test: `src/server/server-runtime-executor.test.ts`

- [ ] **Step 1: Write status detection test**

Create or extend `src/server/server-runtime-executor.test.ts`:

```ts
import { expect, test } from "bun:test"
import { createServerRuntimeExecutor } from "./server-runtime-executor"

test("detects OpenCode as running when health endpoint responds", async () => {
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response("ok", { status: 200 }),
  })
  try {
    const executor = createServerRuntimeExecutor({
      opencodeUrl: `http://127.0.0.1:${server.port}`,
    })

    const detections = await executor.detectTools()

    expect(detections.some((tool) => tool.kind === "opencode" && tool.detected)).toBe(true)
  } finally {
    server.stop(true)
  }
})
```

- [ ] **Step 2: Implement minimal executor detection**

Create `src/server/server-runtime-executor.ts` if it does not exist:

```ts
import type { RuntimeExecutor } from "../management-api/runtime-executor"
import type { ToolDetection } from "../management-api/types"

export interface ServerRuntimeExecutorOptions {
  opencodeUrl?: string
}

export function createServerRuntimeExecutor(options: ServerRuntimeExecutorOptions = {}): RuntimeExecutor {
  const opencodeUrl = options.opencodeUrl ?? process.env.OPENCODE_INTERNAL_URL ?? "http://opencode:4096"

  return {
    async detectTools(): Promise<ToolDetection[]> {
      return [{
        kind: "opencode",
        displayName: "OpenCode",
        detected: await isHttpReachable(opencodeUrl),
        binaryPath: "opencode",
        configDirectory: process.env.OPENCODE_CONFIG_DIR ?? "/config",
      }]
    },
    async installTool(request) { return { jobId: `install:${request.kind}`, status: "failed", message: "Server runtime installs tools through Docker images." } },
    async startTool(instanceId) { return { jobId: `start:${instanceId}`, status: "failed", message: "OpenCode container start is not enabled for this runtime yet." } },
    async stopTool(instanceId) { return { jobId: `stop:${instanceId}`, status: "failed", message: "OpenCode container stop is not enabled for this runtime yet." } },
    async restartTool(instanceId) { return { jobId: `restart:${instanceId}`, status: "failed", message: "OpenCode container restart is not enabled for this runtime yet." } },
    async getToolLogs() { return [] },
    async getFrpStatus() { return { mode: "server", running: false, message: "FRP status integration is not connected yet." } },
    async saveFrpConfig() {},
    async startFrp() { return { jobId: "start-frp:server", status: "failed", message: "FRP server execution is not connected yet." } },
    async stopFrp() { return { jobId: "stop-frp:server", status: "failed", message: "FRP server execution is not connected yet." } },
    async getCloudflareTunnelStatus() { return { mode: "unavailable", running: false, message: "Cloudflare runtime is not connected yet." } },
    async saveCloudflareTunnelConfig() {},
    async createCloudflareTunnelPlan() { throw new Error("Cloudflare plan integration is not connected yet") },
    async startCloudflareTunnel() { return { jobId: "start-cloudflare:server", status: "failed", message: "Cloudflare execution is not connected yet." } },
    async stopCloudflareTunnel() { return { jobId: "stop-cloudflare:server", status: "failed", message: "Cloudflare execution is not connected yet." } },
    async retryCloudflareTunnelStep(stepId) { return { jobId: `retry-cloudflare:${stepId}`, status: "failed", message: "Cloudflare retry is not connected yet." } },
  }
}

async function isHttpReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "GET" })
    return response.ok || response.status === 401 || response.status === 403
  } catch {
    return false
  }
}
```

- [ ] **Step 3: Verify and commit**

```bash
bun test src/server/server-runtime-executor.test.ts
bun run typecheck
git add src/server/server-runtime-executor.ts src/server/server-runtime-executor.test.ts
git commit -m "feat: 增加服务端 OpenCode 状态检测"
```

---

## Phase 6: FRP Panel Integration

**Purpose:** Make FRP status and endpoint enablement reflect frp-panel or service health instead of memory flags.

### Task 6.1: Add frp-panel health client

**Files:**
- Create: `src/server/frp-panel-client.ts`
- Test: `src/server/frp-panel-client.test.ts`

- [ ] **Step 1: Write health test**

Create `src/server/frp-panel-client.test.ts`:

```ts
import { expect, test } from "bun:test"
import { createFrpPanelClient } from "./frp-panel-client"

test("reports frp-panel healthy when HTTP endpoint responds", async () => {
  const server = Bun.serve({ port: 0, fetch: () => new Response("ok") })
  try {
    const client = createFrpPanelClient({ baseUrl: `http://127.0.0.1:${server.port}` })
    await expect(client.health()).resolves.toEqual({ reachable: true, status: 200 })
  } finally {
    server.stop(true)
  }
})
```

- [ ] **Step 2: Implement client**

Create `src/server/frp-panel-client.ts`:

```ts
export interface FrpPanelClientOptions {
  baseUrl: string
}

export interface FrpPanelHealth {
  reachable: boolean
  status?: number
  message?: string
}

export function createFrpPanelClient(options: FrpPanelClientOptions) {
  return {
    async health(): Promise<FrpPanelHealth> {
      try {
        const response = await fetch(options.baseUrl)
        return { reachable: true, status: response.status }
      } catch (error) {
        return { reachable: false, message: error instanceof Error ? error.message : String(error) }
      }
    },
  }
}
```

- [ ] **Step 3: Verify and commit**

```bash
bun test src/server/frp-panel-client.test.ts
bun run typecheck
git add src/server/frp-panel-client.ts src/server/frp-panel-client.test.ts
git commit -m "feat: 增加 frp-panel 健康检测客户端"
```

---

## Phase 7: Cloudflare Quick Tunnel Execution

**Purpose:** Move Cloudflare quick mode from manual command display to managed process lifecycle.

### Task 7.1: Extract trycloudflare URL from logs

**Files:**
- Create: `src/server/cloudflared-process.ts`
- Test: `src/server/cloudflared-process.test.ts`

- [ ] **Step 1: Write URL extraction test**

Create `src/server/cloudflared-process.test.ts`:

```ts
import { expect, test } from "bun:test"
import { extractTryCloudflareUrl } from "./cloudflared-process"

test("extracts trycloudflare public URL from cloudflared output", () => {
  const output = "INF Requesting new quick Tunnel on trycloudflare.com\nhttps://alpha-beta.trycloudflare.com"

  expect(extractTryCloudflareUrl(output)).toBe("https://alpha-beta.trycloudflare.com")
})
```

- [ ] **Step 2: Implement extractor**

Create `src/server/cloudflared-process.ts`:

```ts
export function extractTryCloudflareUrl(output: string): string | undefined {
  return output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)?.[0]
}
```

- [ ] **Step 3: Verify and commit**

```bash
bun test src/server/cloudflared-process.test.ts
bun run typecheck
git add src/server/cloudflared-process.ts src/server/cloudflared-process.test.ts
git commit -m "feat: 增加 Cloudflare 快速隧道输出解析"
```

---

## Phase 8: Tauri Bridge Realization

**Purpose:** Replace desktop hardcoded/no-op responses with native filesystem and process operations.

### Task 8.1: Replace desktop config no-op with filesystem read/write

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Test: Rust tests under `src-tauri/src/lib.rs` or a new Rust module test if the crate structure is split.

- [ ] **Step 1: Add Rust testable helper**

Add a helper function in `src-tauri/src/lib.rs`:

```rust
fn validate_json_config(content: &str) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("Content cannot be empty".to_string());
    }
    serde_json::from_str::<serde_json::Value>(content)
        .map(|_| ())
        .map_err(|error| error.to_string())
}
```

- [ ] **Step 2: Add Rust unit tests**

```rust
#[cfg(test)]
mod tests {
    use super::validate_json_config;

    #[test]
    fn accepts_valid_json_config() {
        assert!(validate_json_config("{\"theme\":\"dark\"}").is_ok());
    }

    #[test]
    fn rejects_empty_json_config() {
        assert_eq!(validate_json_config(""), Err("Content cannot be empty".to_string()));
    }
}
```

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri
cargo test
```

Expected: tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: 增加桌面配置校验基础"
```

---

## Phase 9: Production Hardening

**Purpose:** Promote Beta runtime to production preview by proving real operations are observable, secure, and recoverable.

### Task 9.1: Add full verification script target

**Files:**
- Modify: `package.json`
- Test: command execution only.

- [ ] **Step 1: Add verify script**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "verify": "bun test && bun run typecheck && bun run build && bun run build:ui && bun run build:server && bun run smoke"
  }
}
```

- [ ] **Step 2: Run verification**

```bash
bun run verify
(cd src-tauri && cargo check)
docker build --target management-ui -f deploy/server/Dockerfile .
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: 增加统一验证脚本"
```

---

## Acceptance Criteria by Milestone

### Implementation status as of 2026-05-21

- Beta 1 server runtime is implemented: execution delegates through `RuntimeExecutor`, persisted state/job/log stores are wired, backups use filesystem storage, and diagnostics/log output is redacted.
- Beta 2 Docker/server runtime is implemented for OpenCode, FRP, and Cloudflare quick tunnels: OpenCode status/logs use HTTP and Docker state, FRP status/start/stop use frp-panel/container state, Cloudflare quick tunnels use a managed `cloudflared` process, and server endpoint enablement now fails closed with an actionable Caddy/frp-panel provisioning message instead of fake activation.
- Beta 3 desktop preview runtime is implemented for the planned preview scope: the Tauri bridge reads/saves config files, detects `opencode`/`frpc`/`cloudflared`, exposes desktop tool instances, manages local OpenCode/frpc/cloudflared processes, keeps logs available after stop, and reports precise failures when a desktop capability is unavailable.
- Production preview checks currently pass for durable jobs/logs, bounded/redacted logs, session/header protection, Docker smoke/build targets, and unsigned Tauri artifact labeling. The remaining productization gap is automated Caddy/frp-panel route mutation; current behavior is the accepted explicit actionable failure path.

### Beta 1: State-true server runtime

- `RuntimeExecutor` exists and local runtime can delegate execution.
- Server state persists across process/container restart.
- Manual backup creates real backup files.
- Logs and diagnostics are redacted.
- UI no longer reports fake success for server actions that are not wired.

### Beta 2: Docker/server operational runtime

- OpenCode status is based on real HTTP/container state.
- FRP status is based on frp-panel or container health.
- Endpoint enablement creates or updates a real route, or fails with an explicit actionable reason.
- Cloudflare quick mode can detect `cloudflared`, start a managed process, capture the public URL, stop it, and show logs.

### Beta 3: Desktop preview runtime

- Tauri bridge reads/saves config through approved filesystem APIs.
- Desktop detects `opencode`, `frpc`, and `cloudflared` binaries.
- Desktop can start/stop at least local OpenCode and frpc with logs.
- Cloudflare desktop quick tunnel either works or returns a precise missing capability error without fake success.

### Production preview

- Jobs are durable and visible.
- Logs are bounded and redacted.
- All mutating APIs are protected by request headers and session auth when configured.
- Docker deployment has smoke checks for management UI, OpenCode, frp-panel, and Caddy routing.
- Tauri artifacts remain labeled unsigned until signing/notarization is implemented.

## Verification Commands

Run after every phase:

```bash
bun test
bun run typecheck
bun run build && bun run build:ui && bun run build:server
bun run smoke
(cd src-tauri && cargo check)
docker build --target management-ui -f deploy/server/Dockerfile .
```

Run before declaring production preview:

```bash
docker build --target management-ui -f deploy/server/Dockerfile .
docker build --target opencode -f deploy/server/Dockerfile .
```

## Estimated Workload

- Phase 0: 0.5–1 day.
- Phase 1: 1–2 days.
- Phase 2: 2–4 days.
- Phase 3: 1–2 days.
- Phase 4: 1–2 days.
- Phase 5: 3–5 days.
- Phase 6: 4–7 days.
- Phase 7: 3–10 days depending on quick-only vs named tunnel automation.
- Phase 8: 1–2 weeks.
- Phase 9: 1–2 weeks.

Practical milestones:

- Minimal useful Beta: about 2 weeks.
- Production preview: about 4–6 weeks.
- Full productization with robust Tauri, signing, and named tunnel automation: 6–8+ weeks.

## Self-Review Notes

- This plan intentionally starts with Docker/server runtime because it is the closest deployable path.
- Tauri work is isolated to later phases because the Rust bridge currently has many no-op/static responses and uses different filesystem/process/security semantics.
- The plan avoids arbitrary shell strings. Real execution must pass command and argument arrays through `command-runner.ts`.
- Existing UI pages should keep explicit placeholder messaging until the corresponding backend milestone passes its acceptance criteria.
