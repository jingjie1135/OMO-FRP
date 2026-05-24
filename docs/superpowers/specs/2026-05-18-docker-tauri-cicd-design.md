# Docker and Tauri CI/CD Design

Date: 2026-05-18

## Purpose

Add a release-ready CI/CD path for the two product artifacts this project actually needs next:

1. Docker deployment output for the server-side runtime path.
2. Tauri desktop artifacts for Windows, macOS, and Linux.

Standalone CLI bundles, standalone UI downloads, and generic `deploy/server` archive downloads are out of scope for this design. The UI build remains an internal input to the Tauri build and any future server image that serves the management interface.

## Current State

The existing CI workflow is `.github/workflows/ci.yml`. It installs Bun dependencies, runs Bun tests, runs TypeScript typecheck, and builds the CLI bundle. It does not currently verify the UI build, Rust/Tauri code, Docker images, or release artifacts.

Server deployment assets already exist under `deploy/server/`:

- `Dockerfile` builds an OpenCode runtime container from `node:20-slim` and installs `opencode-ai` globally.
- `docker-compose.yml` runs the production server-side support stack: `frp-panel` and `caddy`.
- `docker-compose-local.yml` includes a locally built `opencode` service plus `frp-panel` and `caddy` for local integration.
- `install.sh` installs the production compose template and starts `frp-panel` and `caddy`.
- `healthcheck.sh` verifies the installed compose stack.

The Tauri shell exists under `src-tauri/` with Tauri v2 dependencies. `src-tauri/tauri.conf.json` points Tauri at `../dist/ui` and runs `bun run --cwd .. build:ui` before building, but `bundle.active` is currently `false`, so installer/bundle artifacts are not enabled yet. `package.json` does not currently expose a Tauri build script.

## Goals

- Keep pull request checks fast enough for routine development.
- Verify Docker and Tauri build readiness before release.
- Publish Docker images to GitHub Container Registry on release-oriented refs.
- Produce unsigned Tauri workflow artifacts for supported desktop platforms.
- Keep release signing, notarization, and final GitHub Release automation as later phases.

## Non-Goals

- No standalone CLI artifact publishing.
- No standalone UI artifact publishing.
- No npm publishing.
- No automatic production deployment to a live server.
- No Windows code signing, macOS signing, or macOS notarization in the first version.
- No Tauri updater feed in the first version.

## Proposed Workflow Structure

### 1. Strengthen Base CI

Extend `.github/workflows/ci.yml` so every push and pull request verifies the existing project gates plus build readiness for UI, Rust, and Docker.

Required checks:

- `bun install --frozen-lockfile`
- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run build:ui`
- `bun run lint`
- `bun run smoke`
- `(cd src-tauri && cargo check)`
- Docker build check for `deploy/server/Dockerfile` without pushing an image

The Docker check should build the existing server runtime image from `deploy/server/Dockerfile`. It should not publish from pull requests. Because the base CI runs Tauri checks on Ubuntu, it must install the Linux Tauri system packages before `cargo check`: WebKitGTK, appindicator, librsvg, and patchelf.

### 2. Docker Image Release Workflow

Add `.github/workflows/docker-release.yml` for Docker image publication.

Primary output:

- A GHCR image for the server-side runtime image built from `deploy/server/Dockerfile`.

Recommended image name:

- `ghcr.io/jingjie1135/omo-frp/opencode-remote-server`

Trigger policy:

- `workflow_dispatch`: manually build, with an explicit `push_image` input controlling whether the image is pushed.
- `push` to the default branch: push an `edge` or branch-derived tag.
- `push` tags matching `v*`: push semver tags and `latest` for stable release tags.
- Pull requests are handled by the base CI Docker build check, not by this release workflow.

Recommended actions:

- `docker/login-action@v4` for GHCR login with `GITHUB_TOKEN`.
- `docker/metadata-action@v6` for image tags and OCI labels.
- `docker/setup-buildx-action@v4` for Buildx.
- `docker/build-push-action@v7` for build and push.

Required permissions:

- `contents: read`
- `packages: write` only for events that push images.

Tag policy:

- Branch pushes: sanitized branch name and `sha-<shortsha>`.
- Release tags: `vX.Y.Z`, `X.Y.Z`, optionally `X.Y`, and `latest` for non-prerelease tags.
- Manual runs: `manual-<run_number>` and `sha-<shortsha>`.

The workflow should avoid embedding secrets in the image. Runtime secrets remain in `.env` or the deployment environment.

### 3. Tauri Desktop Artifact Workflow

Add `.github/workflows/tauri-release.yml` for desktop artifacts.

Primary outputs:

- Windows installer artifact.
- macOS artifact.
- Linux artifact.

Trigger policy:

- `workflow_dispatch`: build desktop artifacts on demand.
- `push` tags matching `v*`: build release candidate desktop artifacts.

Pull requests should not run the full desktop artifact matrix by default. PRs should rely on base CI's `cargo check` and UI build unless a future label/manual workflow explicitly requests full desktop packaging.

Recommended actions and commands:

- `actions/checkout@v4`
- `oven-sh/setup-bun@v2`
- `dtolnay/rust-toolchain@stable`
- `swatinem/rust-cache@v2`
- `actions/upload-artifact@v4`
- `bun run build:desktop` using the local `@tauri-apps/cli` package

Recommended matrix:

- `windows-latest`
- `macos-latest` with `--target aarch64-apple-darwin`
- `macos-latest` with `--target x86_64-apple-darwin`
- `ubuntu-22.04`

Linux runners must install Tauri system dependencies before building, including WebKitGTK, appindicator, librsvg, and patchelf packages used by Tauri v2 GitHub examples.

Tauri config changes:

- Set `src-tauri/tauri.conf.json` `bundle.active` to `true`.
- Keep `build.beforeBuildCommand` as `bun run --cwd .. build:ui`.
- Keep `build.frontendDist` as `../dist/ui`.

Package script changes:

- Add dev dependency `@tauri-apps/cli` matching the Tauri v2 CLI line.
- Add `tauri`: `bunx @tauri-apps/cli`.
- Add `build:desktop`: `bun run build:ui && bunx @tauri-apps/cli build --config '{"build":{"beforeBuildCommand":""}}'`.

First-version artifacts are unsigned. The workflow and docs should clearly describe them as unsigned desktop artifacts.

## Data and Build Flow

### Docker Flow

1. Checkout repository.
2. Generate image metadata from GitHub ref.
3. Log in to GHCR for push-capable events.
4. Build `deploy/server/Dockerfile` with Buildx.
5. Push only on configured release-capable events.
6. Surface image digest and tags in the job summary.

### Tauri Flow

1. Checkout repository.
2. Install Bun dependencies.
3. Install Rust toolchain and cache Rust artifacts.
4. Install platform-specific system dependencies.
5. Run `bun run build:desktop` with `--ci --no-sign` and any platform-specific target arguments.
6. Upload `src-tauri/target/**/release/bundle/**/*` as workflow artifacts with `actions/upload-artifact@v4`.

The first version does not create or mutate GitHub Releases. Release assets can be added in a later phase after artifact naming, checksum, signing, and draft-release policy are specified.

## Error Handling and Safety

- Docker workflows must never push images for pull requests from forks.
- GHCR publishing must use `GITHUB_TOKEN`, not hard-coded credentials.
- Runtime secrets must not be baked into images.
- Tauri signing secrets are intentionally absent in the first version.
- Tauri artifacts should be labeled unsigned until signing is added.
- Docker deployment docs should keep `.env.example` as a template only and instruct users to provide real secrets at deploy time.

## Testing and Verification

Local verification before merging the CI/CD work:

- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run build:ui`
- `bun run lint`
- `bun run smoke`
- `(cd src-tauri && cargo check)`
- `docker build -f deploy/server/Dockerfile deploy/server`
- YAML syntax validation by running the workflows in GitHub Actions after push or by using a local action linter if available.

CI verification after merge:

- A pull request run proves tests, UI build, Rust check, and Docker build check pass.
- A manual Docker release run proves GHCR tags and digest are produced.
- A manual Tauri release run proves unsigned desktop artifacts are uploaded.

## Future Phases

1. Add signed Windows and macOS artifacts.
2. Add macOS notarization.
3. Add GitHub Release draft creation with Docker digest and Tauri artifacts.
4. Add checksums for desktop artifacts.
5. Add Tauri updater metadata after release signing exists.
6. Add production deployment automation only after registry, secrets, rollback, and server access controls are specified.
