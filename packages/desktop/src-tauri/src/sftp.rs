// SFTP client for LinkDrive. Wraps russh + russh-sftp.
// Session pool keyed by host id. TOFU host-key pinning: Client handler
// captures the server public-key fingerprint; the JS layer decides whether
// to trust/pin or reject.

use base64::Engine;
use russh::client::{self, Config as RusshConfig, Handle, Handler};
use russh::keys::PublicKey;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::{FileType, OpenFlags};
use serde::Serialize;
use std::path::PathBuf;
use tauri::Emitter;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

// ---- Session pool ----

pub struct SftpHandle {
    _ssh: Handle<ClientHandler>,
    sftp: SftpSession,
    fingerprint: String,
}

#[derive(Default)]
pub struct SftpPool(pub Mutex<HashMap<String, Arc<Mutex<SftpHandle>>>>);

#[derive(Default)]
pub struct TransferCancels(pub std::sync::Mutex<HashMap<String, Arc<AtomicBool>>>);

fn register_cancel(app: &AppHandle, id: &str) -> Arc<AtomicBool> {
    use tauri::Manager;
    let flag = Arc::new(AtomicBool::new(false));
    let state = app.state::<TransferCancels>();
    state.0.lock().unwrap().insert(id.to_string(), flag.clone());
    flag
}

fn unregister_cancel(app: &AppHandle, id: &str) {
    use tauri::Manager;
    let state = app.state::<TransferCancels>();
    state.0.lock().unwrap().remove(id);
}

#[tauri::command]
pub fn ssh_cancel_transfer(app: AppHandle, transfer_id: String) -> Result<(), String> {
    use tauri::Manager;
    let state = app.state::<TransferCancels>();
    let map = state.0.lock().unwrap();
    if let Some(flag) = map.get(&transfer_id) {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

// ---- Client handler ----

pub struct ClientHandler {
    // When pinned_fingerprint is Some, connect rejects on mismatch.
    // When None, we accept any and the caller reads `seen_fingerprint`.
    pinned_fingerprint: Option<String>,
    seen_fingerprint: Arc<std::sync::Mutex<Option<String>>>,
}

fn sha256_fingerprint(key: &PublicKey) -> String {
    let bytes = key.to_bytes().unwrap_or_default();
    let mut h = Sha256::new();
    h.update(&bytes);
    let digest = h.finalize();
    format!(
        "SHA256:{}",
        base64::engine::general_purpose::STANDARD_NO_PAD.encode(digest)
    )
}

impl Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &PublicKey,
    ) -> Result<bool, Self::Error> {
        let fp = sha256_fingerprint(server_public_key);
        *self.seen_fingerprint.lock().unwrap() = Some(fp.clone());
        Ok(match &self.pinned_fingerprint {
            Some(pinned) => pinned == &fp,
            None => true,
        })
    }
}

// ---- Commands ----

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConnectResult {
    pub fingerprint: String,
    pub newly_trusted: bool,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectParams {
    pub host_id: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub password: Option<String>,
    pub pinned_fingerprint: Option<String>,
    // Private key PEM contents, if using key auth. For now we support file
    // reading on the JS side (user picks a file, JS reads and passes contents).
    pub private_key_pem: Option<String>,
    pub private_key_passphrase: Option<String>,
}

#[tauri::command]
pub async fn ssh_connect(app: AppHandle, params: ConnectParams) -> Result<ConnectResult, String> {
    let seen = Arc::new(std::sync::Mutex::new(None::<String>));
    let handler = ClientHandler {
        pinned_fingerprint: params.pinned_fingerprint.clone(),
        seen_fingerprint: seen.clone(),
    };

    let config = Arc::new(RusshConfig::default());
    let mut ssh = client::connect(config, (params.host.as_str(), params.port), handler)
        .await
        .map_err(|e| format!("connect: {e}"))?;

    // Authenticate
    let auth_ok = if let Some(pem) = params.private_key_pem {
        let passphrase = params.private_key_passphrase.as_deref();
        let keypair = russh::keys::decode_secret_key(&pem, passphrase)
            .map_err(|e| format!("key decode: {e}"))?;
        ssh.authenticate_publickey(
            params.user.as_str(),
            russh::keys::PrivateKeyWithHashAlg::new(Arc::new(keypair), None),
        )
        .await
        .map_err(|e| format!("auth: {e}"))?
        .success()
    } else if let Some(pw) = params.password {
        ssh.authenticate_password(params.user.as_str(), pw)
            .await
            .map_err(|e| format!("auth: {e}"))?
            .success()
    } else {
        return Err("no credentials provided".into());
    };

    if !auth_ok {
        return Err("authentication failed".into());
    }

    let channel = ssh
        .channel_open_session()
        .await
        .map_err(|e| format!("channel: {e}"))?;
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("subsystem: {e}"))?;
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("sftp init: {e}"))?;

    let fp = seen
        .lock()
        .unwrap()
        .clone()
        .unwrap_or_else(|| "unknown".to_string());
    let newly_trusted = params.pinned_fingerprint.is_none();

    let handle_struct = SftpHandle {
        _ssh: ssh,
        sftp,
        fingerprint: fp.clone(),
    };

    let pool = app.state::<SftpPool>();
    let mut map = pool.0.lock().await;
    map.insert(params.host_id.clone(), Arc::new(Mutex::new(handle_struct)));

    Ok(ConnectResult {
        fingerprint: fp,
        newly_trusted,
    })
}

#[tauri::command]
pub async fn ssh_disconnect(app: AppHandle, host_id: String) -> Result<(), String> {
    let pool = app.state::<SftpPool>();
    let mut map = pool.0.lock().await;
    map.remove(&host_id);
    Ok(())
}

#[tauri::command]
pub async fn ssh_is_connected(app: AppHandle, host_id: String) -> Result<bool, String> {
    let pool = app.state::<SftpPool>();
    let map = pool.0.lock().await;
    Ok(map.contains_key(&host_id))
}

async fn session_for(app: &AppHandle, host_id: &str) -> Result<Arc<Mutex<SftpHandle>>, String> {
    let pool = app.state::<SftpPool>();
    let map = pool.0.lock().await;
    map.get(host_id)
        .cloned()
        .ok_or_else(|| "not connected".to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SshEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub mtime: i64,
    pub is_dir: bool,
    pub is_symlink: bool,
    pub mode: Option<u32>,
}

fn join_posix(dir: &str, name: &str) -> String {
    if dir.ends_with('/') {
        format!("{dir}{name}")
    } else {
        format!("{dir}/{name}")
    }
}

#[tauri::command]
pub async fn ssh_ls(
    app: AppHandle,
    host_id: String,
    path: String,
) -> Result<Vec<SshEntry>, String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    let mut entries = handle
        .sftp
        .read_dir(&path)
        .await
        .map_err(|e| format!("read_dir: {e}"))?;
    let mut out = Vec::new();
    while let Some(e) = entries.next() {
        let name = e.file_name();
        if name == "." || name == ".." {
            continue;
        }
        let ft = e.file_type();
        let meta = e.metadata();
        // Prefer the POSIX mode bits when the server populated `permissions`;
        // fall back to the SFTP FileType enum. Many servers (and russh-sftp's
        // longname parser) misreport types if only one signal is used.
        let mode = meta.permissions;
        let type_bits = mode.map(|p| p & 0o170000);
        let is_dir = match type_bits {
            Some(b) => b == 0o040000,
            None => ft == FileType::Dir,
        };
        let is_symlink = match type_bits {
            Some(b) => b == 0o120000,
            None => ft == FileType::Symlink,
        };
        let size = meta.size.unwrap_or(0);
        let mtime = meta.mtime.map(|t| t as i64 * 1000).unwrap_or(0);
        out.push(SshEntry {
            path: join_posix(&path, &name),
            name,
            size,
            mtime,
            is_dir,
            is_symlink,
            mode,
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn ssh_stat(app: AppHandle, host_id: String, path: String) -> Result<SshEntry, String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    let meta = handle
        .sftp
        .metadata(&path)
        .await
        .map_err(|e| format!("stat: {e}"))?;
    let mode = meta.permissions;
    let type_bits = mode.map(|p| p & 0o170000);
    let is_dir = match type_bits {
        Some(b) => b == 0o040000,
        None => meta.is_dir(),
    };
    let is_symlink = match type_bits {
        Some(b) => b == 0o120000,
        None => meta.is_symlink(),
    };
    let size = meta.size.unwrap_or(0);
    let mtime = meta.mtime.map(|t| t as i64 * 1000).unwrap_or(0);
    let name = path.rsplit('/').next().unwrap_or("").to_string();
    Ok(SshEntry {
        name,
        path,
        size,
        mtime,
        is_dir,
        is_symlink,
        mode,
    })
}

const MAX_TEXT_BYTES: u64 = 2 * 1024 * 1024;

#[tauri::command]
pub async fn ssh_read_text(
    app: AppHandle,
    host_id: String,
    path: String,
) -> Result<String, String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    let meta = handle
        .sftp
        .metadata(&path)
        .await
        .map_err(|e| format!("stat: {e}"))?;
    if meta.size.unwrap_or(0) > MAX_TEXT_BYTES {
        return Err(format!(
            "file too large for text preview ({} bytes)",
            meta.size.unwrap_or(0)
        ));
    }
    let data = handle
        .sftp
        .read(&path)
        .await
        .map_err(|e| format!("read: {e}"))?;
    String::from_utf8(data).map_err(|_| "file is not valid UTF-8".into())
}

#[tauri::command]
pub async fn ssh_mkdir(app: AppHandle, host_id: String, path: String) -> Result<(), String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    handle
        .sftp
        .create_dir(&path)
        .await
        .map_err(|e| format!("mkdir: {e}"))
}

#[tauri::command]
pub async fn ssh_rename(
    app: AppHandle,
    host_id: String,
    from: String,
    to: String,
) -> Result<(), String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    handle
        .sftp
        .rename(&from, &to)
        .await
        .map_err(|e| format!("rename: {e}"))
}

#[tauri::command]
pub async fn ssh_delete_path(
    app: AppHandle,
    host_id: String,
    path: String,
    recursive: bool,
) -> Result<(), String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    let meta = handle
        .sftp
        .metadata(&path)
        .await
        .map_err(|e| format!("stat: {e}"))?;
    if meta.is_dir() {
        if recursive {
            ssh_rmdir_recursive(&handle.sftp, &path).await?;
        } else {
            handle
                .sftp
                .remove_dir(&path)
                .await
                .map_err(|e| format!("rmdir: {e}"))?;
        }
    } else {
        handle
            .sftp
            .remove_file(&path)
            .await
            .map_err(|e| format!("unlink: {e}"))?;
    }
    Ok(())
}

async fn ssh_rmdir_recursive(sftp: &SftpSession, path: &str) -> Result<(), String> {
    let mut stack: Vec<String> = vec![path.to_string()];
    let mut post: Vec<String> = Vec::new();
    while let Some(p) = stack.pop() {
        let mut rd = sftp
            .read_dir(&p)
            .await
            .map_err(|e| format!("read_dir: {e}"))?;
        while let Some(e) = rd.next() {
            let name = e.file_name();
            if name == "." || name == ".." {
                continue;
            }
            let child = join_posix(&p, &name);
            if e.file_type() == FileType::Dir {
                stack.push(child.clone());
            } else {
                sftp.remove_file(&child)
                    .await
                    .map_err(|e| format!("unlink {child}: {e}"))?;
            }
        }
        post.push(p);
    }
    for p in post.into_iter().rev() {
        sftp.remove_dir(&p)
            .await
            .map_err(|e| format!("rmdir {p}: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn ssh_dir_size(
    app: AppHandle,
    host_id: String,
    path: String,
) -> Result<u64, String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    let mut stack: Vec<String> = vec![path];
    let mut total: u64 = 0;
    while let Some(p) = stack.pop() {
        let mut rd = match handle.sftp.read_dir(&p).await {
            Ok(rd) => rd,
            Err(_) => continue,
        };
        while let Some(e) = rd.next() {
            let name = e.file_name();
            if name == "." || name == ".." {
                continue;
            }
            let ft = e.file_type();
            let child = join_posix(&p, &name);
            if ft == FileType::Symlink {
                continue;
            }
            if ft == FileType::Dir {
                stack.push(child);
            } else {
                total = total.saturating_add(e.metadata().size.unwrap_or(0));
            }
        }
    }
    Ok(total)
}

// Returns raw bytes of a file, capped at MAX_READ_BYTES to avoid blowing the
// renderer's memory on accidental huge-file reads. Used for image previews
// (base64 data URLs) and similar small reads.
const MAX_READ_BYTES: u64 = 64 * 1024 * 1024;

#[tauri::command]
pub async fn ssh_read_bytes(
    app: AppHandle,
    host_id: String,
    path: String,
) -> Result<Vec<u8>, String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    let meta = handle
        .sftp
        .metadata(&path)
        .await
        .map_err(|e| format!("stat: {e}"))?;
    if meta.size.unwrap_or(0) > MAX_READ_BYTES {
        return Err(format!(
            "file too large ({} bytes, max {MAX_READ_BYTES})",
            meta.size.unwrap_or(0)
        ));
    }
    handle
        .sftp
        .read(&path)
        .await
        .map_err(|e| format!("read: {e}"))
}

#[tauri::command]
pub async fn ssh_home(app: AppHandle, host_id: String) -> Result<String, String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    handle
        .sftp
        .canonicalize(".")
        .await
        .map_err(|e| format!("home: {e}"))
}

// ---- Transfers ----

const CHUNK: usize = 64 * 1024;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TransferEvent<'a> {
    id: &'a str,
    bytes: u64,
    total: u64,
    state: &'a str,
    error: Option<String>,
}

fn emit_transfer(app: &AppHandle, id: &str, bytes: u64, total: u64, state: &str, error: Option<String>) {
    let _ = app.emit(
        "transfer:progress",
        TransferEvent {
            id,
            bytes,
            total,
            state,
            error,
        },
    );
}

#[tauri::command]
pub async fn ssh_download_file(
    app: AppHandle,
    transfer_id: String,
    host_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;

    let meta = handle
        .sftp
        .metadata(&remote_path)
        .await
        .map_err(|e| format!("stat: {e}"))?;
    let total = meta.size.unwrap_or(0);

    emit_transfer(&app, &transfer_id, 0, total, "running", None);

    let mut remote = match handle
        .sftp
        .open_with_flags(&remote_path, OpenFlags::READ)
        .await
    {
        Ok(f) => f,
        Err(e) => {
            let msg = format!("open remote: {e}");
            emit_transfer(&app, &transfer_id, 0, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
    };

    let mut local = match tokio::fs::File::create(&local_path).await {
        Ok(f) => f,
        Err(e) => {
            let msg = format!("create local: {e}");
            emit_transfer(&app, &transfer_id, 0, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
    };

    let mut buf = vec![0u8; CHUNK];
    let mut sent: u64 = 0;
    loop {
        let n = match remote.read(&mut buf).await {
            Ok(n) => n,
            Err(e) => {
                let msg = format!("read: {e}");
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                return Err(msg);
            }
        };
        if n == 0 {
            break;
        }
        if let Err(e) = local.write_all(&buf[..n]).await {
            let msg = format!("write: {e}");
            emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
        sent += n as u64;
        emit_transfer(&app, &transfer_id, sent, total, "running", None);
    }

    if let Err(e) = local.flush().await {
        let msg = format!("flush: {e}");
        emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
        return Err(msg);
    }

    emit_transfer(&app, &transfer_id, sent, total, "completed", None);
    Ok(())
}

// Recursively walks a remote directory, streams every file into the mirrored
// local tree. Progress events sum all file bytes so the drawer shows one
// aggregate bar per top-level operation.
#[tauri::command]
pub async fn ssh_download_dir(
    app: AppHandle,
    transfer_id: String,
    host_id: String,
    remote_path: String,
    local_path: String,
) -> Result<(), String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;

    // Walk remote to gather total bytes + file list (relative paths).
    let mut files: Vec<(String, u64)> = Vec::new();
    let mut dirs_to_create: Vec<String> = vec![String::new()];
    let mut stack: Vec<String> = vec![String::new()];
    while let Some(rel) = stack.pop() {
        let p = if rel.is_empty() {
            remote_path.clone()
        } else {
            join_posix(&remote_path, &rel)
        };
        let mut rd = match handle.sftp.read_dir(&p).await {
            Ok(r) => r,
            Err(e) => {
                let msg = format!("read_dir {p}: {e}");
                emit_transfer(&app, &transfer_id, 0, 0, "failed", Some(msg.clone()));
                return Err(msg);
            }
        };
        while let Some(entry) = rd.next() {
            let name = entry.file_name();
            if name == "." || name == ".." {
                continue;
            }
            let child_rel = if rel.is_empty() {
                name.clone()
            } else {
                format!("{rel}/{name}")
            };
            let ft = entry.file_type();
            let meta = entry.metadata();
            let type_bits = meta.permissions.map(|m| m & 0o170000);
            let is_dir = match type_bits {
                Some(b) => b == 0o040000,
                None => ft == FileType::Dir,
            };
            let is_symlink = match type_bits {
                Some(b) => b == 0o120000,
                None => ft == FileType::Symlink,
            };
            if is_symlink {
                continue;
            }
            if is_dir {
                dirs_to_create.push(child_rel.clone());
                stack.push(child_rel);
            } else {
                files.push((child_rel, meta.size.unwrap_or(0)));
            }
        }
    }

    let total: u64 = files.iter().map(|(_, s)| *s).sum();
    emit_transfer(&app, &transfer_id, 0, total, "running", None);

    // Create all local dirs first.
    for rel in &dirs_to_create {
        let local_sub = if rel.is_empty() {
            PathBuf::from(&local_path)
        } else {
            PathBuf::from(&local_path).join(rel.replace('/', std::path::MAIN_SEPARATOR_STR))
        };
        if let Err(e) = tokio::fs::create_dir_all(&local_sub).await {
            let msg = format!("mkdir {}: {e}", local_sub.display());
            emit_transfer(&app, &transfer_id, 0, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
    }

    // Copy each file.
    let cancel = register_cancel(&app, &transfer_id);
    let mut sent: u64 = 0;
    let mut buf = vec![0u8; CHUNK];
    for (rel, _sz) in &files {
        if cancel.load(Ordering::SeqCst) {
            unregister_cancel(&app, &transfer_id);
            emit_transfer(&app, &transfer_id, sent, total, "failed", Some("cancelled".into()));
            return Err("cancelled".into());
        }
        let remote_full = join_posix(&remote_path, rel);
        let local_full = PathBuf::from(&local_path).join(
            rel.replace('/', std::path::MAIN_SEPARATOR_STR),
        );
        let mut remote = match handle
            .sftp
            .open_with_flags(&remote_full, OpenFlags::READ)
            .await
        {
            Ok(f) => f,
            Err(e) => {
                let msg = format!("open {remote_full}: {e}");
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                return Err(msg);
            }
        };
        let mut local = match tokio::fs::File::create(&local_full).await {
            Ok(f) => f,
            Err(e) => {
                let msg = format!("create {}: {e}", local_full.display());
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                return Err(msg);
            }
        };
        loop {
            if cancel.load(Ordering::SeqCst) {
                unregister_cancel(&app, &transfer_id);
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some("cancelled".into()));
                return Err("cancelled".into());
            }
            let n = match remote.read(&mut buf).await {
                Ok(n) => n,
                Err(e) => {
                    let msg = format!("read {remote_full}: {e}");
                    unregister_cancel(&app, &transfer_id);
                    emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                    return Err(msg);
                }
            };
            if n == 0 {
                break;
            }
            if let Err(e) = local.write_all(&buf[..n]).await {
                let msg = format!("write {}: {e}", local_full.display());
                unregister_cancel(&app, &transfer_id);
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                return Err(msg);
            }
            sent += n as u64;
            emit_transfer(&app, &transfer_id, sent, total, "running", None);
        }
        if let Err(e) = local.flush().await {
            let msg = format!("flush {}: {e}", local_full.display());
            unregister_cancel(&app, &transfer_id);
            emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
    }

    unregister_cancel(&app, &transfer_id);
    emit_transfer(&app, &transfer_id, sent, total, "completed", None);
    Ok(())
}

#[tauri::command]
pub async fn ssh_upload_dir(
    app: AppHandle,
    transfer_id: String,
    host_id: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;

    // Walk local tree.
    let mut files: Vec<(String, u64)> = Vec::new();
    let mut dirs_to_create: Vec<String> = vec![String::new()];
    let mut stack: Vec<PathBuf> = vec![PathBuf::from(&local_path)];
    let base = PathBuf::from(&local_path);
    while let Some(p) = stack.pop() {
        let mut rd = match tokio::fs::read_dir(&p).await {
            Ok(r) => r,
            Err(e) => {
                let msg = format!("read_dir {}: {e}", p.display());
                emit_transfer(&app, &transfer_id, 0, 0, "failed", Some(msg.clone()));
                return Err(msg);
            }
        };
        while let Ok(Some(entry)) = rd.next_entry().await {
            let path = entry.path();
            let md = match tokio::fs::symlink_metadata(&path).await {
                Ok(m) => m,
                Err(_) => continue,
            };
            if md.file_type().is_symlink() {
                continue;
            }
            let rel = match path.strip_prefix(&base) {
                Ok(r) => r
                    .to_string_lossy()
                    .replace(std::path::MAIN_SEPARATOR, "/"),
                Err(_) => continue,
            };
            if md.is_dir() {
                dirs_to_create.push(rel.clone());
                stack.push(path);
            } else {
                files.push((rel, md.len()));
            }
        }
    }

    let total: u64 = files.iter().map(|(_, s)| *s).sum();
    emit_transfer(&app, &transfer_id, 0, total, "running", None);

    // Create remote dirs.
    for rel in &dirs_to_create {
        let remote_sub = if rel.is_empty() {
            remote_path.clone()
        } else {
            join_posix(&remote_path, rel)
        };
        // Ignore 'already exists' errors.
        let _ = handle.sftp.create_dir(&remote_sub).await;
    }

    let cancel = register_cancel(&app, &transfer_id);
    let mut sent: u64 = 0;
    let mut buf = vec![0u8; CHUNK];
    for (rel, _sz) in &files {
        if cancel.load(Ordering::SeqCst) {
            unregister_cancel(&app, &transfer_id);
            emit_transfer(&app, &transfer_id, sent, total, "failed", Some("cancelled".into()));
            return Err("cancelled".into());
        }
        let local_full =
            PathBuf::from(&local_path).join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        let remote_full = join_posix(&remote_path, rel);

        let mut local = match tokio::fs::File::open(&local_full).await {
            Ok(f) => f,
            Err(e) => {
                let msg = format!("open {}: {e}", local_full.display());
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                return Err(msg);
            }
        };
        let mut remote = match handle
            .sftp
            .open_with_flags(
                &remote_full,
                OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE,
            )
            .await
        {
            Ok(f) => f,
            Err(e) => {
                let msg = format!("open remote {remote_full}: {e}");
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                return Err(msg);
            }
        };
        loop {
            let n = match local.read(&mut buf).await {
                Ok(n) => n,
                Err(e) => {
                    let msg = format!("read {}: {e}", local_full.display());
                    emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                    return Err(msg);
                }
            };
            if n == 0 {
                break;
            }
            if let Err(e) = remote.write_all(&buf[..n]).await {
                let msg = format!("write remote {remote_full}: {e}");
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                return Err(msg);
            }
            sent += n as u64;
            emit_transfer(&app, &transfer_id, sent, total, "running", None);
        }
        if let Err(e) = remote.flush().await {
            let msg = format!("flush remote {remote_full}: {e}");
            emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
        let _ = remote.shutdown().await;
    }

    emit_transfer(&app, &transfer_id, sent, total, "completed", None);
    Ok(())
}

#[tauri::command]
pub async fn ssh_upload_file(
    app: AppHandle,
    transfer_id: String,
    host_id: String,
    local_path: String,
    remote_path: String,
) -> Result<(), String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;

    let meta = match tokio::fs::metadata(&local_path).await {
        Ok(m) => m,
        Err(e) => {
            let msg = format!("stat local: {e}");
            emit_transfer(&app, &transfer_id, 0, 0, "failed", Some(msg.clone()));
            return Err(msg);
        }
    };
    let total = meta.len();
    emit_transfer(&app, &transfer_id, 0, total, "running", None);

    let mut local = match tokio::fs::File::open(&local_path).await {
        Ok(f) => f,
        Err(e) => {
            let msg = format!("open local: {e}");
            emit_transfer(&app, &transfer_id, 0, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
    };

    let mut remote = match handle
        .sftp
        .open_with_flags(
            &remote_path,
            OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::TRUNCATE,
        )
        .await
    {
        Ok(f) => f,
        Err(e) => {
            let msg = format!("open remote: {e}");
            emit_transfer(&app, &transfer_id, 0, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
    };

    let mut buf = vec![0u8; CHUNK];
    let mut sent: u64 = 0;
    loop {
        let n = match local.read(&mut buf).await {
            Ok(n) => n,
            Err(e) => {
                let msg = format!("read local: {e}");
                emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
                return Err(msg);
            }
        };
        if n == 0 {
            break;
        }
        if let Err(e) = remote.write_all(&buf[..n]).await {
            let msg = format!("write remote: {e}");
            emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
            return Err(msg);
        }
        sent += n as u64;
        emit_transfer(&app, &transfer_id, sent, total, "running", None);
    }

    if let Err(e) = remote.flush().await {
        let msg = format!("flush remote: {e}");
        emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
        return Err(msg);
    }
    if let Err(e) = remote.shutdown().await {
        let msg = format!("close remote: {e}");
        emit_transfer(&app, &transfer_id, sent, total, "failed", Some(msg.clone()));
        return Err(msg);
    }

    emit_transfer(&app, &transfer_id, sent, total, "completed", None);
    Ok(())
}

#[tauri::command]
pub fn ssh_fingerprint_of(app: AppHandle, host_id: String) -> Result<Option<String>, String> {
    let pool = app.state::<SftpPool>();
    let map = pool
        .0
        .try_lock()
        .map_err(|_| "busy".to_string())?;
    Ok(map.get(&host_id).map(|_| "pending".to_string()))
    // Real fingerprint requires async; better fetch via ssh_connect result
    // stored client-side.
}
