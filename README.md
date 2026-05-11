# OpenCode Remote Platform

OpenCode Remote Platform is an independent project for installing, configuring, starting, and safely exposing OpenCode over the network. It owns the CLI name `opencode-remote`; `oh-my-openagent` is only an OpenCode plugin that this platform can install/configure as one step in the workflow.

## Quick start

### 1. Server mode: OpenCode + oh-my-openagent plugin + frp-panel

```bash
cd opencode-remote-platform
bun run src/cli-program.ts server-deploy-plan --domain opencode.example.com --email admin@example.com
sudo cp -r deploy/server /opt/opencode-remote-platform-template
sudo /opt/opencode-remote-platform-template/install.sh
```

The server flow is:

1. install OpenCode and Bun on the target host;
2. install/configure the `oh-my-openagent` OpenCode plugin with `bunx oh-my-openagent install --no-tui ...`;
3. set `OPENCODE_SERVER_PASSWORD` and Caddy Basic Auth secrets in `deploy/server/.env.example` copied to `/opt/opencode-remote-platform/.env`;
4. start OpenCode through `opencode-remote.service` on `127.0.0.1:4096`;
5. deploy frp-panel and Caddy from `deploy/server/docker-compose.yml`;
6. publish a password-protected OpenCode URL and frp-panel API/RPC URLs for desktop clients.

### 2. Desktop + server frp-panel

```bash
cd opencode-remote-platform
export OPENCODE_SERVER_PASSWORD='Use-a-strong-password-123!'
opencode serve --hostname 127.0.0.1 --port 4096
bun run src/cli-program.ts remote-access \
  --panel-url https://frp.example.com \
  --auth-token "$FRP_TOKEN" \
  --subdomain alice-code \
  --no-start \
  --no-frpc \
  --output-config ./frpc.toml
```

This generates an frpc TOML config and public URL such as `https://alice-code.frp.example.com`. Remove `--no-frpc` when the local `frpc` binary should be started by the CLI.

### 3. Local OpenCode + Cloudflare Tunnel

```bash
cd opencode-remote-platform
export OPENCODE_SERVER_PASSWORD='Use-a-strong-password-123!'
opencode serve --hostname 127.0.0.1 --port 4096
bun run src/cli-program.ts cloudflare-tunnel --mode quick --port 4096
bun run src/cli-program.ts cloudflare-tunnel --mode named --hostname opencode.example.com --tunnel-name local-opencode
```

The quick mode prints a `cloudflared tunnel --url http://127.0.0.1:4096` command and expects Cloudflare to generate a temporary URL. Named mode prints login, tunnel creation, DNS route, and tunnel run commands.

## CLI

The project CLI is `opencode-remote` / `opencode-remote-platform`.

```bash
bun run src/cli-program.ts help
bun run src/cli-program.ts detect --remote --port 4096
bun run src/cli-program.ts start --remote --port 4096 --public-url https://opencode.example.com
bun run src/cli-program.ts server-deploy-plan --domain opencode.example.com --email admin@example.com
bun run src/cli-program.ts remote-access --panel-url https://frp.example.com --auth-token token --password 'Use-a-strong-password-123!' --subdomain alice-code --no-start --no-frpc
bun run src/cli-program.ts cloudflare-tunnel --password 'Use-a-strong-password-123!' --json
```

## Directory structure

```text
opencode-remote-platform/
  README.md
  package.json
  bin/opencode-remote.js
  src/cli-program.ts
  src/cli/install-config.ts
  src/cli/install-config-types.ts
  src/cli/remote-access/
  src/cli/cloudflare-tunnel/
  src/shared/
  deploy/server/
  docs/guide/server-deployment.md
  docs/reference/cli.md
```

## Migrated implementation

This project migrates real implementation from `fe4d06af/workdir/oh-my-openagent`:

- `src/cli/install-config.ts`, `src/cli/install-config-types.ts`, `src/cli/install-config.test.ts`
- `src/cli/remote-access/` including password validation, option normalization, frpc config generation, public URL building, diagnostics, process launcher, and tests
- `src/cli/cloudflare-tunnel/` including dependency checks, quick/named tunnel planning, formatting, and tests
- `deploy/server/` server `.env`, Caddy, Docker Compose, systemd, installer, and healthcheck templates, renamed for this platform
- `docs/reference/cli.md` and `docs/guide/server-deployment.md`, rewritten to document `opencode-remote`

Not migrated: the full oh-my-openagent installer, doctor, model orchestration, OAuth, and run-completion systems. Those remain plugin responsibilities and are invoked through `bunx oh-my-openagent install/doctor` where needed.

## Verification

```bash
bun test src/cli/install-config.test.ts src/cli/remote-access/remote-access.test.ts src/cli/cloudflare-tunnel/plan.test.ts
bun run src/cli-program.ts smoke
```

These tests cover the migrated install/server deploy planner, frp remote-access planner, and Cloudflare Tunnel planner.
