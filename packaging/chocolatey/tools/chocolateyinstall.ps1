$ErrorActionPreference = 'Stop'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  fileType       = 'exe'
  url64bit       = 'https://github.com/MoltenPixelStudio/linkdrive/releases/download/v0.2.1/LinkDrive-Setup-0.2.1-win-x64.exe'
  checksum64     = '65541BE4C30BB0916C313E5819B9412AE8282E168A692A91B3A930AB1A0AF725'
  checksumType64 = 'sha256'
  silentArgs     = '--silent-install'
  validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
