// Local filesystem commands for LinkDrive desktop. All paths are absolute.
// Read-limited to 2 MiB for read_text to avoid blowing renderer memory on a
// misclicked binary.

use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct Entry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub mtime: i64,
    pub is_dir: bool,
    pub is_symlink: bool,
}

fn to_entry(name: String, path: PathBuf, md: &std::fs::Metadata, ft_symlink: bool) -> Entry {
    let mtime = md
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Entry {
        name,
        path: path.to_string_lossy().into_owned(),
        size: md.len(),
        mtime,
        is_dir: md.is_dir(),
        is_symlink: ft_symlink,
    }
}

#[tauri::command]
pub async fn ls(path: String) -> Result<Vec<Entry>, String> {
    let p = PathBuf::from(&path);
    let mut out = Vec::new();
    let mut rd = tokio::fs::read_dir(&p).await.map_err(|e| e.to_string())?;
    while let Some(e) = rd.next_entry().await.map_err(|e| e.to_string())? {
        let md = match e.metadata().await {
            Ok(m) => m,
            Err(_) => continue,
        };
        let ft_symlink = e
            .file_type()
            .await
            .map(|ft| ft.is_symlink())
            .unwrap_or(false);
        out.push(to_entry(
            e.file_name().to_string_lossy().into_owned(),
            e.path(),
            &md,
            ft_symlink,
        ));
    }
    Ok(out)
}

#[tauri::command]
pub async fn stat(path: String) -> Result<Entry, String> {
    let p = PathBuf::from(&path);
    let md = tokio::fs::symlink_metadata(&p).await.map_err(|e| e.to_string())?;
    let ft_symlink = md.file_type().is_symlink();
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_default();
    Ok(to_entry(name, p, &md, ft_symlink))
}

const MAX_TEXT_BYTES: u64 = 2 * 1024 * 1024;

#[tauri::command]
pub async fn read_text(path: String) -> Result<String, String> {
    let md = tokio::fs::metadata(&path).await.map_err(|e| e.to_string())?;
    if md.len() > MAX_TEXT_BYTES {
        return Err(format!(
            "file too large for text preview ({} bytes)",
            md.len()
        ));
    }
    tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn read_chunk(path: String, offset: u64, len: u64) -> Result<Vec<u8>, String> {
    use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
    let mut f = tokio::fs::File::open(&path).await.map_err(|e| e.to_string())?;
    f.seek(SeekFrom::Start(offset))
        .await
        .map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; len as usize];
    let n = f.read(&mut buf).await.map_err(|e| e.to_string())?;
    buf.truncate(n);
    Ok(buf)
}

#[tauri::command]
pub async fn mkdir(path: String) -> Result<(), String> {
    tokio::fs::create_dir_all(&path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename(from: String, to: String) -> Result<(), String> {
    tokio::fs::rename(&from, &to).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_path(path: String, recursive: bool) -> Result<(), String> {
    let md = tokio::fs::metadata(&path).await.map_err(|e| e.to_string())?;
    if md.is_dir() {
        if recursive {
            tokio::fs::remove_dir_all(&path).await.map_err(|e| e.to_string())
        } else {
            tokio::fs::remove_dir(&path).await.map_err(|e| e.to_string())
        }
    } else {
        tokio::fs::remove_file(&path).await.map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| "home directory unavailable".to_string())
}
