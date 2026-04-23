mod fs_cmds;
mod install;
mod sftp;

use install::{Mode, ModeState};
use sftp::SftpPool;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mode = install::detect_mode();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(ModeState(std::sync::Mutex::new(mode)))
        .manage(SftpPool::default())
        .invoke_handler(tauri::generate_handler![
            // mode + install/uninstall
            install::get_mode,
            install::current_version,
            install::get_default_install_dir,
            install::get_existing_install,
            install::run_install,
            install::launch_and_exit,
            install::run_uninstall,
            install::finalize_uninstall,
            install::close_app,
            // filesystem (App mode only, but registered always — unused
            // commands are harmless)
            fs_cmds::ls,
            fs_cmds::stat,
            fs_cmds::read_text,
            fs_cmds::read_chunk,
            fs_cmds::mkdir,
            fs_cmds::rename,
            fs_cmds::delete_path,
            fs_cmds::dir_size,
            fs_cmds::home_dir,
            // sftp
            sftp::ssh_connect,
            sftp::ssh_disconnect,
            sftp::ssh_is_connected,
            sftp::ssh_ls,
            sftp::ssh_stat,
            sftp::ssh_read_text,
            sftp::ssh_read_bytes,
            sftp::ssh_home,
            sftp::ssh_mkdir,
            sftp::ssh_rename,
            sftp::ssh_delete_path,
            sftp::ssh_dir_size,
            sftp::ssh_download_file,
            sftp::ssh_upload_file,
        ])
        .setup(move |app| {
            let Some(window) = app.get_webview_window("main") else {
                return Ok(());
            };
            match mode {
                Mode::Install => {
                    let _ = window.set_title("Install LinkDrive");
                    let _ = window.set_size(tauri::LogicalSize::new(480.0, 620.0));
                    let _ = window.set_resizable(false);
                    let _ = window.set_maximizable(false);
                    let _ = window.center();
                }
                Mode::Uninstall => {
                    let _ = window.set_title("Uninstall LinkDrive");
                    let _ = window.set_size(tauri::LogicalSize::new(460.0, 440.0));
                    let _ = window.set_resizable(false);
                    let _ = window.set_maximizable(false);
                    let _ = window.center();
                }
                Mode::App => {
                    let _ = window.set_title("LinkDrive");
                    let _ = window.maximize();
                }
            }
            let _ = window.show();
            let _ = window.set_focus();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running LinkDrive");
}
