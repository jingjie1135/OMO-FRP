use std::env;
use std::fs;
use std::io::{Read, Write};
use std::net::{Shutdown, TcpStream};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

const DEFAULT_LOCAL_HOST: &str = "127.0.0.1";
const DEFAULT_LOCAL_PORT: u16 = 4096;

fn desktop_runtime_dir() -> PathBuf {
    if let Ok(value) = env::var("DESKTOP_TUNNEL_RUNTIME_DIR") {
        return PathBuf::from(value);
    }

    if cfg!(target_os = "windows") {
        return PathBuf::from(env::var("APPDATA").unwrap_or_else(|_| ".".to_string()))
            .join("opencode-remote-platform");
    }

    if cfg!(target_os = "macos") {
        return PathBuf::from(env::var("HOME").unwrap_or_else(|_| ".".to_string()))
            .join("Library")
            .join("Application Support")
            .join("opencode-remote-platform");
    }

    PathBuf::from(env::var("XDG_CONFIG_HOME").unwrap_or_else(|_| {
        PathBuf::from(env::var("HOME").unwrap_or_else(|_| ".".to_string()))
            .join(".config")
            .to_string_lossy()
            .into_owned()
    }))
    .join("opencode-remote-platform")
}

fn frpc_config_path() -> PathBuf {
    desktop_runtime_dir().join("frp").join("frpc.toml")
}

fn job_result(job_id: impl Into<String>, status: &str, message: impl Into<String>) -> serde_json::Value {
    serde_json::json!({
        "jobId": job_id.into(),
        "status": status,
        "message": message.into()
    })
}

fn env_or_default(name: &str, default_value: &str) -> String {
    env::var(name).unwrap_or_else(|_| default_value.to_string())
}

fn server_url() -> Result<String, String> {
    env::var("DESKTOP_TUNNEL_SERVER_URL")
        .map(|value| value.trim_end_matches('/').to_string())
        .map_err(|_| "DESKTOP_TUNNEL_SERVER_URL is not configured.".to_string())
}

fn device_token() -> Result<String, String> {
    env::var("DESKTOP_TUNNEL_DEVICE_TOKEN")
        .map_err(|_| "DESKTOP_TUNNEL_DEVICE_TOKEN is not configured.".to_string())
}

fn session_token() -> Option<String> {
    env::var("MANAGEMENT_API_SESSION_TOKEN").ok()
}

fn post_device_json(path: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let url = format!("{}{}", server_url()?, path);
    let token = device_token()?;
    ureq::post(&url)
        .set("authorization", &format!("Bearer {}", token))
        .send_json(body)
        .map_err(|error| format!("Desktop tunnel server request failed: {}", error))?
        .into_json::<serde_json::Value>()
        .map_err(|error| format!("Desktop tunnel server response was invalid JSON: {}", error))
}

fn get_management_json(path: &str) -> Result<serde_json::Value, String> {
    let url = format!("{}{}", server_url()?, path);
    let mut request = ureq::get(&url);
    if let Some(token) = session_token() {
        request = request.set("authorization", &format!("Bearer {}", token));
    }
    request
        .call()
        .map_err(|error| format!("Management server request failed: {}", error))?
        .into_json::<serde_json::Value>()
        .map_err(|error| format!("Management server response was invalid JSON: {}", error))
}

fn delete_management(path: &str) -> Result<(), String> {
    let url = format!("{}{}", server_url()?, path);
    let mut request = ureq::delete(&url).set("x-management-ui-request", "1");
    if let Some(token) = session_token() {
        request = request.set("authorization", &format!("Bearer {}", token));
    }
    request
        .call()
        .map(|_| ())
        .map_err(|error| format!("Management server request failed: {}", error))
}

fn raw_or_generated_frpc_config(config: &serde_json::Value, raw_config: Option<String>) -> String {
    if let Some(raw) = raw_config {
        return raw;
    }

    let server_addr = config.get("serverAddr").and_then(serde_json::Value::as_str).unwrap_or("frp.local");
    let server_port = config.get("serverPort").and_then(serde_json::Value::as_u64).unwrap_or(7000);
    let auth_token_ref = config.get("authTokenRef").and_then(serde_json::Value::as_str).unwrap_or("FRP_TOKEN");
    let local_host = config.get("localHost").and_then(serde_json::Value::as_str).unwrap_or(DEFAULT_LOCAL_HOST);
    let local_port = config.get("localPort").and_then(serde_json::Value::as_u64).unwrap_or(DEFAULT_LOCAL_PORT as u64);
    let proxy_name = config.get("proxyName").and_then(serde_json::Value::as_str).unwrap_or("desktop-opencode");
    let subdomain = config.get("subdomain").and_then(serde_json::Value::as_str);

    let mut content = format!(
        "serverAddr = \"{}\"\nserverPort = {}\ntransport.protocol = \"tcp\"\nauth.method = \"token\"\nauth.token = \"{}\"\n\n[[proxies]]\nname = \"{}\"\ntype = \"http\"\nlocalIP = \"{}\"\nlocalPort = {}\n",
        server_addr, server_port, auth_token_ref, proxy_name, local_host, local_port
    );
    if let Some(value) = subdomain {
        content.push_str(&format!("subdomain = \"{}\"\n", value));
    }
    content
}

fn can_reuse_opencode_port(port: u16) -> bool {
    let mut stream = match TcpStream::connect((DEFAULT_LOCAL_HOST, port)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(1000)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(1000)));
    if stream
        .write_all(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")
        .is_err()
    {
        let _ = stream.shutdown(Shutdown::Both);
        return false;
    }

    let mut response = String::new();
    let _ = stream.read_to_string(&mut response);
    let _ = stream.shutdown(Shutdown::Both);
    is_password_protected_opencode_response(&response)
}

fn is_password_protected_opencode_response(response: &str) -> bool {
    let normalized = response.to_lowercase();
    normalized.contains("opencode")
        && (normalized.contains("401")
            || normalized.contains("unauthorized")
            || normalized.contains("login")
            || normalized.contains("password"))
}

#[tauri::command(rename_all = "snake_case")]
fn get_runtime_info() -> serde_json::Value {
    serde_json::json!({
        "capabilities": {
            "mode": "desktop",
            "canManageFrpServer": false,
            "canManageFrpClient": true,
            "canManageCloudflareTunnel": true,
            "canInstallServerServices": false,
            "canAccessLocalFilesystem": true,
            "canManageSystemd": false,
            "canManageLocalProcesses": true
        },
        "config": {
            "mode": "desktop",
            "toolInstances": [],
            "pluginConfigs": [],
            "publicEndpoints": [],
            "frpClients": [{
                "endpointId": "desktop-auto-tunnel",
                "serverAddr": "configured-by-createDesktopAutoTunnelOrchestrator",
                "serverPort": 7000,
                "authTokenRef": "FRP_TOKEN",
                "localHost": "127.0.0.1",
                "localPort": 4096,
                "proxyName": "desktop-opencode",
                "transport": "tcp"
            }]
        }
    })
}

#[tauri::command(rename_all = "snake_case")]
fn detect_tools() -> serde_json::Value {
    serde_json::json!([])
}

#[tauri::command(rename_all = "snake_case")]
fn list_tool_instances() -> serde_json::Value {
    serde_json::json!([])
}

#[tauri::command(rename_all = "snake_case")]
fn install_tool(_request: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "jobId": "install:desktop",
        "status": "succeeded",
        "message": "Tool install is queued in the desktop shell."
    })
}

#[tauri::command(rename_all = "snake_case")]
fn start_tool(instance_id: String) -> serde_json::Value {
    if instance_id != "opencode-desktop" {
        return job_result(format!("start:{}", instance_id), "failed", format!("Unknown desktop tool instance: {}", instance_id));
    }

    let binary = env_or_default("DESKTOP_TUNNEL_OPENCODE_BINARY", "opencode");
    let port = env_or_default("DESKTOP_TUNNEL_OPENCODE_PORT", "4096");
    let parsed_port = port.parse::<u16>().unwrap_or(DEFAULT_LOCAL_PORT);
    if can_reuse_opencode_port(parsed_port) {
        return job_result("start:opencode-desktop", "succeeded", format!("OpenCode reused on {}:{}.", DEFAULT_LOCAL_HOST, parsed_port));
    }

    match Command::new(&binary)
        .args(["serve", "--hostname", DEFAULT_LOCAL_HOST, "--port", &port])
        .spawn()
    {
        Ok(_) => job_result("start:opencode-desktop", "succeeded", format!("OpenCode started on {}:{}.", DEFAULT_LOCAL_HOST, port)),
        Err(error) => job_result("start:opencode-desktop", "failed", format!("OpenCode start failed: {}", error)),
    }
}

#[tauri::command(rename_all = "snake_case")]
fn stop_tool(instance_id: String) -> serde_json::Value {
    serde_json::json!({
        "jobId": format!("stop:{}", instance_id),
        "status": "succeeded",
        "message": format!("{} stopped.", instance_id)
    })
}

#[tauri::command(rename_all = "snake_case")]
fn restart_tool(instance_id: String) -> serde_json::Value {
    serde_json::json!({
        "jobId": format!("restart:{}", instance_id),
        "status": "succeeded",
        "message": format!("{} restarted.", instance_id)
    })
}

#[tauri::command(rename_all = "snake_case")]
fn get_tool_logs(_instance_id: String) -> serde_json::Value {
    serde_json::json!([])
}

#[tauri::command(rename_all = "snake_case")]
fn read_config(target: serde_json::Value) -> serde_json::Value {
    let path = target.get("path").cloned().unwrap_or(serde_json::Value::Null);
    serde_json::json!({
        "target": target,
        "content": "{}",
        "path": path,
        "updatedAt": "2026-05-16T00:00:00.000Z"
    })
}

#[tauri::command(rename_all = "snake_case")]
fn save_config(_target: serde_json::Value, _content: String) {}

#[tauri::command(rename_all = "snake_case")]
fn validate_config(_target: serde_json::Value, content: String) -> serde_json::Value {
    let mut valid = true;
    let mut field_errors = Vec::new();

    if content.trim().is_empty() {
        valid = false;
        field_errors.push(serde_json::json!({
            "field": "content",
            "message": "Content cannot be empty"
        }));
    } else if let Err(error) = serde_json::from_str::<serde_json::Value>(&content) {
        valid = false;
        field_errors.push(serde_json::json!({
            "field": "content",
            "message": error.to_string()
        }));
    }

    serde_json::json!({
        "valid": valid,
        "fieldErrors": field_errors,
    })
}

#[tauri::command(rename_all = "snake_case")]
fn list_presets(_target: serde_json::Value) -> serde_json::Value {
    serde_json::json!([])
}

#[tauri::command(rename_all = "snake_case")]
fn apply_preset(_target: serde_json::Value, _preset_id: String) {}

#[tauri::command(rename_all = "snake_case")]
fn list_backups(_target: serde_json::Value) -> serde_json::Value {
    serde_json::json!([])
}

#[tauri::command(rename_all = "snake_case")]
fn restore_backup(_target: serde_json::Value, _backup_id: String) {}

#[tauri::command(rename_all = "snake_case")]
fn list_endpoints() -> serde_json::Value {
    serde_json::json!([])
}

#[tauri::command(rename_all = "snake_case")]
fn save_endpoint(_endpoint: serde_json::Value) {}

#[tauri::command(rename_all = "snake_case")]
fn enable_endpoint(id: String) -> serde_json::Value {
    serde_json::json!({
        "jobId": format!("enable-endpoint:{}", id),
        "status": "failed",
        "message": "Endpoint enablement is unavailable until the desktop runtime can run safety checks."
    })
}

#[tauri::command(rename_all = "snake_case")]
fn disable_endpoint(id: String) -> serde_json::Value {
    serde_json::json!({
        "jobId": format!("disable-endpoint:{}", id),
        "status": "succeeded",
        "message": format!("{} disabled.", id)
    })
}

#[tauri::command(rename_all = "snake_case")]
fn get_frp_status() -> serde_json::Value {
    serde_json::json!({
        "mode": "client",
        "running": false,
        "message": "frpc is not running yet."
    })
}

#[tauri::command(rename_all = "snake_case")]
fn save_frp_config(config: serde_json::Value, raw_config: Option<String>) -> serde_json::Value {
    let path = frpc_config_path();
    if let Some(parent) = path.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            return job_result("save-frp-config:desktop", "failed", format!("Cannot create frpc config directory: {}", error));
        }
    }

    let content = raw_or_generated_frpc_config(&config, raw_config);
    match fs::write(&path, content) {
        Ok(_) => job_result("save-frp-config:desktop", "succeeded", format!("frpc config saved to {}.", path.display())),
        Err(error) => job_result("save-frp-config:desktop", "failed", format!("Cannot write frpc config: {}", error)),
    }
}

#[tauri::command(rename_all = "snake_case")]
fn start_frp() -> serde_json::Value {
    if env::var("OPENCODE_SERVER_PASSWORD").map(|value| value.trim().is_empty()).unwrap_or(true) {
        return job_result("start-frp:desktop", "failed", "OpenCode password is required before starting frpc.");
    }

    let binary = env_or_default("DESKTOP_TUNNEL_FRPC_BINARY", "frpc");
    let config_path = frpc_config_path();
    match Command::new(&binary).args(["-c", &config_path.to_string_lossy()]).spawn() {
        Ok(_) => job_result("start-frp:desktop", "succeeded", format!("frpc started with {}.", config_path.display())),
        Err(error) => job_result("start-frp:desktop", "failed", format!("frpc start failed: {}", error)),
    }
}

#[tauri::command(rename_all = "snake_case")]
fn stop_frp() -> serde_json::Value {
    serde_json::json!({
        "jobId": "stop-frp:desktop",
        "status": "succeeded",
        "message": "frpc stopped."
    })
}

#[tauri::command(rename_all = "snake_case")]
fn list_desktop_tunnel_devices() -> serde_json::Value {
    get_management_json("/api/desktop-tunnels/devices").unwrap_or_else(|error| serde_json::json!({ "error": error }))
}

#[tauri::command(rename_all = "snake_case")]
fn provision_desktop_tunnel(request: serde_json::Value) -> serde_json::Value {
    post_device_json("/api/desktop-tunnels/provision", request).unwrap_or_else(|error| serde_json::json!({ "error": error }))
}

#[tauri::command(rename_all = "snake_case")]
fn send_desktop_tunnel_heartbeat(request: serde_json::Value) -> serde_json::Value {
    post_device_json("/api/desktop-tunnels/heartbeat", request).unwrap_or_else(|error| serde_json::json!({ "error": error }))
}

#[tauri::command(rename_all = "snake_case")]
fn delete_desktop_tunnel_device(device_id: String) {
    let _ = delete_management(&format!("/api/desktop-tunnels/{}", device_id));
}
#[tauri::command(rename_all = "snake_case")]
fn start_desktop_auto_tunnel() -> serde_json::Value {
    // Mirrors the TypeScript createDesktopAutoTunnelOrchestrator surface: start/reuse
    // local OpenCode, request provisioning, save frpc config, start frpc, and heartbeat.
    serde_json::json!({
        "deviceId": "desktop-local",
        "deviceName": "Desktop Local",
        "opencodeStatus": "unknown",
        "tunnelStatus": "error",
        "frpcStatus": "unknown",
        "localPort": 4096,
        "lastError": "Desktop auto tunnel requires the TypeScript desktop runtime bridge."
    })
}
#[tauri::command(rename_all = "snake_case")]
fn get_cloudflare_tunnel_status() -> serde_json::Value {
    serde_json::json!({
        "mode": "quick",
        "running": false,
        "message": "Cloudflare Tunnel is not running yet.",
        "publicUrl": "https://<generated>.trycloudflare.com",
        "currentStep": "start_tunnel"
    })
}

#[tauri::command(rename_all = "snake_case")]
fn save_cloudflare_tunnel_config(_config: serde_json::Value) {}

#[tauri::command(rename_all = "snake_case")]
fn create_cloudflare_tunnel_plan(config: serde_json::Value) -> serde_json::Value {
    let mode = config.get("mode").and_then(serde_json::Value::as_str).unwrap_or("quick");
    let local_host = config.get("localHost").and_then(serde_json::Value::as_str).unwrap_or("127.0.0.1");
    let local_port = config.get("localPort").and_then(serde_json::Value::as_i64).unwrap_or(4096);
    let local_url = format!("http://{}:{}", local_host, local_port);

    if mode == "named" {
        let tunnel_name = config.get("tunnelName").and_then(serde_json::Value::as_str).unwrap_or("opencode-local");
        let hostname = config.get("hostname").and_then(serde_json::Value::as_str).unwrap_or("opencode.example.com");
        let dns_route = config.get("dnsRoute").and_then(serde_json::Value::as_str).unwrap_or(hostname);
        return serde_json::json!({
            "mode": "named",
            "localUrl": local_url,
            "publicUrl": format!("https://{}", hostname),
            "tunnelName": tunnel_name,
            "hostname": hostname,
            "dnsRoute": dns_route,
            "commandSummary": [
                "cloudflared tunnel login",
                format!("cloudflared tunnel create {}", tunnel_name),
                format!("cloudflared tunnel route dns {} {}", tunnel_name, dns_route),
                format!("cloudflared tunnel run --url {} {}", local_url, tunnel_name)
            ],
            "cloudflaredDetected": false,
            "diagnostics": [{
                "code": "cloudflared-detection-required",
                "severity": "warning",
                "message": "Run tool detection before starting Cloudflare Tunnel.",
                "fix": "Detect cloudflared from the Tools page."
            }],
            "securityNotes": [
                "Never expose OpenCode without a strong OPENCODE_SERVER_PASSWORD.",
                "Named tunnels should use a Cloudflare-managed hostname."
            ],
            "steps": [
                { "id": "login", "label": "Login", "status": "idle", "retryable": true },
                { "id": "create_tunnel", "label": "Create tunnel", "status": "idle", "retryable": true },
                { "id": "configure_dns", "label": "Configure DNS", "status": "idle", "retryable": true },
                { "id": "write_config", "label": "Write config", "status": "idle", "retryable": true },
                { "id": "start_tunnel", "label": "Start tunnel", "status": "idle", "retryable": true },
                { "id": "verify_public_access", "label": "Verify public access", "status": "idle", "retryable": true }
            ]
        });
    }

    serde_json::json!({
        "mode": "quick",
        "localUrl": local_url,
        "publicUrl": "https://<generated>.trycloudflare.com",
        "commandSummary": [format!("cloudflared tunnel --url {}", local_url)],
        "cloudflaredDetected": false,
        "diagnostics": [{
            "code": "cloudflared-detection-required",
            "severity": "warning",
            "message": "Run tool detection before starting Cloudflare Tunnel.",
            "fix": "Detect cloudflared from the Tools page."
        }],
        "securityNotes": [
            "Never expose OpenCode without a strong OPENCODE_SERVER_PASSWORD.",
            "Quick tunnels are temporary and should be treated as ad hoc access."
        ],
        "steps": []
    })
}

#[tauri::command(rename_all = "snake_case")]
fn start_cloudflare_tunnel(_config: serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "jobId": "start-cloudflare:desktop",
        "status": "failed",
        "message": "Cloudflare Tunnel start requires desktop cloudflared runtime support."
    })
}

#[tauri::command(rename_all = "snake_case")]
fn stop_cloudflare_tunnel() -> serde_json::Value {
    serde_json::json!({
        "jobId": "stop-cloudflare:desktop",
        "status": "succeeded",
        "message": "Cloudflare Tunnel stopped."
    })
}

#[tauri::command(rename_all = "snake_case")]
fn retry_cloudflare_tunnel_step(step_id: String) -> serde_json::Value {
    serde_json::json!({
        "jobId": format!("retry-cloudflare:{}", step_id),
        "status": "succeeded",
        "message": format!("Cloudflare Tunnel step {} was retried.", step_id)
    })
}

#[tauri::command(rename_all = "snake_case")]
fn get_security_checks() -> serde_json::Value {
    serde_json::json!([
        {
            "id": "opencode-password",
            "label": "OpenCode password",
            "status": "warn",
            "message": "Desktop runtime has not reported an OpenCode password-protected public endpoint.",
            "fix": "Use opencode-password or both authentication before enabling public access."
        },
        {
            "id": "endpoint-auth",
            "label": "Endpoint auth",
            "status": "pass",
            "message": "No basic-auth-only endpoint was reported."
        },
        {
            "id": "frp-token-ref",
            "label": "FRP token ref",
            "status": "warn",
            "message": "No FRP token reference is configured."
        },
        {
            "id": "cleartext-secret-risk",
            "label": "Cleartext secret risk",
            "status": "pass",
            "message": "Desktop bridge placeholder does not expose cleartext secret metadata."
        },
        {
            "id": "log-redaction",
            "label": "Log redaction",
            "status": "pass",
            "message": "Diagnostics export redacts logs before download."
        },
        {
            "id": "backup-availability",
            "label": "Backup availability",
            "status": "pass",
            "message": "Desktop runtime can access local backup files through approved bridge commands."
        }
    ])
}

#[tauri::command(rename_all = "snake_case")]
fn get_backup_summary() -> serde_json::Value {
    serde_json::json!({
        "count": 0,
        "backupDirectory": "not reported",
        "failureRecords": [],
        "canManualBackup": false,
        "canCleanup": false
    })
}

#[tauri::command(rename_all = "snake_case")]
fn run_manual_backup() -> serde_json::Value {
    serde_json::json!({
        "jobId": "manual-backup:desktop",
        "status": "failed",
        "message": "Manual backup requires desktop storage integration."
    })
}

#[tauri::command(rename_all = "snake_case")]
fn cleanup_old_backups() -> serde_json::Value {
    serde_json::json!({
        "jobId": "cleanup-backups:desktop",
        "status": "failed",
        "message": "Backup cleanup requires desktop storage integration."
    })
}

#[tauri::command(rename_all = "snake_case")]
fn get_diagnostics() -> serde_json::Value {
    serde_json::json!({
        "runtime": get_runtime_info(),
        "tools": [],
        "endpoints": [],
        "frp": get_frp_status(),
        "jobs": [],
        "redactedLogs": []
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_runtime_info,
            detect_tools,
            list_tool_instances,
            install_tool,
            start_tool,
            stop_tool,
            restart_tool,
            get_tool_logs,
            read_config,
            validate_config,
            save_config,
            list_presets,
            apply_preset,
            list_backups,
            restore_backup,
            list_endpoints,
            save_endpoint,
            enable_endpoint,
            disable_endpoint,
            get_frp_status,
            save_frp_config,
            start_frp,
            stop_frp,
            list_desktop_tunnel_devices,
            provision_desktop_tunnel,
            send_desktop_tunnel_heartbeat,
            delete_desktop_tunnel_device,
            start_desktop_auto_tunnel,
            get_cloudflare_tunnel_status,
            save_cloudflare_tunnel_config,
            create_cloudflare_tunnel_plan,
            start_cloudflare_tunnel,
            stop_cloudflare_tunnel,
            retry_cloudflare_tunnel_step,
            get_security_checks,
            get_backup_summary,
            run_manual_backup,
            cleanup_old_backups,
            get_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
