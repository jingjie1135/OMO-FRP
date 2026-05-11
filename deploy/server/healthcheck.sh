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
: "${FRP_PANEL_API_PORT:?set FRP_PANEL_API_PORT}"

curl -fsSI "http://127.0.0.1:${FRP_PANEL_API_PORT}" >/dev/null
docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" ps frp-panel caddy >/dev/null
printf 'OpenCode Remote Platform server healthcheck passed; OpenCode checks are explicit tool actions.\n'
