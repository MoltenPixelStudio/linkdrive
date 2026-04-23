mod fs_cmds;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            fs_cmds::ls,
            fs_cmds::stat,
            fs_cmds::read_chunk,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LinkDrive");
}
