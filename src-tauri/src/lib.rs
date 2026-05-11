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
fn list_endpoints() -> serde_json::Value {
    serde_json::json!([])
}

#[tauri::command(rename_all = "snake_case")]
fn get_frp_status() -> serde_json::Value {
    serde_json::json!({
        "mode": "client",
        "running": false,
        "message": "frpc is not running yet."
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![get_runtime_info, detect_tools, list_endpoints, get_frp_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
