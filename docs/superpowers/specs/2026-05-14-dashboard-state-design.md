# Dashboard State Design

## Goal

Turn the current one-shot Dashboard render into a resilient Dashboard experience that supports initial loading, localized error recovery, manual refresh, refresh failure handling, and a visible runtime capability matrix.

## Current Context

- `src/ui/main.tsx` currently waits for `loadDashboardViewModel(createBrowserManagementClient())` before rendering React.
- If boot loading fails, `main.tsx` replaces `#root` with a plain error message.
- `src/ui/app/ManagementDashboardApp.tsx` currently receives a fully-loaded `DashboardViewModel` prop and renders a static shell.
- `src/ui/features/dashboard/DashboardView.tsx` renders runtime summary, endpoint summary, FRP status, and recent logs, but only uses `runtimeInfo.capabilities.mode`.
- `src/ui/features/dashboard/dashboard-view-model.ts` is already the correct data boundary for Dashboard state: `runtimeInfo`, `frpStatus`, and `logs`.

## Approved Approach

Implement the Dashboard state loop before starting the Tools page. This keeps the first real React app reliable before layering on mutating tool actions.

Rejected alternatives:

- Build Tools first: faster visible feature progress, but leaves the app with a fragile boot path and no in-app recovery.
- Build Dashboard and Tools together: larger product jump, but increases regression risk and blurs the state-management pattern before it is proven.

## Architecture

Move Dashboard loading from `main.tsx` into the React app shell. `main.tsx` should only create a `ManagementClient` and render `ManagementDashboardApp`. The app shell owns Dashboard state through a small controller/hook that wraps `loadDashboardViewModel(client)` and exposes:

- `dashboard`: latest successful `DashboardViewModel`, if any
- `isLoading`: true only for the first load when no data exists
- `isRefreshing`: true when reloading while existing data remains visible
- `errorMessage`: current load or refresh error text
- `lastUpdated`: timestamp of the latest successful load
- `refresh()`: manual refresh action

This keeps API calls behind `ManagementClient` and keeps rendering components focused on UI state.

## User Interaction

- Initial load shows a Dashboard loading state inside the app shell instead of a blank root.
- Initial load failure keeps the shell visible and shows a retry action.
- Manual refresh keeps the previous Dashboard data visible while the refresh is running.
- Refresh success replaces the Dashboard data and updates `lastUpdated`.
- Refresh failure keeps the previous Dashboard data visible and shows a non-destructive error message with retry.
- The header exposes a refresh button and a last-updated hint when data has loaded.

## Capability Matrix

`DashboardView.tsx` should render a capability matrix based on `RuntimeInfo.capabilities`:

- 运行模式: `server` → `服务器模式`, `desktop` → `桌面模式`
- FRP Server 管理: `canManageFrpServer`
- FRP Client 管理: `canManageFrpClient`
- 系统服务安装: `canInstallServerServices`
- 本地文件访问: `canAccessLocalFilesystem`
- systemd 管理: `canManageSystemd`
- 本地进程管理: `canManageLocalProcesses`

Each capability should be rendered as enabled/disabled text so it is testable with static markup. No new backend API is required.

## Error Handling

- Convert unknown thrown values with `error instanceof Error ? error.message : "主控台数据加载失败。"`.
- Do not clear existing Dashboard data on refresh failure.
- Do not leak tokens or secrets in rendered logs; keep the existing `redactSensitiveText()` path in `DashboardView.tsx`.
- Keep the global `boot().catch()` in `main.tsx` only for unrecoverable render setup failures, such as a missing `#root` element.

## Testing

Add or update tests for:

- Initial shell loading state.
- Initial load failure with retry affordance.
- Successful initial load renders Dashboard data.
- Manual refresh calls the loader and updates rendered data.
- Refresh failure retains previously rendered data while showing an error.
- Capability matrix renders all runtime flags.
- `main.tsx` no longer calls `loadDashboardViewModel()` before React render.

## Scope Boundary

This design does not implement Tools page actions, polling, streaming logs, endpoint editing, or visual style changes. Those follow after Dashboard loading and recovery are stable.
