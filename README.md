# LinkDrive

Fast cross-device file explorer. Access your local disks, LAN peers, and VPS hosts from one app. Desktop (Tauri) + mobile (Expo). Same design language as SyncPad.

## Packages

- `packages/shared` — theme tokens, protocol types, Host model
- `packages/desktop` — Tauri 2 + React 19 + Vite + Tailwind
- `packages/mobile` — Expo 54 + React Native 0.81

## Transports

- **SFTP** — primary for VPS access (works with every sshd out of the box)
- **LinkDrive agent** (optional) — native Rust agent for higher throughput
- **LAN peer** — mDNS + TCP between trusted devices

## Security

- SSH key or password auth, keys stay in `~/.ssh/`, never copied
- Host key TOFU pinning (like OpenSSH `known_hosts`)
- Credentials in OS keychain (Keychain/DPAPI/libsecret/Keystore)
- Per-session AES-GCM for agent transport; SSH protocol handles SFTP

## Status

Phase 0 scaffold. No implementation yet.

## Dev

```
npm install                 # install all workspaces
npm run dev:desktop         # Tauri dev
npm run dev:mobile          # Expo dev
```

## License

UNLICENSED (private).
