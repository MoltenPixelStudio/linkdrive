$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/MoltenPixelStudio/linkdrive/releases/download/v0.1.0/LinkDrive-Setup-0.1.0-win-x64.exe'
  checksum64     = 'REPLACE_WITH_RELEASE_ASSET_SHA256'
  checksumType64 = 'sha256'
  silentArgs     = '--silent-install'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
