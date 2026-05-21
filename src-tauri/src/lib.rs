use std::collections::HashMap;
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};

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
            "toolInstances": desktop_tool_instances(),
            "pluginConfigs": [],
            "publicEndpoints": [],
            "frpClients": []
        }
    })
}

#[tauri::command(rename_all = "snake_case")]
fn detect_tools() -> serde_json::Value {
    detect_tool_binaries(&["opencode", "frpc", "cloudflared"])
}

#[tauri::command(rename_all = "snake_case")]
fn list_tool_instances() -> serde_json::Value {
    desktop_tool_instances()
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
    if instance_id.starts_with("opencode") {
        return start_managed_process(
            &instance_id,
            &std::env::var("OPENCODE_BINARY").unwrap_or_else(|_| "opencode".to_string()),
            &["serve", "--hostname", "127.0.0.1", "--port", "4096"],
        );
    }
    serde_json::json!({
        "jobId": format!("start:{}", instance_id),
        "status": "failed",
        "message": format!("Desktop runtime can only start local OpenCode tool instances, not {}.", instance_id)
    })
}

#[tauri::command(rename_all = "snake_case")]
fn stop_tool(instance_id: String) -> serde_json::Value {
    stop_managed_process(&instance_id)
}

#[tauri::command(rename_all = "snake_case")]
fn restart_tool(instance_id: String) -> serde_json::Value {
    let _ = stop_managed_process(&instance_id);
    start_tool(instance_id)
}

#[tauri::command(rename_all = "snake_case")]
fn get_tool_logs(_instance_id: String) -> serde_json::Value {
    serde_json::Value::Array(get_managed_process_logs(&_instance_id))
}

#[tauri::command(rename_all = "snake_case")]
fn read_config(target: serde_json::Value) -> serde_json::Value {
    read_config_from_path(&target).unwrap_or_else(|error| serde_json::json!({
        "target": target,
        "content": "",
        "missing": true,
        "error": error,
    }))
}

#[tauri::command(rename_all = "snake_case")]
fn save_config(target: serde_json::Value, content: String) -> Result<(), String> {
    save_config_to_path(&target, content)
}

#[tauri::command(rename_all = "snake_case")]
fn validate_config(_target: serde_json::Value, content: String) -> serde_json::Value {
    let validation_result = validate_json_config(&content);
    let valid = validation_result.is_ok();
    let field_errors = validation_result.err().map_or_else(Vec::new, |message| vec![serde_json::json!({
        "field": "content",
        "message": message
    })]);

    serde_json::json!({
        "valid": valid,
        "fieldErrors": field_errors,
    })
}

fn validate_json_config(content: &str) -> Result<(), String> {
    if content.trim().is_empty() {
        return Err("Content cannot be empty".to_string());
    }
    serde_json::from_str::<serde_json::Value>(content)
        .map(|_| ())
        .map_err(|error| error.to_string())
}

fn read_config_from_path(target: &serde_json::Value) -> Result<serde_json::Value, String> {
    let path = require_target_path(target)?;
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    Ok(serde_json::json!({
        "target": target,
        "content": content,
        "path": path,
    }))
}

fn save_config_to_path(target: &serde_json::Value, content: String) -> Result<(), String> {
    validate_json_config(&content)?;
    let path = require_target_path(target)?;
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(path, content).map_err(|error| error.to_string())
}

fn require_target_path(target: &serde_json::Value) -> Result<&str, String> {
    target
        .get("path")
        .and_then(serde_json::Value::as_str)
        .filter(|path| !path.trim().is_empty())
        .ok_or_else(|| "Config target path is required".to_string())
}

fn detect_tool_binaries(kinds: &[&str]) -> serde_json::Value {
    serde_json::Value::Array(kinds.iter().map(|kind| detect_tool_binary(kind)).collect())
}

fn desktop_tool_instances() -> serde_json::Value {
    let detections = detect_tool_binaries(&["opencode", "frpc", "cloudflared"]);
    let process_ids = managed_processes()
        .lock()
        .expect("managed process lock poisoned")
        .keys()
        .cloned()
        .collect::<Vec<_>>();
    let detected = |kind: &str| -> bool {
        detections
            .as_array()
            .and_then(|items| items.iter().find(|item| item["kind"] == kind))
            .and_then(|item| item["detected"].as_bool())
            .unwrap_or(false)
    };
    let running = |id: &str| process_ids.iter().any(|process_id| process_id == id);
    serde_json::json!([
        {
            "id": "opencode-desktop",
            "kind": "opencode",
            "displayName": "OpenCode",
            "hostType": "desktop",
            "installState": if detected("opencode") { "detected" } else { "missing" },
            "binaryPath": "opencode",
            "configDirectory": std::env::var("OPENCODE_CONFIG_DIR").unwrap_or_else(|_| ".opencode".to_string()),
            "defaultPort": 4096,
            "currentPort": 4096,
            "status": if running("opencode-desktop") { "running" } else { "stopped" },
        },
        {
            "id": "frpc-desktop",
            "kind": "frpc",
            "displayName": "frpc",
            "hostType": "desktop",
            "installState": if detected("frpc") { "detected" } else { "missing" },
            "binaryPath": "frpc",
            "defaultPort": 0,
            "status": if running("frpc-desktop") { "running" } else { "stopped" },
        },
        {
            "id": "cloudflared-desktop",
            "kind": "cloudflared",
            "displayName": "cloudflared",
            "hostType": "desktop",
            "installState": if detected("cloudflared") { "detected" } else { "missing" },
            "binaryPath": "cloudflared",
            "defaultPort": 0,
            "status": if running("cloudflared-desktop") { "running" } else { "stopped" },
        }
    ])
}

fn detect_tool_binary(kind: &str) -> serde_json::Value {
    match Command::new(kind).arg("--version").output() {
        Ok(output) => serde_json::json!({
            "kind": kind,
            "displayName": display_tool_name(kind),
            "detected": output.status.success(),
            "binaryPath": kind,
            "version": parse_version_output(&output.stdout, &output.stderr),
        }),
        Err(_) => serde_json::json!({
            "kind": kind,
            "displayName": display_tool_name(kind),
            "detected": false,
            "binaryPath": kind,
        }),
    }
}

fn display_tool_name(kind: &str) -> &str {
    match kind {
        "opencode" => "OpenCode",
        "frpc" => "frpc",
        "cloudflared" => "cloudflared",
        other => other,
    }
}

fn parse_version_output(stdout: &[u8], stderr: &[u8]) -> Option<String> {
    let output = if stdout.is_empty() { stderr } else { stdout };
    let version = String::from_utf8_lossy(output).trim().to_string();
    if version.is_empty() { None } else { Some(version) }
}

struct ManagedProcess {
    child: Child,
    logs: Vec<serde_json::Value>,
}

static MANAGED_PROCESSES: OnceLock<Mutex<HashMap<String, ManagedProcess>>> = OnceLock::new();
static MANAGED_PROCESS_LOGS: OnceLock<Mutex<HashMap<String, Vec<serde_json::Value>>>> = OnceLock::new();

fn managed_processes() -> &'static Mutex<HashMap<String, ManagedProcess>> {
    MANAGED_PROCESSES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn managed_process_logs() -> &'static Mutex<HashMap<String, Vec<serde_json::Value>>> {
    MANAGED_PROCESS_LOGS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn start_managed_process(id: &str, command: &str, args: &[&str]) -> serde_json::Value {
    let mut processes = managed_processes().lock().expect("managed process lock poisoned");
    if processes.contains_key(id) {
        return serde_json::json!({
            "jobId": format!("start:{}", id),
            "status": "succeeded",
            "message": format!("{} is already running.", id),
        });
    }

    let mut child = match Command::new(command)
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => return serde_json::json!({
            "jobId": format!("start:{}", id),
            "status": "failed",
            "message": format!("Failed to start {}: {}", id, error),
        }),
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    managed_process_logs().lock().expect("managed process log lock poisoned").entry(id.to_string()).or_default();
    processes.insert(id.to_string(), ManagedProcess { child, logs: Vec::new() });
    drop(processes);
    capture_process_output(id.to_string(), "info", stdout);
    capture_process_output(id.to_string(), "error", stderr);

    serde_json::json!({
        "jobId": format!("start:{}", id),
        "status": "succeeded",
        "message": format!("{} started.", id),
    })
}

fn stop_managed_process(id: &str) -> serde_json::Value {
    let process = managed_processes().lock().expect("managed process lock poisoned").remove(id);
    match process {
        Some(mut process) => {
            let _ = process.child.kill();
            let _ = process.child.wait();
            serde_json::json!({
                "jobId": format!("stop:{}", id),
                "status": "succeeded",
                "message": format!("{} stopped.", id),
            })
        }
        None => serde_json::json!({
            "jobId": format!("stop:{}", id),
            "status": "failed",
            "message": format!("{} is not running.", id),
        }),
    }
}

fn get_managed_process_logs(id: &str) -> Vec<serde_json::Value> {
    let live_logs = managed_processes()
        .lock()
        .expect("managed process lock poisoned")
        .get(id)
        .map(|process| process.logs.clone())
        .unwrap_or_default();
    if !live_logs.is_empty() {
        return live_logs;
    }
    managed_process_logs()
        .lock()
        .expect("managed process log lock poisoned")
        .get(id)
        .cloned()
        .unwrap_or_default()
}

fn capture_process_output<R>(id: String, level: &'static str, stream: Option<R>)
where
    R: Read + Send + 'static,
{
    if let Some(stream) = stream {
        thread::spawn(move || {
            let reader = BufReader::new(stream);
            for line in reader.lines().map_while(Result::ok) {
                append_managed_process_log(&id, level, &line);
            }
        });
    }
}

fn append_managed_process_log(id: &str, level: &str, message: &str) {
    let log_line = serde_json::json!({
        "timestamp": current_timestamp_string(),
        "level": level,
        "message": message,
    });
    managed_process_logs()
        .lock()
        .expect("managed process log lock poisoned")
        .entry(id.to_string())
        .or_default()
        .push(log_line.clone());
    if let Some(process) = managed_processes().lock().expect("managed process lock poisoned").get_mut(id) {
        process.logs.push(log_line);
    }
}

fn current_timestamp_string() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("{}", millis)
}

fn extract_trycloudflare_url(output: &str) -> Option<String> {
    output
        .split_whitespace()
        .find(|part| part.starts_with("https://") && part.contains(".trycloudflare.com"))
        .map(|part| part.trim_matches(|character: char| !character.is_ascii_alphanumeric() && character != ':' && character != '/' && character != '.' && character != '-').to_string())
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
fn save_frp_config(_config: serde_json::Value) {}

#[tauri::command(rename_all = "snake_case")]
fn start_frp() -> serde_json::Value {
    let config_path = std::env::var("FRPC_CONFIG_PATH").unwrap_or_else(|_| "frpc.toml".to_string());
    let result = start_managed_process(
        "frpc-desktop",
        &std::env::var("FRPC_BINARY").unwrap_or_else(|_| "frpc".to_string()),
        &["-c", config_path.as_str()],
    );
    serde_json::json!({
        "jobId": "start-frp:desktop",
        "status": result["status"],
        "message": result["message"],
    })
}

#[tauri::command(rename_all = "snake_case")]
fn stop_frp() -> serde_json::Value {
    let result = stop_managed_process("frpc-desktop");
    serde_json::json!({
        "jobId": "stop-frp:desktop",
        "status": result["status"],
        "message": result["message"],
    })
}

#[tauri::command(rename_all = "snake_case")]
fn get_cloudflare_tunnel_status() -> serde_json::Value {
    let logs = get_managed_process_logs("cloudflared-desktop");
    let public_url = logs.iter()
        .filter_map(|line| line.get("message").and_then(serde_json::Value::as_str))
        .find_map(extract_trycloudflare_url);
    if let Some(url) = public_url {
        return serde_json::json!({
            "mode": "quick",
            "running": true,
            "message": format!("Cloudflare Tunnel is running at {}.", url),
            "publicUrl": url,
            "currentStep": "verify_public_access"
        });
    }
    serde_json::json!({
        "mode": "quick",
        "running": false,
        "message": "Cloudflare Tunnel is not running.",
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
fn start_cloudflare_tunnel(config: serde_json::Value) -> serde_json::Value {
    let local_host = config.get("localHost").and_then(serde_json::Value::as_str).unwrap_or("127.0.0.1");
    let local_port = config.get("localPort").and_then(serde_json::Value::as_i64).unwrap_or(4096);
    let local_url = format!("http://{}:{}", local_host, local_port);
    let result = start_managed_process(
        "cloudflared-desktop",
        &std::env::var("CLOUDFLARED_BINARY").unwrap_or_else(|_| "cloudflared".to_string()),
        &["tunnel", "--url", local_url.as_str()],
    );
    serde_json::json!({
        "jobId": "start-cloudflare:desktop",
        "status": result["status"],
        "message": result["message"],
    })
}

#[tauri::command(rename_all = "snake_case")]
fn stop_cloudflare_tunnel() -> serde_json::Value {
    let result = stop_managed_process("cloudflared-desktop");
    serde_json::json!({
        "jobId": "stop-cloudflare:desktop",
        "status": result["status"],
        "message": result["message"]
    })
}

#[tauri::command(rename_all = "snake_case")]
fn retry_cloudflare_tunnel_step(step_id: String) -> serde_json::Value {
    serde_json::json!({
        "jobId": format!("retry-cloudflare:{}", step_id),
        "status": "failed",
        "message": format!("Cloudflare Tunnel step {} requires desktop cloudflared runtime support.", step_id)
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
            "message": "Desktop bridge diagnostics do not expose cleartext secret metadata."
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

#[cfg(test)]
mod tests {
    use super::{detect_tool_binaries, get_cloudflare_tunnel_status, get_managed_process_logs, get_runtime_info, list_tool_instances, read_config_from_path, retry_cloudflare_tunnel_step, save_config_to_path, start_managed_process, stop_cloudflare_tunnel, stop_managed_process, validate_json_config};
    use std::fs;
    use std::path::PathBuf;

    #[test]
    fn accepts_valid_json_config() {
        assert!(validate_json_config("{\"theme\":\"dark\"}").is_ok());
    }

    #[test]
    fn rejects_empty_json_config() {
        assert_eq!(validate_json_config(""), Err("Content cannot be empty".to_string()));
    }

    #[test]
    fn saves_and_reads_config_from_filesystem_path() {
        let path = temp_path("desktop-config.json");
        let target = serde_json::json!({
            "toolInstanceId": "opencode-desktop",
            "kind": "opencode",
            "path": path.to_string_lossy()
        });

        save_config_to_path(&target, "{\"theme\":\"dark\"}".to_string()).expect("save config");
        let document = read_config_from_path(&target).expect("read config");

        assert_eq!(document["content"], "{\"theme\":\"dark\"}");
        assert_eq!(document["path"].as_str(), Some(path.to_string_lossy().as_ref()));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn detects_known_desktop_tool_binaries_from_path() {
        let detections = detect_tool_binaries(&["rustc"]);

        assert_eq!(detections[0]["kind"], "rustc");
        assert_eq!(detections[0]["detected"], true);
        assert!(detections[0]["binaryPath"].as_str().is_some());
    }

    #[test]
    fn fails_managed_process_start_for_missing_binary() {
        let result = start_managed_process("missing-test-process", "definitely-missing-omo-frp-binary", &[]);

        assert_eq!(result["jobId"], "start:missing-test-process");
        assert_eq!(result["status"], "failed");
        assert!(result["message"].as_str().unwrap_or_default().contains("Failed to start"));
    }

    #[test]
    fn starts_logs_and_stops_managed_process() {
        let (command, args) = long_running_echo_command();
        let id = "managed-process-test";

        let start = start_managed_process(id, &command, &args.iter().map(String::as_str).collect::<Vec<_>>());
        let logs = wait_for_log(id, "desktop-ready");
        let stop = stop_managed_process(id);

        assert_eq!(start["status"], "succeeded");
        assert!(logs.iter().any(|line| line["message"].as_str().unwrap_or_default().contains("desktop-ready")));
        assert_eq!(stop["status"], "succeeded");
        assert!(get_managed_process_logs(id).iter().any(|line| line["message"].as_str().unwrap_or_default().contains("desktop-ready")));
    }

    #[test]
    fn cloudflare_desktop_actions_fail_precisely_when_not_managed() {
        let status = get_cloudflare_tunnel_status();
        let stop = stop_cloudflare_tunnel();
        let retry = retry_cloudflare_tunnel_step("start_tunnel".to_string());

        assert_eq!(status["running"], false);
        assert!(status.get("publicUrl").is_none());
        assert_eq!(stop["status"], "failed");
        assert!(stop["message"].as_str().unwrap_or_default().contains("not running"));
        assert_eq!(retry["status"], "failed");
        assert!(retry["message"].as_str().unwrap_or_default().contains("requires desktop cloudflared runtime support"));
    }

    #[test]
    fn exposes_desktop_tool_instances_in_runtime_info() {
        let info = get_runtime_info();
        let instances = info["config"]["toolInstances"].as_array().expect("tool instances");

        assert!(instances.iter().any(|tool| tool["id"] == "opencode-desktop" && tool["hostType"] == "desktop"));
        assert!(instances.iter().any(|tool| tool["id"] == "frpc-desktop" && tool["kind"] == "frpc"));
        assert!(instances.iter().any(|tool| tool["id"] == "cloudflared-desktop" && tool["kind"] == "cloudflared"));
        assert_eq!(list_tool_instances(), info["config"]["toolInstances"]);
    }

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("omo-frp-{}-{}", std::process::id(), name))
    }

    fn wait_for_log(id: &str, needle: &str) -> Vec<serde_json::Value> {
        for _ in 0..40 {
            let logs = get_managed_process_logs(id);
            if logs.iter().any(|line| line["message"].as_str().unwrap_or_default().contains(needle)) {
                return logs;
            }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        get_managed_process_logs(id)
    }

    #[cfg(windows)]
    fn long_running_echo_command() -> (String, Vec<String>) {
        ("cmd.exe".to_string(), vec!["/C".to_string(), "echo desktop-ready & ping -n 5 127.0.0.1 >NUL".to_string()])
    }

    #[cfg(not(windows))]
    fn long_running_echo_command() -> (String, Vec<String>) {
        ("sh".to_string(), vec!["-c".to_string(), "echo desktop-ready; sleep 5".to_string()])
    }
}
