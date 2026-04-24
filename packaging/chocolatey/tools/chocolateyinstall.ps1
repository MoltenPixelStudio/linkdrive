$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/MoltenPixelStudio/linkdrive/releases/download/v0.2.0/LinkDrive-Setup-0.2.0-win-x64.exe'
  checksum64     = 'ACF21D97E6329F88B708FA9BD54123B637A73A819D0DA73150E7A423E4213D26'
  checksumType64 = 'sha256'
  silentArgs     = '--silent-install'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
