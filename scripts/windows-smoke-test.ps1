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
function Invoke-SilentInstall {
  param(
    [string]$InstallerPath,
    [string[]]$Arguments
  )
  return (Start-Process -FilePath $InstallerPath -ArgumentList $Arguments -Wait -PassThru).ExitCode
}

$exit = Invoke-SilentInstall -InstallerPath $installer.FullName -Arguments $instArgs
if ($exit -eq -1073741819) {
  # Retry once for transient NSIS access violation crashes observed on ephemeral CI runners.
  Write-Host "Installer crashed with access violation ($exit). Retrying once..."
  Start-Sleep -Seconds 2
  $exit = Invoke-SilentInstall -InstallerPath $installer.FullName -Arguments $instArgs
}
if ($exit -ne 0) { throw "NSIS installer exited with code $exit" }

Write-Host "Installer search root: $searchRoot"
Write-Host "Installer path: $($installer.FullName)"
Write-Host "Install process exit code: $exit"

$resolvedExeCandidates = Get-ChildItem -Path $dest -Recurse -File -Filter 'Maxframe.exe' -ErrorAction SilentlyContinue |
  Sort-Object FullName
$appExe = $null
if ($resolvedExeCandidates) {
  $appExe = $resolvedExeCandidates[0].FullName
}
if (-not $appExe) {
  $installTree = Get-ChildItem -Path $dest -Recurse -File -ErrorAction SilentlyContinue |
    Select-Object -First 50 -ExpandProperty FullName
  $installTreeText = if ($installTree) { $installTree -join [Environment]::NewLine } else { '(no files found under install prefix)' }
  throw "Could not find Maxframe.exe under install prefix '$dest'. Install tree sample:`n$installTreeText"
}
Write-Host "Resolved app executable: $appExe"

$launchAttempts = @(
  @{ Name = 'ci-flags'; Args = @('--disable-gpu', '--disable-software-rasterizer', '--no-sandbox') },
  @{ Name = 'plain'; Args = @() }
)
$launched = $null
$lastExitCode = $null
$startupGraceSeconds = 12

foreach ($attempt in $launchAttempts) {
  $attemptName = [string]$attempt.Name
  $attemptArgs = [string[]]$attempt.Args
  $argText = if ($attemptArgs.Count -gt 0) { $attemptArgs -join ' ' } else { '(none)' }
  Write-Host "Launching Maxframe ($attemptName), args: $argText"

  if ($attemptArgs.Count -gt 0) {
    $launched = Start-Process -FilePath $appExe -ArgumentList $attemptArgs -PassThru
  }
  else {
    $launched = Start-Process -FilePath $appExe -PassThru
  }
  $startupDeadline = (Get-Date).AddSeconds($startupGraceSeconds)
  $stayedUp = $true
  while ((Get-Date) -lt $startupDeadline) {
    Start-Sleep -Seconds 2
    if ($launched.HasExited) {
      $stayedUp = $false
      $lastExitCode = $launched.ExitCode
      Write-Host "Maxframe exited early on attempt '$attemptName' with code: $lastExitCode"
      break
    }
  }

  if ($stayedUp) {
    Write-Host "Maxframe stayed alive for startup grace window on attempt '$attemptName'."
    break
  }
}

if (-not $launched -or $launched.HasExited) {
  throw "Maxframe.exe exited during startup window on all attempts; last exit code: $lastExitCode"
}

# Prefer stopping the exact PID (Electron can spawn children with other names)
Stop-Process -Id $launched.Id -Force -ErrorAction SilentlyContinue
# Clean up if the name is what remains
Get-Process -Name 'Maxframe' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host 'windows-smoke-test: OK'
exit 0
