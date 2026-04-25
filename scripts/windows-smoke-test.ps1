# NSIS (electron-builder): silent = /S, install directory = /D=...  — /D= must be the last flag (NSIS). See: https://www.electron.build/nsis
#requires -Version 5.0
$ErrorActionPreference = 'Stop'

$searchRoot = if ($env:SMOKE_INSTALLER_DIR) { $env:SMOKE_INSTALLER_DIR } else { (Get-Location).Path }
$installer = Get-ChildItem -Path $searchRoot -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like '*-win-x64.exe' } |
  Select-Object -First 1
if (-not $installer) {
  throw "No *-win-x64.exe under $searchRoot (set SMOKE_INSTALLER_DIR to the download-artifact dir)."
}

$dest = Join-Path -Path $env:RUNNER_TEMP 'maxframe-smoke-pfx'
if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "Running installer: $($installer.FullName)"
Write-Host "Install prefix: $dest"

$instArgs = @('/S', ('/D=' + $dest))
$exit = (Start-Process -FilePath $installer.FullName -ArgumentList $instArgs -Wait -PassThru).ExitCode
if ($exit -ne 0) { throw "NSIS installer exited with code $exit" }

$appExe = Join-Path $dest 'Maxframe.exe'
if (-not (Test-Path -LiteralPath $appExe)) { throw "Expected $appExe after silent install" }

$launched = Start-Process -FilePath $appExe -PassThru
Start-Sleep -Seconds 8
if ($launched.HasExited) {
  throw "Maxframe.exe exited before smoke window; exit code: $($launched.ExitCode)"
}

# Prefer stopping the exact PID (Electron can spawn children with other names)
Stop-Process -Id $launched.Id -Force -ErrorAction SilentlyContinue
# Clean up if the name is what remains
Get-Process -Name 'Maxframe' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host 'windows-smoke-test: OK'
exit 0
