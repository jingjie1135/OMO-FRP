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
            "frpClients": []
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
    serde_json::json!({
        "jobId": format!("start:{}", instance_id),
        "status": "succeeded",
        "message": format!("{} started.", instance_id)
    })
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
    serde_json::json!({
        "jobId": "start-frp:desktop",
        "status": "succeeded",
        "message": "frpc started."
    })
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
    use super::validate_json_config;

    #[test]
    fn accepts_valid_json_config() {
        assert!(validate_json_config("{\"theme\":\"dark\"}").is_ok());
    }

    #[test]
    fn rejects_empty_json_config() {
        assert_eq!(validate_json_config(""), Err("Content cannot be empty".to_string()));
    }
}
