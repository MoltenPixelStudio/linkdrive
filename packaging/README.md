# Packaging

LinkDrive ships a single self-installing `LinkDrive-Setup-*-win-x64.exe`. The
binary supports three CLI modes consumed by package managers:

- `--silent-install` (aliases: `/S`, `/silent`) — install with defaults, no
  UI. Exits 0 on success, non-zero on error.
- `--uninstall` — remove the app, shortcuts, registry entry. Used by the
  per-machine uninstall command recorded in HKCU Uninstall.
- `--silent-update` — internal flag used by the in-app update flow; not
  meant for manual invocation.

When `LinkDrive.exe` is launched from `%LOCALAPPDATA%\LinkDrive\LinkDrive.exe`
it runs as the regular app.

## Manifests

- `winget/MoltenPixelStudio.LinkDrive.yaml` — submit to
  [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) via the
  standard PR flow. Bump `PackageVersion`, `InstallerUrl`, and
  `InstallerSha256` on every release. Consider
  [winget-releaser](https://github.com/vedantmgoyal9/winget-releaser) for
  automation.
- `scoop/linkdrive.json` — submit to the scoop bucket of your choice (you
  can host an own bucket at `ScoopInstaller/<bucket>` or submit to
  `extras`). `autoupdate` handles the URL substitution on new tags.
- `chocolatey/linkdrive.nuspec` + `tools/chocolateyinstall.ps1` +
  `tools/chocolateyuninstall.ps1` — build with `choco pack`, submit via
  `choco push` to the community feed (requires free API key from
  community.chocolatey.org).

## Checksum

Replace every occurrence of `REPLACE_WITH_RELEASE_ASSET_SHA256` with:

```powershell
Get-FileHash -Algorithm SHA256 .\LinkDrive-Setup-0.1.0-win-x64.exe | Select-Object -ExpandProperty Hash
```

Or on Unix:

```sh
shasum -a 256 LinkDrive-Setup-0.1.0-win-x64.exe | awk '{print toupper($1)}'
```

## Interaction with the in-app updater

Regardless of how LinkDrive was installed, the `--silent-install` flow writes
`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\com.moltenpixel.linkdrive`
with `InstallLocation = %LOCALAPPDATA%\LinkDrive`. The in-app banner and
Install now button read that key via `resolve_install_dir()` and overwrite
the installed binary in place, so either update path works. Package-manager
upgrades (`winget upgrade`, `scoop update`, `choco upgrade`) also re-run our
installer against the new release exe.
