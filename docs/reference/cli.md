# CLI Reference

`opencode-remote` is the command surface for OpenCode Remote Platform. `oh-my-openagent` is not this project's CLI; it appears only as an OpenCode plugin installed/configured by specific workflows.

## Commands

| Command | Description |
| --- | --- |
| `detect` | Check OpenCode, Bun, Docker/Compose, plugin config, password, and port readiness |
| `start` | Print a password-aware local OpenCode server command |
| `server-deploy-plan` | Print server deployment paths, URLs, secrets, and command sequence |
| `remote-access` | Generate frp-panel routing config and optionally start OpenCode/frpc |
| `cloudflare-tunnel` | Generate Cloudflare Tunnel setup steps for local OpenCode |
| `smoke` | Run a local smoke validation over migrated planners |
| `version` | Show package version |

## detect

```bash
opencode-remote detect --remote --port 4096
opencode-remote detect --json
```

Remote mode warns when `OPENCODE_SERVER_PASSWORD` is missing. The plugin config check looks for `oh-my-openagent.json` / `oh-my-openagent.jsonc` inside the OpenCode config directory because the plugin remains a dependency.

## start

```bash
opencode-remote start --port 4096
OPENCODE_SERVER_PASSWORD=secret opencode-remote start --remote --public-url https://opencode.example.com
```

Use `--no-generate-password` when automation should fail on a missing password instead of generating one.

## server-deploy-plan

```bash
opencode-remote server-deploy-plan --domain opencode.example.com --email admin@example.com
opencode-remote server-deploy-plan --domain opencode.example.com --email admin@example.com --json
```

The plan includes `/opt/opencode-remote-platform` paths, required secret names, the OpenCode public URL, frp-panel API/RPC URLs, `opencode-remote detect/start` commands, and the plugin install substep using `bunx oh-my-openagent install --no-tui`.

## remote-access

```bash
opencode-remote remote-access \
  --panel-url https://frp.example.com \
  --auth-token "$FRP_TOKEN" \
  --password 'Use-a-strong-password-123!' \
  --subdomain alice-code \
  --output-config ./frpc.toml
```

Options:

| Option | Description |
| --- | --- |
| `--panel-url <url>` | frp-panel public URL |
| `--auth-token <token>` | frp token for the server or panel |
| `--password <password>` | Strong OpenCode Basic Auth password; defaults to `OPENCODE_SERVER_PASSWORD` |
| `--username <username>` | OpenCode Basic Auth username; defaults to `OPENCODE_SERVER_USERNAME` or `opencode` |
| `--proxy-name <name>` | frp proxy name |
| `--server-addr <host>` | frp server address; defaults to the panel hostname |
| `--server-port <port>` | frp server bind port; defaults to `7000` |
| `--transport <protocol>` | `tcp`, `kcp`, `websocket`, or `quic` |
| `--local-port <port>` | local OpenCode server port; defaults to `4096` |
| `--remote-port <port>` | TCP/port-based public routing |
| `--subdomain <name>` | HTTP subdomain for frp public routing |
| `--custom-domain <domain>` | HTTP custom domain for frp public routing |
| `--http` | show an `http` public URL instead of `https` |
| `--output-config <path>` | write generated frpc TOML to a file |
| `--frpc-bin <path>` | frpc binary path; defaults to `frpc` |
| `--no-start` | do not start OpenCode; only generate config and diagnostics |
| `--no-frpc` | do not start frpc; only print/write generated config |
| `--json` | output structured JSON |

Use `--subdomain` or `--custom-domain` for frp HTTP routing. Use `--remote-port` for TCP/port routing.

## cloudflare-tunnel

```bash
OPENCODE_SERVER_PASSWORD=secret opencode-remote cloudflare-tunnel --mode quick --port 4096
opencode-remote cloudflare-tunnel --mode named --hostname opencode.example.com --tunnel-name local-opencode
opencode-remote cloudflare-tunnel --json
```

The command only prints local OpenCode and `cloudflared` steps. It does not start a public tunnel.

## Exit codes

Commands return `0` on success and `1` on validation or diagnostic failure.
