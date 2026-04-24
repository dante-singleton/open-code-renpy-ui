// Tauri commands scaffold. Real FS / codegen commands land in M1/M2.
// See ARCHITECTURE.md §9 for the planned IPC surface.

#[tauri::command]
fn ping() -> &'static str {
    "pong"
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![ping, app_version])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
