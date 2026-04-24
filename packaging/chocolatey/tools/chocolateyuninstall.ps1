$ErrorActionPreference = 'Stop'

$exe = Join-Path $env:LOCALAPPDATA 'LinkDrive\LinkDrive.exe'
if (Test-Path $exe) {
  Start-Process -FilePath $exe -ArgumentList '--uninstall' -Wait -NoNewWindow
}
