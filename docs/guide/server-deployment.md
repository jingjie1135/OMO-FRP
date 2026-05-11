# Server deployment

This server template deploys the OpenCode Remote Platform server flow:

- OpenCode runs on `127.0.0.1:$OPENCODE_PORT` under `opencode-remote.service`.
- `oh-my-openagent` is installed into the same `OPENCODE_CONFIG_DIR` as an OpenCode plugin.
- Caddy terminates HTTPS and enforces Basic Auth before proxying to OpenCode.
- frp-panel runs with Docker Compose and exposes API/RPC URLs for desktop clients.

## Files

- `deploy/server/.env.example`: environment and secret template.
- `deploy/server/install.sh`: idempotent server setup flow.
- `deploy/server/opencode-remote.service`: systemd unit for OpenCode.
- `deploy/server/docker-compose.yml`: frp-panel and Caddy services.
- `deploy/server/Caddyfile`: HTTPS, Basic Auth, OpenCode reverse proxy, frp-panel reverse proxy.
- `deploy/server/healthcheck.sh`: local health checks for OpenCode, frp-panel, Caddy, and the plugin.

## Required secrets

Set these before starting services:

- `OPENCODE_SERVER_PASSWORD`: required for OpenCode server authentication.
- `OPENCODE_REMOTE_BASIC_AUTH_PASSWORD_HASH`: Caddy hash generated with `caddy hash-password`.
- `FRP_PANEL_APP_GLOBAL_SECRET`: frp-panel global secret.

Do not publish OpenCode without `OPENCODE_SERVER_PASSWORD`; the platform planner blocks unsafe remote plans when password generation is disabled.

## Minimal flow

```bash
sudo install -d -m 0750 /opt/opencode-remote-platform
sudo cp deploy/server/.env.example /opt/opencode-remote-platform/.env
sudo editor /opt/opencode-remote-platform/.env
sudo deploy/server/install.sh
```

Before opening public traffic, verify firewall rules:

- Open 80/443 for Caddy.
- Keep OpenCode and frp-panel API/RPC bound to localhost unless a reverse proxy controls access.
- Open extra frp business ports only when desktop tunnels require them.

## CLI helpers

```bash
opencode-remote detect --remote --port 4096
bunx oh-my-openagent install --no-tui --claude=max20 --openai=no --gemini=no --copilot=no --skip-auth
opencode-remote start --remote --port 4096 --public-url https://opencode.example.com
opencode-remote server-deploy-plan --domain opencode.example.com --email admin@example.com
bunx oh-my-openagent doctor --status
```

`server-deploy-plan --json` prints paths, URLs, required secrets, and the command sequence for automation.

## Health checks

```bash
curl -fsS http://127.0.0.1:4096 >/dev/null
curl -fsSI http://127.0.0.1:9000 >/dev/null
systemctl is-active --quiet opencode-remote.service
docker compose --env-file /opt/opencode-remote-platform/.env -f /opt/opencode-remote-platform/docker-compose.yml ps
bunx oh-my-openagent doctor --status
```

The public OpenCode URL should require Basic Auth first, then the OpenCode server password. A request without credentials must not reach an unauthenticated workspace.

## Desktop frp-panel handoff

Give the desktop operator only these values plus a scoped frp-panel user token:

- `FRP_PANEL_CLIENT_API_URL`
- `FRP_PANEL_CLIENT_RPC_URL`
- target local OpenCode port
- target public route or port policy

Do not share `FRP_PANEL_APP_GLOBAL_SECRET`, frp server secret, or the OpenCode server password through logs.
