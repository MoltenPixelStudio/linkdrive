// SFTP client for LinkDrive. Wraps russh + russh-sftp.
// Session pool keyed by host id. TOFU host-key pinning: Client handler
// captures the server public-key fingerprint; the JS layer decides whether
// to trust/pin or reject.

use base64::Engine;
use russh::client::{self, Config as RusshConfig, Handle, Handler};
use russh::keys::PublicKey;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::FileType;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
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
        let is_dir = ft == FileType::Dir;
        let is_symlink = ft == FileType::Symlink;
        let meta = e.metadata();
        let size = meta.size.unwrap_or(0);
        let mtime = meta.mtime.map(|t| t as i64 * 1000).unwrap_or(0);
        let mode = meta.permissions;
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
    let is_dir = meta.is_dir();
    let is_symlink = meta.is_symlink();
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
        mode: meta.permissions,
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
pub async fn ssh_home(app: AppHandle, host_id: String) -> Result<String, String> {
    let sess = session_for(&app, &host_id).await?;
    let handle = sess.lock().await;
    handle
        .sftp
        .canonicalize(".")
        .await
        .map_err(|e| format!("home: {e}"))
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
