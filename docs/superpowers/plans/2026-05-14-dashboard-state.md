# Dashboard State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the React Dashboard resilient by adding initial loading, in-app error retry, manual refresh, refresh failure preservation, last-updated metadata, and a runtime capability matrix.

**Architecture:** Keep `ManagementClient` as the only API boundary and keep `loadDashboardViewModel()` as the Dashboard data loader. Add a focused React controller hook for Dashboard state, render app-shell loading/error/refresh controls from `ManagementDashboardApp`, and extend `DashboardView` with a testable capability matrix.

**Tech Stack:** TypeScript, React 19, Bun test, `react-dom/client`, Vite, existing `ManagementClient` and `DashboardViewModel` types.

---

## File Structure

- Create: `src/ui/features/dashboard/use-dashboard-state.ts`
  - Owns first load, manual refresh, error message conversion, last-updated state, stale request guards, and unmount cleanup.
- Create: `src/ui/features/dashboard/use-dashboard-state.test.tsx`
  - Exercises the hook through a small test component rendered with React DOM and Bun tests.
- Modify: `src/ui/app/ManagementDashboardApp.tsx`
  - Accepts a `ManagementClient`, uses the hook, renders refresh/retry controls, and passes loaded data into `DashboardView`.
- Modify: `src/ui/app/ManagementDashboardApp.test.tsx`
  - Verifies shell loading, success, initial failure, and refresh failure preservation.
- Modify: `src/ui/features/dashboard/DashboardView.tsx`
  - Adds a capability matrix based on `RuntimeInfo.capabilities`.
- Modify: `src/ui/features/dashboard/DashboardView.test.tsx`
  - Verifies capability labels and enabled/disabled values.
- Modify: `src/ui/main.tsx`
  - Renders `ManagementDashboardApp` immediately with `createBrowserManagementClient()` instead of awaiting Dashboard data before React render.
- Modify: `src/ui/frontend-shell.test.ts`
  - Updates shell contract to expect client creation/rendering without preloading Dashboard data.

---

## Verification Results

- Targeted Dashboard tests passed: `15 pass / 0 fail`.
- Full test suite passed: `86 pass / 0 fail`.
- `bun run typecheck` passed.
- `bun run build:ui` passed.
- `bun run build` passed.
- Oracle review passed after stale request and transient flag fixes.

---

## Self-Review

- Spec coverage: The implementation covers initial loading, in-app error retry, manual refresh, refresh failure preservation, last-updated metadata, capability matrix rendering, stale request protection, unmount cleanup, and entry-point simplification.
- Placeholder scan: No incomplete sections or deferred implementation notes remain.
- Type consistency: The implementation uses existing `ManagementClient`, `DashboardViewModel`, `RuntimeInfo`, `FrpStatus`, and `LogLine` types and does not introduce backend API changes.
