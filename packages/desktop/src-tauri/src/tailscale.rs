// Best-effort Tailscale detection. Runs `tailscale status --json` and surfaces
// the peer list so AddHostModal can offer Tailnet hosts in a dropdown.

use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TailscalePeer {
    pub name: String,
    pub dns: String,
    pub ip: String,
    pub online: bool,
    pub os: Option<String>,
}

#[cfg(windows)]
fn command() -> std::process::Command {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let mut cmd = std::process::Command::new("tailscale");
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

#[cfg(not(windows))]
fn command() -> std::process::Command {
    std::process::Command::new("tailscale")
}

#[tauri::command]
pub fn tailscale_peers() -> Result<Vec<TailscalePeer>, String> {
    let mut cmd = command();
    let output = cmd
        .args(["status", "--json"])
        .output()
        .map_err(|e| format!("tailscale not installed or not in PATH: {e}"))?;
    if !output.status.success() {
        return Err(format!(
            "tailscale status exited {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let json: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|e| format!("bad json: {e}"))?;
    let mut out: Vec<TailscalePeer> = Vec::new();
    if let Some(obj) = json.get("Peer").and_then(|v| v.as_object()) {
        for (_, v) in obj {
            let name = v
                .get("HostName")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let dns = v
                .get("DNSName")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim_end_matches('.')
                .to_string();
            let ip = v
                .get("TailscaleIPs")
                .and_then(|x| x.as_array())
                .and_then(|a| a.first())
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let online = v.get("Online").and_then(|x| x.as_bool()).unwrap_or(false);
            let os = v.get("OS").and_then(|x| x.as_str()).map(|s| s.to_string());
            if !name.is_empty() || !dns.is_empty() {
                out.push(TailscalePeer { name, dns, ip, online, os });
            }
        }
    }
    Ok(out)
}
