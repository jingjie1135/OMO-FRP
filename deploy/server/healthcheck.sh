#!/usr/bin/env bash
set -euo pipefail

ROOT="${OPENCODE_REMOTE_INSTALL_ROOT:-/opt/opencode-remote-platform}"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'missing env file: %s\n' "$ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

: "${OPENCODE_PORT:?set OPENCODE_PORT}"
: "${OPENCODE_SERVER_PASSWORD:?set OPENCODE_SERVER_PASSWORD}"
: "${OPENCODE_REMOTE_BASIC_AUTH_USER:?set OPENCODE_REMOTE_BASIC_AUTH_USER}"
: "${FRP_PANEL_API_PORT:?set FRP_PANEL_API_PORT}"

curl -fsS "http://127.0.0.1:${OPENCODE_PORT}" >/dev/null
curl -fsSI "http://127.0.0.1:${FRP_PANEL_API_PORT}" >/dev/null
systemctl is-active --quiet opencode-remote.service
docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" ps frp-panel caddy >/dev/null
bunx oh-my-openagent doctor --status
printf 'OpenCode Remote Platform healthcheck passed\n'
