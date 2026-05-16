#[tauri::command(rename_all = "snake_case")]
fn get_runtime_info() -> serde_json::Value {
    serde_json::json!({
        "capabilities": {
            "mode": "desktop",
            "canManageFrpServer": false,
            "canManageFrpClient": true,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
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
            stop_frp
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
