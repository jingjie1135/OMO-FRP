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
: "${MANAGEMENT_API_SESSION_TOKEN:?set MANAGEMENT_API_SESSION_TOKEN}"

curl_config_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\r'/}"
  value="${value//$'\n'/}"
  printf '%s' "$value"
}

CURL_BASIC_AUTH_CONFIG="$(mktemp)"
cleanup_curl_basic_auth_config() {
  rm -f "$CURL_BASIC_AUTH_CONFIG"
}
trap cleanup_curl_basic_auth_config EXIT
chmod 600 "$CURL_BASIC_AUTH_CONFIG"
printf 'user = "%s:%s"\n' "$(curl_config_escape "$OPENCODE_REMOTE_BASIC_AUTH_USER")" "$(curl_config_escape "$OPENCODE_SERVER_PASSWORD")" >"$CURL_BASIC_AUTH_CONFIG"

docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" exec -T frp-panel wget -qO- "http://127.0.0.1:${FRP_PANEL_API_PORT}" >/dev/null
docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" exec -T management-ui bun -e "const token = process.env.MANAGEMENT_API_SESSION_TOKEN; const response = await fetch('http://127.0.0.1:${MANAGEMENT_UI_PORT}/api/runtime', { headers: { authorization: 'Bearer ' + token } }); if (!response.ok) process.exit(1)"
curl -fsSI --config "$CURL_BASIC_AUTH_CONFIG" -H "Host: ${OPENCODE_REMOTE_DOMAIN}" http://127.0.0.1/ >/dev/null
curl -fsSI --config "$CURL_BASIC_AUTH_CONFIG" -H "Host: opencode.${OPENCODE_REMOTE_DOMAIN}" http://127.0.0.1/ >/dev/null
curl -fsSI -H "Host: frp.${OPENCODE_REMOTE_DOMAIN}" http://127.0.0.1/ >/dev/null
docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" ps management-ui opencode frp-panel caddy >/dev/null
printf 'OpenCode Remote Platform server healthcheck passed; OpenCode checks are explicit tool actions.\n'