// Single-binary installer / uninstaller logic.
// When LinkDrive.exe lives at the registered install path, it runs as the app.
// When run from Downloads or with --uninstall, it runs installer / uninstaller UIs.
// Mirrors the pattern used by SyncPad.

use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

pub const APP_NAME: &str = "LinkDrive";
pub const MAIN_BINARY: &str = "LinkDrive.exe";
pub const VERSION: &str = "0.1.0";
pub const PUBLISHER: &str = "MoltenPixelStudio";
pub const UNINSTALL_KEY: &str =
    "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\com.moltenpixel.linkdrive";

#[derive(Copy, Clone, Eq, PartialEq, Debug, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Mode {
    App,
    Install,
    Uninstall,
}

pub struct ModeState(pub std::sync::Mutex<Mode>);

pub fn default_install_dir() -> PathBuf {
    #[cfg(windows)]
    {
        dirs::data_local_dir()
            .unwrap_or_else(std::env::temp_dir)
            .join(APP_NAME)
    }
    #[cfg(not(windows))]
    {
        std::env::temp_dir().join(APP_NAME)
    }
}

pub fn resolve_install_dir() -> PathBuf {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey(UNINSTALL_KEY) {
            if let Ok(loc) = key.get_value::<String, _>("InstallLocation") {
                let p = PathBuf::from(loc);
                if !p.as_os_str().is_empty() {
                    return p;
                }
            }
        }
    }
    default_install_dir()
}

pub fn detect_mode() -> Mode {
    if std::env::args().any(|a| a == "--uninstall") {
        return Mode::Uninstall;
    }
    let exe = std::env::current_exe().ok().and_then(|p| p.canonicalize().ok());
    if let Some(exe) = exe {
        for dir in [default_install_dir(), resolve_install_dir()] {
            if let Ok(b) = dir.join(MAIN_BINARY).canonicalize() {
                if exe == b {
                    return Mode::App;
                }
            }
        }
    }
    Mode::Install
}

#[derive(Serialize, Clone)]
struct Progress {
    step: &'static str,
    progress: f32,
}

fn emit(app: &AppHandle, event: &str, step: &'static str, progress: f32) {
    let _ = app.emit(event, Progress { step, progress });
}

#[tauri::command]
pub fn get_mode(app: AppHandle) -> Mode {
    use tauri::Manager;
    *app.state::<ModeState>().0.lock().unwrap()
}

#[tauri::command]
pub fn current_version() -> &'static str {
    VERSION
}

#[tauri::command]
pub fn get_default_install_dir() -> String {
    default_install_dir().to_string_lossy().to_string()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExistingInstall {
    path: String,
    version: String,
}

#[tauri::command]
pub fn get_existing_install() -> Option<ExistingInstall> {
    #[cfg(windows)]
    {
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey(UNINSTALL_KEY) {
            let path: Result<String, _> = key.get_value("InstallLocation");
            let version: Result<String, _> = key.get_value("DisplayVersion");
            if let (Ok(path), Ok(version)) = (path, version) {
                if !path.is_empty() && std::path::Path::new(&path).join(MAIN_BINARY).exists() {
                    return Some(ExistingInstall { path, version });
                }
            }
        }
    }
    None
}

#[derive(serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstallOptions {
    install_dir: Option<String>,
    start_menu_shortcut: Option<bool>,
    desktop_shortcut: Option<bool>,
}

#[cfg(windows)]
fn start_menu_shortcut_path() -> Option<PathBuf> {
    let appdata = std::env::var_os("APPDATA")?;
    Some(
        PathBuf::from(appdata)
            .join(r"Microsoft\Windows\Start Menu\Programs")
            .join(format!("{APP_NAME}.lnk")),
    )
}

#[cfg(windows)]
fn desktop_shortcut_path() -> Option<PathBuf> {
    dirs::desktop_dir().map(|p| p.join(format!("{APP_NAME}.lnk")))
}

#[cfg(windows)]
fn create_start_menu_shortcut(target: &std::path::Path) -> Result<(), String> {
    use mslnk::ShellLink;
    let Some(link_path) = start_menu_shortcut_path() else {
        return Err("Could not locate Start Menu folder".into());
    };
    if let Some(parent) = link_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let sl = ShellLink::new(target).map_err(|e| format!("shortcut: {e}"))?;
    sl.create_lnk(&link_path).map_err(|e| format!("shortcut write: {e}"))?;
    Ok(())
}

#[cfg(not(windows))]
fn create_start_menu_shortcut(_target: &std::path::Path) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn create_desktop_shortcut(target: &std::path::Path) -> Result<(), String> {
    use mslnk::ShellLink;
    let Some(link_path) = desktop_shortcut_path() else {
        return Err("Could not locate Desktop folder".into());
    };
    let sl = ShellLink::new(target).map_err(|e| format!("shortcut: {e}"))?;
    sl.create_lnk(&link_path).map_err(|e| format!("shortcut write: {e}"))?;
    Ok(())
}

#[cfg(not(windows))]
fn create_desktop_shortcut(_target: &std::path::Path) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn write_uninstall_registry(
    install_path: &std::path::Path,
    exe: &std::path::Path,
) -> std::io::Result<()> {
    use winreg::enums::*;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu.create_subkey(UNINSTALL_KEY)?;
    key.set_value("DisplayName", &APP_NAME.to_string())?;
    key.set_value("DisplayVersion", &VERSION.to_string())?;
    key.set_value("Publisher", &PUBLISHER.to_string())?;
    key.set_value("InstallLocation", &install_path.to_string_lossy().to_string())?;
    key.set_value("DisplayIcon", &format!("{},0", exe.to_string_lossy()))?;
    let uninst_cmd = format!("\"{}\" --uninstall", exe.to_string_lossy());
    key.set_value("UninstallString", &uninst_cmd)?;
    key.set_value("QuietUninstallString", &uninst_cmd)?;
    key.set_value("NoModify", &1u32)?;
    key.set_value("NoRepair", &1u32)?;
    Ok(())
}

#[cfg(windows)]
fn kill_running_instances() {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let self_pid = std::process::id();
    let pid_filter = format!("PID ne {self_pid}");
    let _ = std::process::Command::new("taskkill")
        .args(["/IM", MAIN_BINARY, "/FI", &pid_filter])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    std::thread::sleep(std::time::Duration::from_millis(300));
    let _ = std::process::Command::new("taskkill")
        .args(["/F", "/IM", MAIN_BINARY, "/FI", &pid_filter])
        .creation_flags(CREATE_NO_WINDOW)
        .output();
    std::thread::sleep(std::time::Duration::from_millis(250));
}

#[cfg(not(windows))]
fn kill_running_instances() {}

#[tauri::command]
pub async fn run_install(app: AppHandle, options: Option<InstallOptions>) -> Result<(), String> {
    let opts = options.unwrap_or_default();
    emit(&app, "install:progress", "Preparing…", 0.08);
    std::thread::sleep(std::time::Duration::from_millis(180));

    emit(&app, "install:progress", "Closing LinkDrive…", 0.15);
    kill_running_instances();

    let src = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    let dir = match opts
        .install_dir
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(custom) => PathBuf::from(custom),
        None => default_install_dir(),
    };
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {e}"))?;
    let dst = dir.join(MAIN_BINARY);

    emit(&app, "install:progress", "Copying files…", 0.30);
    let tmp = dir.join(format!("{MAIN_BINARY}.new"));
    if src.canonicalize().ok() != dst.canonicalize().ok() {
        std::fs::copy(&src, &tmp).map_err(|e| format!("copy: {e}"))?;
        if dst.exists() {
            std::fs::remove_file(&dst).map_err(|e| {
                format!("remove old: {e} (is LinkDrive running? close it and retry)")
            })?;
        }
        std::fs::rename(&tmp, &dst).map_err(|e| format!("rename: {e}"))?;
    }

    let want_start_menu = opts.start_menu_shortcut.unwrap_or(true);
    let want_desktop = opts.desktop_shortcut.unwrap_or(false);

    emit(&app, "install:progress", "Creating shortcuts…", 0.60);
    if want_start_menu {
        let _ = create_start_menu_shortcut(&dst);
    }
    if want_desktop {
        let _ = create_desktop_shortcut(&dst);
    }

    #[cfg(windows)]
    {
        emit(&app, "install:progress", "Registering uninstaller…", 0.82);
        let _ = write_uninstall_registry(&dir, &dst);
    }

    emit(&app, "install:progress", "Finishing up…", 0.95);
    std::thread::sleep(std::time::Duration::from_millis(120));
    emit(&app, "install:progress", "Done", 1.0);
    Ok(())
}

#[tauri::command]
pub fn launch_and_exit(app: AppHandle) -> Result<(), String> {
    let exe = resolve_install_dir().join(MAIN_BINARY);
    if !exe.exists() {
        return Err(format!("Executable missing: {}", exe.display()));
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const DETACHED_PROCESS: u32 = 0x00000008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;
        std::process::Command::new(&exe)
            .creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP)
            .spawn()
            .map_err(|e| format!("launch: {e}"))?;
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new(&exe)
            .spawn()
            .map_err(|e| format!("launch: {e}"))?;
    }
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub async fn run_uninstall(app: AppHandle) -> Result<(), String> {
    emit(&app, "uninstall:progress", "Preparing…", 0.08);
    std::thread::sleep(std::time::Duration::from_millis(150));

    #[cfg(windows)]
    {
        emit(&app, "uninstall:progress", "Removing Start Menu entry…", 0.30);
        if let Some(lnk) = start_menu_shortcut_path() {
            let _ = std::fs::remove_file(&lnk);
        }
        if let Some(lnk) = desktop_shortcut_path() {
            let _ = std::fs::remove_file(&lnk);
        }

        emit(
            &app,
            "uninstall:progress",
            "Clearing Add/Remove Programs entry…",
            0.55,
        );
        use winreg::enums::*;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        let _ = hkcu.delete_subkey_all(UNINSTALL_KEY);
    }

    emit(&app, "uninstall:progress", "Removing files…", 0.85);
    let dir = resolve_install_dir();
    if dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let is_self = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .map_or(false, |n| n.eq_ignore_ascii_case(MAIN_BINARY));
                if is_self {
                    continue;
                }
                let _ = if path.is_dir() {
                    std::fs::remove_dir_all(&path)
                } else {
                    std::fs::remove_file(&path)
                };
            }
        }
    }

    emit(&app, "uninstall:progress", "Done", 1.0);
    std::thread::sleep(std::time::Duration::from_millis(100));
    Ok(())
}

#[cfg(windows)]
fn schedule_dir_cleanup(dir: &std::path::Path) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    // CREATE_NO_WINDOW hides the console window. DETACHED_PROCESS is
    // mutually exclusive with CREATE_NO_WINDOW per MSDN — combining them
    // actually makes the cmd window flash on screen. Use only CREATE_NO_WINDOW.
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let cmd = format!(
        "ping 127.0.0.1 -n 3 > nul & rd /s /q \"{}\"",
        dir.display()
    );
    std::process::Command::new("cmd")
        .args(["/C", &cmd])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()?;
    Ok(())
}

#[tauri::command]
pub fn finalize_uninstall(app: AppHandle) {
    #[cfg(windows)]
    {
        let _ = schedule_dir_cleanup(&resolve_install_dir());
    }
    app.exit(0);
}

#[tauri::command]
pub fn close_app(app: AppHandle) {
    app.exit(0);
}
