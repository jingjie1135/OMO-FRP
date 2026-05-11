#!/usr/bin/env bash
set -euo pipefail

ROOT="${OPENCODE_REMOTE_INSTALL_ROOT:-/opt/opencode-remote-platform}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$ROOT/.env"
SERVICE_USER=opencode-remote

install -d -m 0750 "$ROOT"
install -d -m 0750 "${OPENCODE_CONFIG_DIR:-$ROOT/opencode}"
install -d -m 0750 "${OPENCODE_WORKSPACE_ROOT:-/srv/opencode-remote/workspaces}"

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home-dir "$ROOT" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

chown -R "$SERVICE_USER:$SERVICE_USER" "${OPENCODE_CONFIG_DIR:-$ROOT/opencode}" "${OPENCODE_WORKSPACE_ROOT:-/srv/opencode-remote/workspaces}"

if [[ ! -f "$ENV_FILE" ]]; then
  install -m 0600 "$SOURCE_DIR/.env.example" "$ENV_FILE"
  printf 'created %s; edit secrets before rerunning this script\n' "$ENV_FILE" >&2
  exit 1
fi

install -m 0640 "$SOURCE_DIR/docker-compose.yml" "$ROOT/docker-compose.yml"
install -m 0640 "$SOURCE_DIR/Caddyfile" "$ROOT/Caddyfile"
install -m 0750 "$SOURCE_DIR/healthcheck.sh" "$ROOT/healthcheck.sh"
install -m 0644 "$SOURCE_DIR/opencode-remote.service" /etc/systemd/system/opencode-remote.service

set -a
# shellcheck source=/dev/null
source "$ENV_FILE"
set +a

: "${OPENCODE_SERVER_PASSWORD:?set OPENCODE_SERVER_PASSWORD in $ENV_FILE}"
: "${OPENCODE_REMOTE_BASIC_AUTH_PASSWORD_HASH:?set OPENCODE_REMOTE_BASIC_AUTH_PASSWORD_HASH in $ENV_FILE}"
: "${FRP_PANEL_APP_GLOBAL_SECRET:?set FRP_PANEL_APP_GLOBAL_SECRET in $ENV_FILE}"

OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$ROOT/opencode}" opencode-remote detect --remote --port "${OPENCODE_PORT:-4096}"
OPENCODE_CONFIG_DIR="${OPENCODE_CONFIG_DIR:-$ROOT/opencode}" bunx oh-my-openagent install --no-tui --claude=max20 --openai=no --gemini=no --copilot=no --skip-auth
chown -R "$SERVICE_USER:$SERVICE_USER" "$OPENCODE_CONFIG_DIR"

systemctl daemon-reload
systemctl enable --now opencode-remote.service
docker compose --env-file "$ENV_FILE" -f "$ROOT/docker-compose.yml" up -d frp-panel caddy
"$ROOT/healthcheck.sh"

printf 'OpenCode URL: %s\n' "${OPENCODE_REMOTE_PUBLIC_URL:-https://${OPENCODE_REMOTE_DOMAIN}}"
printf 'frp-panel API URL: %s\n' "${FRP_PANEL_CLIENT_API_URL}"
printf 'frp-panel RPC URL: %s\n' "${FRP_PANEL_CLIENT_RPC_URL}"
