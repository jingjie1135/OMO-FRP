# Docker and Tauri CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CI/CD workflows that verify and produce Docker deployment images and unsigned Tauri desktop artifacts.

**Architecture:** Keep fast verification in the existing `ci.yml`, and add separate release workflows for Docker and Tauri because they use different runners, permissions, and failure modes. Docker publishes a GHCR image from `deploy/server/Dockerfile`; Tauri builds unsigned workflow artifacts from the existing `src-tauri` app.

**Tech Stack:** GitHub Actions, Bun, Vite, Docker Buildx, GHCR, Tauri v2, Rust stable, `@tauri-apps/cli`, `actions/upload-artifact@v4`.

---

## File Map

- Modify `.github/workflows/ci.yml`: add UI build, lint, smoke, Rust check, and Docker build verification.
- Create `.github/workflows/docker-release.yml`: publish the server runtime Docker image to GHCR on manual/default-branch/tag events.
- Create `.github/workflows/tauri-release.yml`: build unsigned desktop artifacts on manual/tag events.
- Modify `package.json`: add `@tauri-apps/cli`, `tauri`, and `build:desktop`.
- Modify `src-tauri/tauri.conf.json`: enable Tauri bundling.
- Modify `README.md`: document CI/CD release outputs and unsigned artifact scope.
- Modify `docs/guide/management-ui.md`: mention Tauri desktop artifact build path if release/readiness docs are present.
- Reference `docs/superpowers/specs/2026-05-18-docker-tauri-cicd-design.md`: source design.

## Task 1: Strengthen Base CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add UI, lint, smoke, Rust, and Docker checks to CI**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun test

      - name: Typecheck
        run: bun run typecheck

      - name: Build CLI
        run: bun run build

      - name: Build UI
        run: bun run build:ui

      - name: Lint
        run: bun run lint

      - name: Smoke test
        run: bun run smoke

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri -> target

      - name: Install Linux Tauri dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Check Tauri Rust crate
        working-directory: src-tauri
        run: cargo check

      - name: Build server Docker image
        run: docker build -f deploy/server/Dockerfile deploy/server
```

- [ ] **Step 2: Validate workflow syntax by running local verification commands**

Run:

```bash
bun test
bun run typecheck
bun run build
bun run build:ui
bun run lint
bun run smoke
(cd src-tauri && cargo check)
docker build -f deploy/server/Dockerfile deploy/server
```

Expected:

- Bun tests pass with zero failures.
- TypeScript check exits 0.
- CLI and UI builds exit 0.
- Smoke exits 0.
- `cargo check` exits 0.
- Docker image build exits 0.

## Task 2: Add Docker Image Release Workflow

**Files:**
- Create: `.github/workflows/docker-release.yml`

- [ ] **Step 1: Create Docker release workflow**

Create `.github/workflows/docker-release.yml` with:

```yaml
name: Docker Release

on:
  workflow_dispatch:
    inputs:
      push_image:
        description: Push image to GHCR
        required: true
        default: "false"
        type: choice
        options:
          - "false"
          - "true"
  push:
    branches:
      - master
      - main
    tags:
      - "v*"

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: jingjie1135/omo-frp/opencode-remote-server

jobs:
  docker:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v4

      - name: Log in to GitHub Container Registry
        if: github.event_name != 'workflow_dispatch' || inputs.push_image == 'true'
        uses: docker/login-action@v4
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v6
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=edge,branch=$repo.default_branch
            type=ref,event=branch
            type=ref,event=tag
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha
            type=raw,value=manual-${{ github.run_number }},enable=${{ github.event_name == 'workflow_dispatch' }}

      - name: Build and optionally push Docker image
        id: build
        uses: docker/build-push-action@v7
        with:
          context: deploy/server
          file: deploy/server/Dockerfile
          push: ${{ github.event_name != 'workflow_dispatch' || inputs.push_image == 'true' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Summarize image output
        run: |
          {
            echo "## Docker image"
            echo ""
            echo "Image: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}"
            echo "Digest: ${{ steps.build.outputs.digest }}"
            echo ""
            echo 'Tags:'
            echo '${{ steps.meta.outputs.tags }}'
          } >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 2: Verify Docker release workflow can at least build locally**

Run:

```bash
docker build -f deploy/server/Dockerfile deploy/server
```

Expected: Docker build exits 0.

## Task 3: Enable Tauri Bundle Scripts

**Files:**
- Modify: `package.json`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Add Tauri scripts to `package.json`**

Update the `scripts` object in `package.json` so it contains these entries:

```json
{
  "cli": "bun run src/cli-program.ts",
  "smoke": "bun run src/cli-program.ts smoke",
  "test": "bun test src/**/*.test.ts src/**/*.test.tsx",
  "typecheck": "bunx --bun tsc --noEmit",
  "build": "bun build src/cli-program.ts --outfile=dist/opencode-remote.js --target=bun",
  "dev:ui": "bunx --bun vite",
  "build:ui": "bunx --bun vite build",
  "tauri": "bunx @tauri-apps/cli",
  "build:desktop": "bun run build:ui && bunx @tauri-apps/cli build --config '{\"build\":{\"beforeBuildCommand\":\"\"}}'",
  "lint": "bun run typecheck"
}
```

- [ ] **Step 2: Enable Tauri bundling**

Change `src-tauri/tauri.conf.json` from:

```json
"bundle": {
  "active": false,
  "targets": "all"
}
```

to:

```json
"bundle": {
  "active": true,
  "targets": "all"
}
```

- [ ] **Step 3: Verify Tauri prerequisites compile locally**

Run:

```bash
bun run build:ui
(cd src-tauri && cargo check)
```

Expected: UI build and Rust check both exit 0.

## Task 4: Add Tauri Artifact Workflow

**Files:**
- Create: `.github/workflows/tauri-release.yml`

- [ ] **Step 1: Create Tauri release workflow**

Create `.github/workflows/tauri-release.yml` with:

```yaml
name: Tauri Artifacts

on:
  workflow_dispatch:
  push:
    tags:
      - "v*"

jobs:
  build-tauri:
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target aarch64-apple-darwin
            artifact_name: tauri-macos-aarch64
          - platform: macos-latest
            args: --target x86_64-apple-darwin
            artifact_name: tauri-macos-x86_64
          - platform: ubuntu-22.04
            args: ""
            artifact_name: tauri-linux-x86_64
          - platform: windows-latest
            args: ""
            artifact_name: tauri-windows-x86_64

    runs-on: ${{ matrix.platform }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install frontend dependencies
        run: bun install --frozen-lockfile

      - name: Install Rust stable
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: src-tauri -> target

      - name: Install Linux Tauri dependencies
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Build unsigned Tauri artifacts
        run: bun run build:desktop -- --ci --no-sign ${{ matrix.args }}

      - name: Upload unsigned Tauri artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact_name }}
          path: src-tauri/target/**/release/bundle/**/*
          if-no-files-found: error
          retention-days: 14
```

- [ ] **Step 2: Verify local Tauri build entrypoint exists**

Run:

```bash
bun run build:desktop -- --help
```

Expected: The Tauri CLI help/build command is reachable. If the environment cannot build platform installers locally, do not require local full desktop packaging; the workflow matrix will perform platform builds.

## Task 5: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/guide/management-ui.md`

- [ ] **Step 1: Update README verification section**

In `README.md`, extend the verification/release documentation with this content near the existing verification section:

```markdown
## CI/CD 产物

项目的 CI/CD 产物分为 Docker 部署镜像和 Tauri 桌面端产物：

- Docker：`docker-release.yml` 从 `deploy/server/Dockerfile` 构建服务器运行时镜像，并在默认分支或 `v*` tag 上推送到 GHCR。
- Tauri：`tauri-release.yml` 在手动触发或 `v*` tag 上构建 Windows、macOS 和 Linux 桌面端产物。

第一版 Tauri 产物是 unsigned workflow artifacts，不包含 Windows 代码签名、macOS 签名或 notarization。正式签名和 GitHub Release 聚合会在后续阶段单独加入。
```

- [ ] **Step 2: Update management UI guide release readiness section**

In `docs/guide/management-ui.md`, add a short release-readiness note near the build or release section:

```markdown
### Docker 与桌面端产物

管理界面的发布链路不单独发布 UI zip。`bun run build:ui` 是 Tauri 桌面构建的前端输入，也是未来服务器镜像内置管理界面时的内部构建步骤。当前 CI/CD 第一版只面向 Docker 部署镜像和 unsigned Tauri 桌面端 workflow artifacts。
```

## Task 6: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run diagnostics where available**

Run LSP diagnostics on modified TypeScript/JSON/YAML files if the environment has an active language server.

Expected: No TypeScript or JSON errors. If the environment lacks `typescript-language-server`, record that limitation and rely on `bun run typecheck`.

- [ ] **Step 2: Run full local verification**

Run:

```bash
bun test
bun run typecheck
bun run build
bun run build:ui
bun run lint
bun run smoke
(cd src-tauri && cargo check)
docker build -f deploy/server/Dockerfile deploy/server
```

Expected: Every command exits 0.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff -- .github/workflows/ci.yml .github/workflows/docker-release.yml .github/workflows/tauri-release.yml package.json src-tauri/tauri.conf.json README.md docs/guide/management-ui.md docs/superpowers/specs/2026-05-18-docker-tauri-cicd-design.md docs/superpowers/plans/2026-05-18-docker-tauri-cicd.md
```

Expected: Diff contains only Docker/Tauri CI/CD changes, docs, and plan/spec files.

- [ ] **Step 4: Commit only if explicitly requested**

Do not commit unless the user explicitly asks for a commit. If asked, split commits by concern:

1. `ci: 增强基础构建验证`
2. `ci: 增加 Docker 镜像发布流程`
3. `ci: 增加 Tauri 桌面产物流程`
4. `docs: 记录 Docker 与 Tauri 发布设计`
