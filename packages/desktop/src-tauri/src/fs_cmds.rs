// Phase 1 stubs for local filesystem commands. Real implementations wire up in
// Phase 1 proper: streaming ls, stat, chunked read, watch, thumbnails.

use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct Entry {
    name: String,
    path: String,
    size: u64,
    mtime: i64,
    is_dir: bool,
    is_symlink: bool,
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
        let mtime = md
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        out.push(Entry {
            name: e.file_name().to_string_lossy().into_owned(),
            path: e.path().to_string_lossy().into_owned(),
            size: md.len(),
            mtime,
            is_dir: md.is_dir(),
            is_symlink: md.file_type().is_symlink(),
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn stat(path: String) -> Result<Entry, String> {
    let p = PathBuf::from(&path);
    let md = tokio::fs::metadata(&p).await.map_err(|e| e.to_string())?;
    let mtime = md
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    Ok(Entry {
        name: p
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path,
        size: md.len(),
        mtime,
        is_dir: md.is_dir(),
        is_symlink: md.file_type().is_symlink(),
    })
}

#[tauri::command]
pub async fn read_chunk(path: String, offset: u64, len: u64) -> Result<Vec<u8>, String> {
    use tokio::io::{AsyncReadExt, AsyncSeekExt, SeekFrom};
    let mut f = tokio::fs::File::open(&path).await.map_err(|e| e.to_string())?;
    f.seek(SeekFrom::Start(offset)).await.map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; len as usize];
    let n = f.read(&mut buf).await.map_err(|e| e.to_string())?;
    buf.truncate(n);
    Ok(buf)
}
