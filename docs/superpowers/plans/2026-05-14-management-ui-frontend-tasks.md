# Management UI Frontend Task Tracker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track the management UI PRD as staged, checkable work so each completed phase can be marked with `[x]` after verification.

**Architecture:** Keep the React UI shared across server Web and Tauri desktop runtimes. All UI features must call `ManagementClient`; runtime-specific behavior stays behind the server HTTP client, Tauri invoke client, and backend/runtime adapters. The tracker separates already completed foundations from remaining interactive product loops.

**Tech Stack:** TypeScript, React 19, Bun test, Vite, Tauri, `ManagementClient`, server HTTP APIs, Tauri invoke bridge.

---

## Source Documents

- Product PRD: `docs/superpowers/specs/2026-05-14-management-ui-frontend-prd.md`
- Dual-runtime architecture plan: `docs/superpowers/plans/2026-05-11-management-ui-dual-runtime.md`
- Dashboard state plan: `docs/superpowers/plans/2026-05-14-dashboard-state.md`

---

## How To Use This Tracker

- Treat each `Task N` heading as one phase.
- Mark the phase checkbox as `[x]` only after every subtask in that phase is done and the phase verification commands pass.
- If a phase is split into smaller delivery slices, add nested checkboxes under that phase before marking the phase complete.
- Do not mark a phase complete because files exist; mark it complete because the user-facing behavior and tests meet the acceptance checklist.
- Commit checkpoints require an explicit user request before running `git commit` or `git push`.

---

## Phase Status Overview

- [x] **Task 0: PRD and architecture baseline**
- [x] **Task 1: Runnable shared frontend shell and Dashboard foundation**
- [x] **Task 2: Upgrade feature skeletons into real interactive React pages**
- [x] **Task 3: Shared async action, job, error, and refresh infrastructure**
- [x] **Task 4: Tools detection, install, process control, and logs loop**
- [x] **Task 5: Config, preset, backup, and restore loop**
- [x] **Task 6: Endpoint management and safety-check loop**
- [ ] **Task 7: FRP server/client management loop**
- [ ] **Task 8: Cloudflare Tunnel quick/named flow**
- [ ] **Task 9: Settings, security checks, backup summary, and diagnostics export**
- [ ] **Task 10: Cross-feature integration, acceptance pass, and release readiness**

---

## Task 0: PRD and Architecture Baseline

**Status:** Complete.

**Purpose:** Establish the product target, runtime boundary, and high-level implementation direction.

**Files:**

- Complete: `docs/superpowers/specs/2026-05-14-management-ui-frontend-prd.md`
- Complete: `docs/superpowers/plans/2026-05-11-management-ui-dual-runtime.md`
- Complete: `docs/superpowers/plans/2026-05-14-dashboard-state.md`
- Complete: `docs/superpowers/plans/2026-05-14-management-ui-frontend-tasks.md`

**Checklist:**

- [x] Define product goals, non-goals, user roles, server Web mode, and Tauri desktop mode.
- [x] Define capability-driven UI behavior using `RuntimeCapabilities`.
- [x] Define functional domains: Dashboard, Tools, Config, Endpoints, FRP, Settings, Logs / Jobs.
- [x] Define safety rules: explicit actions, endpoint disabled by default, high-risk confirmations, no frontend secret persistence.
- [x] Create this staged task tracker from the PRD.

**Verification:**

- [x] PRD exists and contains acceptance sections for Dashboard, Tools, Config, Endpoints, FRP, and security.
- [x] Tracker has one parent checkbox per implementation phase.

---

## Task 1: Runnable Shared Frontend Shell and Dashboard Foundation

**Status:** Complete.

**Purpose:** Make the frontend launch through the shared runtime boundary and provide a resilient Dashboard foundation.

**Files:**

- Complete: `src/ui/main.tsx`
- Complete: `src/ui/app/ManagementDashboardApp.tsx`
- Complete: `src/ui/app/ManagementDashboardApp.test.tsx`
- Complete: `src/ui/browser-management-client.ts`
- Complete: `src/ui/api/server-management-client.ts`
- Complete: `src/ui/api/tauri-management-client.ts`
- Complete: `src/ui/features/dashboard/DashboardView.tsx`
- Complete: `src/ui/features/dashboard/DashboardView.test.tsx`
- Complete: `src/ui/features/dashboard/dashboard-view-model.ts`
- Complete: `src/ui/features/dashboard/dashboard-view-model.test.ts`
- Complete: `src/ui/features/dashboard/use-dashboard-state.ts`
- Complete: `src/ui/features/dashboard/use-dashboard-state.test.tsx`
- Complete: `bunfig.toml`
- Complete: `tests/happydom.ts`

**Checklist:**

- [x] Render the React entry without preloading Dashboard data outside React.
- [x] Create browser runtime selection between server HTTP and Tauri invoke clients.
- [x] Keep `ManagementClient` as the only frontend API boundary.
- [x] Add Dashboard initial loading state.
- [x] Add Dashboard initial error and retry behavior.
- [x] Add Dashboard manual refresh behavior.
- [x] Preserve last successful Dashboard data when refresh fails.
- [x] Add stale request protection for concurrent refreshes.
- [x] Add unmount cleanup for Dashboard state updates.
- [x] Render runtime capability matrix from `RuntimeCapabilities`.
- [x] Add React DOM test environment with `happy-dom`.

**Verification:**

- [x] Dashboard targeted tests passed: `15 pass / 0 fail`.
- [x] Full test suite passed: `86 pass / 0 fail`.
- [x] `bun run typecheck` passed.
- [x] `bun run build:ui` passed.
- [x] `bun run build` passed.

---

## Task 2: Upgrade Feature Skeletons Into Real Interactive React Pages

**Status:** Complete.

**Purpose:** Convert the remaining string/logic skeletons into real React DOM pages while preserving the existing feature boundaries.

**Files:**

- Modify: `src/ui/app/App.tsx`
- Modify: `src/ui/routes/routes.tsx`
- Modify: `src/ui/layout/AppLayout.tsx`
- Modify: `src/ui/features/tools/ToolsPage.tsx`
- Modify: `src/ui/features/config/ConfigPage.tsx`
- Modify: `src/ui/features/endpoints/EndpointsPage.tsx`
- Modify: `src/ui/features/frp/FrpPage.tsx`
- Modify: `src/ui/features/frp/ServerFrpPanel.tsx`
- Modify: `src/ui/features/frp/ClientFrpPanel.tsx`
- Modify: `src/ui/features/frp/FrpStatusCard.tsx`
- Modify: `src/ui/features/frp/FrpConnectionCard.tsx`
- Modify: `src/ui/features/settings/SettingsPage.tsx`
- Test: `src/ui/features/management-pages.test.tsx`
- Test: feature-specific `*.test.tsx` files beside each page.

**Checklist:**

- [x] Confirm skeleton feature files exist for Dashboard, Tools, Config, Endpoints, FRP, and Settings.
- [x] Render app navigation through real React elements instead of string-only page output.
- [x] Render Tools page as DOM sections for detections, instances, actions, and logs.
- [x] Render Config page as DOM sections for target selection, editor, presets, and backups.
- [x] Render Endpoints page as DOM sections for list, create/edit state, validation, enable, disable, and diagnostics.
- [x] Render FRP page as DOM sections that branch on `canManageFrpServer` and `canManageFrpClient`.
- [x] Render Settings page as DOM sections for runtime, security, backups, and diagnostics.
- [x] Keep visual styling minimal; this phase validates behavior and structure, not visual design polish.
- [x] Add tests that query DOM roles/text rather than comparing raw strings.

**Acceptance:**

- [x] Browser/Tauri shell can navigate to each primary feature domain.
- [x] Unsupported capabilities are visible as disabled/unavailable states with reasons.
- [x] No page calls shell, filesystem, systemd, or Tauri APIs directly; pages use `ManagementClient` only.
- [x] Existing Dashboard behavior remains unchanged.

**Verification:**

- [x] Run: `bun test src/ui/features/management-pages.test.tsx`
- [x] Run feature tests touched in this phase.
- [x] Run: `bun run typecheck`
- [x] Run: `bun run build:ui`

---

## Task 3: Shared Async Action, Job, Error, and Refresh Infrastructure

**Status:** Complete.

**Purpose:** Create reusable UI infrastructure for long-running actions so every feature handles pending, success, failure, retry, and refresh consistently.

**Files:**

- Create or modify: `src/ui/app/page-loaders.ts`
- Create: `src/ui/app/action-runner.ts`
- Create: `src/ui/app/action-runner.test.ts`
- Create: `src/ui/components/AsyncActionStatus.tsx`
- Create: `src/ui/components/AsyncActionStatus.test.tsx`
- Create: `src/ui/components/ErrorState.tsx`
- Create: `src/ui/components/ErrorState.test.tsx`
- Modify: `src/management-api/client.ts`

**Checklist:**

- [x] Define a shared action state model: `idle`, `pending`, `succeeded`, `failed`.
- [x] Represent job states from the PRD: `queued`, `running`, `succeeded`, `failed`.
- [x] Ensure write operations never use optimistic success; only show temporary pending until backend result or refresh.
- [x] Add a reusable error display with request target, status code when present, retry availability, and reauth hint.
- [x] Add a reusable refresh helper that preserves unsaved form state.
- [x] Add mutual-exclusion guards so the same resource cannot receive duplicate conflicting actions while pending.
- [x] Add tests for pending, success, failure, retry, and duplicate-submit prevention.

**Acceptance:**

- [x] Tools, Config, Endpoints, FRP, and Settings can share the same action/error pattern.
- [x] 401/403 handling stops sensitive follow-up requests and preserves unsaved form input.
- [x] Network failures preserve the most recent successful data and allow retry.

**Verification:**

- [x] Run: `bun test src/ui/app/action-runner.test.ts src/ui/components/AsyncActionStatus.test.tsx src/ui/components/ErrorState.test.tsx`
- [x] Run: `bun run typecheck`
- [x] Run: `bun run build:ui`

---

## Task 4: Tools Detection, Install, Process Control, and Logs Loop

**Status:** Complete.

**Purpose:** Make Tools usable for detection, supported installation, start/stop/restart, and log viewing.

**Files:**

- Modify: `src/ui/features/tools/ToolsPage.tsx`
- Create: `src/ui/features/tools/use-tools-state.ts`
- Create: `src/ui/features/tools/use-tools-state.test.tsx`
- Modify: `src/management-api/client.ts`
- Modify: `src/ui/api/server-management-client.ts`
- Modify: `src/ui/api/tauri-management-client.ts`
- Modify: relevant server/Tauri runtime handlers when frontend contract changes require backend support.

**Checklist:**

- [x] Display detection entries for OpenCode, Bun, oh-my-openagent, frpc, cloudflared, Docker/Compose, and Caddy when returned by the runtime.
- [x] Add explicit Detect action; do not run detection automatically on initial app load.
- [x] Display tool instances with ID, kind, display name, host type, install state, run state, default port, current port, and config directory.
- [x] Show install action only when the runtime supports installation and the tool is missing.
- [x] Confirm install target, version, and affected paths before submitting install.
- [x] Add start, stop, and restart actions for supported instances.
- [x] Prevent duplicate action submission for the same instance while pending.
- [x] Refresh tool instances and detection after successful install.
- [x] Refresh tool instances, logs, and Dashboard after successful start/stop/restart.
- [x] Show port-occupied and missing-password guidance when those failure reasons are returned.
- [x] Display tool logs by instance with time, level, and redacted message.

**Acceptance:**

- [x] User can detect tools manually.
- [x] User can install a supported missing tool only after confirmation.
- [x] User can start, stop, and restart supported tool instances.
- [x] Failed operations show a readable reason and a retry path.
- [x] Logs are redacted before display.

**Verification:**

- [x] Run: `bun test src/ui/features/tools`
- [x] Run: `bun run typecheck`
- [x] Run: `bun run build:ui`

---

## Task 5: Config, Preset, Backup, and Restore Loop

**Status:** Complete.

**Purpose:** Let users read, edit, validate, save, preset, backup, and restore OpenCode and oh-my-openagent configuration safely.

**Files:**

- Modify: `src/ui/features/config/ConfigPage.tsx`
- Create: `src/ui/features/config/use-config-state.ts`
- Create: `src/ui/features/config/use-config-state.test.tsx`
- Create: `src/ui/features/config/config-validation.ts`
- Create: `src/ui/features/config/config-validation.test.ts`
- Modify: `src/management-api/client.ts`
- Modify: `src/ui/api/server-management-client.ts`
- Modify: `src/ui/api/tauri-management-client.ts`
- Modify: relevant server/Tauri runtime handlers when frontend contract changes require backend support.

**Checklist:**

- [x] List configuration targets for OpenCode and oh-my-openagent.
- [x] Read config content, updated time, path, and missing/error state.
- [x] Allow creating config when the target reports a missing config file.
- [x] Add editor state that preserves unsaved user input across refresh failures.
- [x] Validate empty content before submit.
- [x] Validate JSON content in the frontend when the config format is JSON.
- [x] Submit TOML/YAML content to backend validation and display backend field errors.
- [x] Reject obvious pasted log fragments containing unredacted secret-like values.
- [x] Confirm overwrite before saving over existing content.
- [x] Refresh config after successful save.
- [x] List presets and confirm preset name, target, affected range, and backup behavior before apply.
- [x] Refresh config after successful preset apply.
- [x] List backups with backup ID, created time, target, and path.
- [x] Confirm restore target, backup ID, overwrite warning, and pre-restore backup behavior before restore.
- [x] Refresh config and backup list after successful restore.

**Acceptance:**

- [x] User can read OpenCode and oh-my-openagent config.
- [x] User can edit and save config without losing input on failure.
- [x] User can apply presets with confirmation.
- [x] User can restore backups with confirmation.
- [x] Config write failures do not overwrite the previous valid config.

**Verification:**

- [x] Run: `bun test src/ui/features/config`
- [x] Run: `bun run typecheck`
- [x] Run: `bun run build:ui`

---

## Task 6: Endpoint Management and Safety-Check Loop

**Status:** Complete.

**Purpose:** Make public endpoint management safe and usable, with disabled-by-default behavior and explicit safety checks before exposure.

**Files:**

- Modify: `src/ui/features/endpoints/EndpointsPage.tsx`
- Create: `src/ui/features/endpoints/use-endpoints-state.ts`
- Create: `src/ui/features/endpoints/use-endpoints-state.test.tsx`
- Create: `src/ui/features/endpoints/EndpointForm.tsx`
- Create: `src/ui/features/endpoints/EndpointForm.test.tsx`
- Modify: `src/management-api/client.ts`
- Modify: `src/ui/api/server-management-client.ts`
- Modify: `src/ui/api/tauri-management-client.ts`
- Modify: relevant server/Tauri runtime handlers when frontend contract changes require backend support.

**Checklist:**

- [x] Display endpoint list with ID, name, domain or URL, protocol, target type, target tool instance, auth mode, and status.
- [x] Support endpoint types: `server-local`, `desktop-frp`, and `cloudflare` when returned by runtime capabilities.
- [x] Create new endpoints in disabled state by default.
- [x] Edit endpoint name, domain or URL, protocol, target type, target instance, and auth mode.
- [x] Validate domain or URL format before save.
- [x] Validate target tool instance exists before save.
- [x] Validate auth mode satisfies safety requirements before save.
- [x] Validate target type is compatible with current runtime mode before save.
- [x] Run safety checks before enable: OpenCode running, password configured, endpoint auth configured, FRP/Cloudflare available, target port reachable, public address generatable, no obvious endpoint conflict.
- [x] Block enable when any safety check fails.
- [x] Preserve endpoint previous state if enable fails.
- [x] Confirm disable and preserve endpoint configuration after disable.
- [x] Add endpoint diagnostics with target running, local port, FRP/Cloudflare reachability, auth completeness, recent error, and fix suggestion.

**Acceptance:**

- [x] User can list, create, edit, enable, disable, and diagnose endpoints.
- [x] Unsafe endpoints cannot be enabled.
- [x] Endpoint enable success shows public URL and auth mode.
- [x] Disable does not delete endpoint configuration.

**Verification:**

- [x] Run: `bun test src/ui/features/endpoints`
- [x] Run: `bun run typecheck`
- [x] Run: `bun run build:ui`

---

## Task 7: FRP Server/Client Management Loop

**Status:** Not complete.

**Purpose:** Complete FRP management for server and desktop modes so FRP status, configuration, start/stop, and failure guidance are usable.

**Files:**

- Modify: `src/ui/features/frp/FrpPage.tsx`
- Modify: `src/ui/features/frp/ServerFrpPanel.tsx`
- Modify: `src/ui/features/frp/ClientFrpPanel.tsx`
- Modify: `src/ui/features/frp/EndpointRouteForm.tsx`
- Modify: `src/ui/features/frp/FrpConnectionCard.tsx`
- Modify: `src/ui/features/frp/FrpStatusCard.tsx`
- Modify: `src/ui/features/frp/frp-panel-actions.ts`
- Create: `src/ui/features/frp/use-frp-state.ts`
- Create: `src/ui/features/frp/use-frp-state.test.tsx`
- Modify: `src/management-api/client.ts`
- Modify: `src/ui/api/server-management-client.ts`
- Modify: `src/ui/api/tauri-management-client.ts`
- Modify: relevant server/Tauri runtime handlers when frontend contract changes require backend support.

**Checklist:**

- [x] Keep FRP page branching based on `RuntimeCapabilities`.
- [ ] Server mode displays frp-panel URL, RPC URL, server address, bind port, dashboard status, client list, and desktop connection information.
- [ ] Server mode validates panel URL, RPC URL, server address, bind port, auth token ref, and masked token behavior before save.
- [ ] Server mode supports saving FRP server configuration.
- [ ] Server mode supports starting and stopping FRP server when capability allows it.
- [ ] Desktop mode displays server address, server port, token ref or imported connection config, local OpenCode port, subdomain/proxy name, generated frpc config, public URL, and connection status.
- [ ] Desktop mode validates OpenCode running, local port reachable, server address present, token ref present, subdomain/proxy name legal, and frpc binary available before start.
- [ ] Desktop mode supports saving FRP client configuration.
- [ ] Desktop mode supports starting and stopping frpc when capability allows it.
- [ ] Map FRP failure reasons to guidance: `auth_failed`, `api_unreachable`, `rpc_unreachable`, `proxy_not_ready`, `local_service_unreachable`, `client_not_ready`, `timeout`, and `unknown`.
- [ ] Refresh FRP status and endpoints after successful FRP start/stop.

**Acceptance:**

- [ ] Server runtime only shows FRP server operations.
- [ ] Desktop runtime only shows FRP client operations.
- [ ] Unavailable runtime blocks FRP actions and explains why.
- [ ] FRP failures provide actionable suggestions.

**Verification:**

- [ ] Run: `bun test src/ui/features/frp`
- [ ] Run: `bun run typecheck`
- [ ] Run: `bun run build:ui`

---

## Task 8: Cloudflare Tunnel Quick/Named Flow

**Status:** Not complete.

**Purpose:** Add Cloudflare Tunnel UI flows described by the PRD without coupling the frontend directly to shell commands.

**Files:**

- Create: `src/ui/features/cloudflare/CloudflareTunnelPage.tsx`
- Create: `src/ui/features/cloudflare/CloudflareTunnelPage.test.tsx`
- Create: `src/ui/features/cloudflare/use-cloudflare-tunnel-state.ts`
- Create: `src/ui/features/cloudflare/use-cloudflare-tunnel-state.test.tsx`
- Modify: `src/ui/routes/routes.tsx`
- Modify: `src/management-api/client.ts`
- Modify: `src/ui/api/server-management-client.ts`
- Modify: `src/ui/api/tauri-management-client.ts`
- Modify: relevant server/Tauri runtime handlers when frontend contract changes require backend support.

**Checklist:**

- [ ] Add route entry for Cloudflare Tunnel when runtime capabilities expose tunnel support.
- [ ] Quick tunnel flow lets user choose local port and shows local target address.
- [ ] Quick tunnel flow shows command summary, generated temporary public URL when available, cloudflared detection state, and errors.
- [ ] Named tunnel flow collects hostname, tunnel name, local target port, and DNS route information.
- [ ] Named tunnel flow displays step states for login, create tunnel, configure DNS, write config, start tunnel, and verify public access.
- [ ] Each named tunnel step supports success, failure, and retry states.
- [ ] UI never directly executes shell commands; it requests runtime actions through `ManagementClient`.

**Acceptance:**

- [ ] User can understand both quick and named tunnel flows from the UI.
- [ ] Failure state identifies the failed step and offers retry.
- [ ] No secret or command output is displayed without redaction.

**Verification:**

- [ ] Run: `bun test src/ui/features/cloudflare`
- [ ] Run: `bun run typecheck`
- [ ] Run: `bun run build:ui`

---

## Task 9: Settings, Security Checks, Backup Summary, and Diagnostics Export

**Status:** Not complete.

**Purpose:** Finish Settings as the safety and diagnostics hub for runtime information, security posture, backups, and redacted diagnostics.

**Files:**

- Modify: `src/ui/features/settings/SettingsPage.tsx`
- Create: `src/ui/features/settings/use-settings-state.ts`
- Create: `src/ui/features/settings/use-settings-state.test.tsx`
- Create: `src/ui/features/settings/diagnostics-export.ts`
- Create: `src/ui/features/settings/diagnostics-export.test.ts`
- Modify: `src/management-api/client.ts`
- Modify: `src/ui/api/server-management-client.ts`
- Modify: `src/ui/api/tauri-management-client.ts`
- Modify: relevant server/Tauri runtime handlers when frontend contract changes require backend support.

**Checklist:**

- [ ] Display current runtime mode.
- [ ] Display platform version.
- [ ] Display config root directory when available.
- [ ] Display capability matrix or link to capability details.
- [ ] Display management API address in server mode.
- [ ] Display Tauri bridge status in desktop mode.
- [ ] Display security checks: OpenCode password, endpoint auth, FRP token ref, cleartext secret risk, log redaction, backup availability.
- [ ] Display backup count, last backup time, backup directory, and backup failure records.
- [ ] Add manual backup action when runtime supports it.
- [ ] Add backup restore entry point or link to Config restore flow.
- [ ] Add old-backup cleanup action only when backend reports support.
- [ ] Export diagnostics containing runtime info, tool detection, endpoint status, FRP status, recent job results, and redacted logs.
- [ ] Ensure exported diagnostics never contain cleartext secrets.

**Acceptance:**

- [ ] Settings explains current runtime and security posture.
- [ ] Diagnostics export is useful for debugging and redacted by default.
- [ ] Backup actions are capability-gated and confirmed before high-risk operations.

**Verification:**

- [ ] Run: `bun test src/ui/features/settings`
- [ ] Run: `bun run typecheck`
- [ ] Run: `bun run build:ui`

---

## Task 10: Cross-Feature Integration, Acceptance Pass, and Release Readiness

**Status:** Not complete.

**Purpose:** Verify the full management UI satisfies the PRD as an integrated product, not only as isolated pages.

**Files:**

- Modify: `src/ui/app/App.tsx`
- Modify: `src/ui/routes/routes.tsx`
- Modify: `src/ui/app/page-loaders.ts`
- Create or modify: `src/ui/app/management-ui-acceptance.test.tsx`
- Modify: `docs/guide/management-ui.md`
- Modify: `README.md` if the user-facing startup flow changes.

**Checklist:**

- [ ] Verify browser/server mode starts and calls server `ManagementClient`.
- [ ] Verify Tauri desktop mode starts and calls Tauri `ManagementClient`.
- [ ] Verify no-backend or unreachable-backend state shows a readable error.
- [ ] Verify Dashboard summarizes tools, endpoints, FRP, runtime, suggestions, refresh state, and stale-data warning.
- [ ] Verify Tools, Config, Endpoints, FRP, Cloudflare, and Settings each support manual refresh without losing unsaved form input.
- [ ] Verify all high-risk actions require confirmation.
- [ ] Verify no frontend path stores `password`, `token`, `secret`, Authorization headers, Basic Auth credentials, or secret query strings in localStorage.
- [ ] Verify all displayed logs and diagnostics are redacted.
- [ ] Verify server-only operations do not appear as executable desktop actions.
- [ ] Verify desktop-only operations do not appear as executable server actions.
- [ ] Update user docs for starting the management UI and understanding capability-gated behavior.
- [ ] Run final code review with focus on security, capability gating, and regression risk.

**Acceptance:**

- [ ] PRD §19.1 base runtime acceptance passes.
- [ ] PRD §19.2 Dashboard acceptance passes.
- [ ] PRD §19.3 Tools acceptance passes.
- [ ] PRD §19.4 Config acceptance passes.
- [ ] PRD §19.5 Endpoints acceptance passes.
- [ ] PRD §19.6 FRP acceptance passes.
- [ ] PRD §19.7 Security acceptance passes.

**Verification:**

- [ ] Run: `bun test`
- [ ] Run: `bun run typecheck`
- [ ] Run: `bun run build:ui`
- [ ] Run: `bun run build`
- [ ] Run: `bun run lint` if the script remains available.
- [ ] Run: `bun run smoke` if the environment supports the smoke target.

---

## Current Recommended Next Phase

Start with **Task 2: Upgrade Feature Skeletons Into Real Interactive React Pages**, then immediately do **Task 3: Shared Async Action, Job, Error, and Refresh Infrastructure**.

Reason: the repository already has runtime contracts, Dashboard state, feature skeleton files, and several domain-specific pages. The next blocking gap is turning the non-Dashboard feature skeletons into real user-operable React pages and giving them a shared action/job/error pattern before adding many write operations.

---

## Completion Rules

- A phase is complete only when its checklist, acceptance list, and verification commands pass.
- If verification fails, leave the phase unchecked, fix the root cause, and rerun the failed verification.
- If a phase requires backend or Tauri capability not yet present, add the exact missing `ManagementClient` method and runtime handler to that phase before marking it complete.
- Do not remove failing tests to mark a phase complete.
- Do not use type suppression to mark a phase complete.
- Do not commit or push a phase unless the user explicitly asks for commit or push.

---

## Self-Review

- Spec coverage: This tracker maps the PRD domains to staged work: Dashboard, Tools, Config, Endpoints, FRP, Cloudflare Tunnel, Settings, Jobs, errors, refresh strategy, security, and final acceptance.
- Placeholder scan: The tracker contains no deferred placeholder sections; every unchecked phase has concrete files, behavior, acceptance, and verification commands.
- Type consistency: The tracker consistently uses the existing `ManagementClient`, `RuntimeCapabilities`, runtime client, and feature directory boundaries already present in the repository.
