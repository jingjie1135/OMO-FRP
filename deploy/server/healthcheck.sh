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

: "${OPENCODE_REMOTE_BASIC_AUTH_USER:?set OPENCODE_REMOTE_BASIC_AUTH_USER}"
: "${OPENCODE_SERVER_PASSWORD:?set OPENCODE_SERVER_PASSWORD}"
: "${OPENCODE_REMOTE_DOMAIN:?set OPENCODE_REMOTE_DOMAIN}"
: "${FRP_PANEL_API_PORT:?set FRP_PANEL_API_PORT}"
: "${MANAGEMENT_UI_PORT:?set MANAGEMENT_UI_PORT}"

docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" exec -T frp-panel wget -qO- "http://127.0.0.1:${FRP_PANEL_API_PORT}" >/dev/null
docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" exec -T management-ui bun -e "const response = await fetch('http://127.0.0.1:${MANAGEMENT_UI_PORT}/api/runtime'); if (!response.ok) process.exit(1)"
docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" exec -T management-ui bun -e "const status = await fetch('http://127.0.0.1:${MANAGEMENT_UI_PORT}/api/frp/status').then((response) => response.json()); if (status.mode !== 'server' || status.status !== 'ready') process.exit(1)"
curl -fsSI -u "${OPENCODE_REMOTE_BASIC_AUTH_USER}:${OPENCODE_SERVER_PASSWORD}" -H "Host: ${OPENCODE_REMOTE_DOMAIN}" http://127.0.0.1/ >/dev/null
curl -fsSI -u "${OPENCODE_REMOTE_BASIC_AUTH_USER}:${OPENCODE_SERVER_PASSWORD}" -H "Host: opencode.${OPENCODE_REMOTE_DOMAIN}" http://127.0.0.1/ >/dev/null
curl -fsSI -H "Host: frp.${OPENCODE_REMOTE_DOMAIN}" http://127.0.0.1/ >/dev/null
docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" ps management-ui opencode frp-panel caddy >/dev/null
printf 'OpenCode Remote Platform server healthcheck passed; OpenCode checks are explicit tool actions.\n'
