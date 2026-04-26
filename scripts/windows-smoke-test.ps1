# NSIS (electron-builder): silent = /S, install directory = /D=... — /D= must be the last flag.
#requires -Version 5.0
$ErrorActionPreference = 'Stop'

$diagnosticsRoot = Join-Path -Path $env:RUNNER_TEMP 'smoke-diagnostics'
if (Test-Path -LiteralPath $diagnosticsRoot) {
  Remove-Item -LiteralPath $diagnosticsRoot -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -Path $diagnosticsRoot -ItemType Directory -Force | Out-Null

$logPath = Join-Path -Path $diagnosticsRoot 'smoke-console.log'
$summaryPath = Join-Path -Path $diagnosticsRoot 'summary.json'
$installTreePath = Join-Path -Path $diagnosticsRoot 'install-tree.txt'
$startupFailurePath = Join-Path -Path $diagnosticsRoot 'startup-failure.txt'

$summary = [ordered]@{
  runId = $env:GITHUB_RUN_ID
  installerPath = $null
  installAttempts = @()
  startupAttempts = @()
  finalStatus = $null
  failureMessage = $null
}

function Write-SmokeLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format 's'), $Message
  Write-Host $line
  Add-Content -Path $logPath -Value $line
}

function Save-SmokeSummary {
  ($summary | ConvertTo-Json -Depth 8) | Set-Content -Path $summaryPath -Encoding UTF8
}

function Fail-Smoke {
  param(
    [string]$Status,
    [string]$Message
  )
  $summary.finalStatus = $Status
  $summary.failureMessage = $Message
  Save-SmokeSummary
  throw $Message
}

function Invoke-SilentInstall {
  param(
    [string]$InstallerPath,
    [string[]]$Arguments
  )
  return (Start-Process -FilePath $InstallerPath -ArgumentList $Arguments -Wait -PassThru).ExitCode
}

Write-SmokeLog "Diagnostics directory: $diagnosticsRoot"
Write-SmokeLog "CI smoke mode: $($env:MAXFRAME_CI_SMOKE)"

$searchRoot = if ($env:SMOKE_INSTALLER_DIR) { $env:SMOKE_INSTALLER_DIR } else { (Get-Location).Path }
$installer = Get-ChildItem -Path $searchRoot -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like '*-win-x64.exe' } |
  Select-Object -First 1

if (-not $installer) {
  Fail-Smoke -Status 'fail-install' -Message "No *-win-x64.exe under $searchRoot (set SMOKE_INSTALLER_DIR to the download-artifact dir)."
}

$summary.installerPath = $installer.FullName
Write-SmokeLog "Running installer: $($installer.FullName)"

$installAttemptCount = 4
$installBackoffBaseSeconds = 4
$accessViolationExitCode = -1073741819
$baseDest = Join-Path -Path $env:RUNNER_TEMP 'maxframe-smoke-pfx'
$dest = $null
$installExit = $null

for ($i = 1; $i -le $installAttemptCount; $i++) {
  $dest = "$baseDest-$i"
  if (Test-Path -LiteralPath $dest) {
    Remove-Item -LiteralPath $dest -Recurse -Force -ErrorAction SilentlyContinue
  }

  Write-SmokeLog "Install prefix (attempt $i/$installAttemptCount): $dest"
  $instArgs = @('/S', ('/D=' + $dest))
  $installExit = Invoke-SilentInstall -InstallerPath $installer.FullName -Arguments $instArgs
  $attemptRecord = [ordered]@{
    attempt = $i
    installPrefix = $dest
    exitCode = $installExit
  }

  if ($installExit -eq 0) {
    $summary.installAttempts += $attemptRecord
    break
  }

  if ($installExit -eq $accessViolationExitCode -and $i -lt $installAttemptCount) {
    $backoff = $i * $installBackoffBaseSeconds
    $attemptRecord.backoffSeconds = $backoff
    $summary.installAttempts += $attemptRecord
    Write-SmokeLog "Installer crashed with access violation ($installExit). Retrying in ${backoff}s..."
    Start-Sleep -Seconds $backoff
    continue
  }

  $summary.installAttempts += $attemptRecord
  break
}

if ($installExit -ne 0) {
  $history = ($summary.installAttempts | ForEach-Object {
    "attempt=$($_.attempt), exit=$($_.exitCode), prefix=$($_.installPrefix), backoff=$($_.backoffSeconds)"
  }) -join '; '
  Fail-Smoke -Status 'fail-install' -Message "NSIS installer exited with code $installExit. Attempts: $history"
}

Write-SmokeLog "Installer search root: $searchRoot"
Write-SmokeLog "Installer path: $($installer.FullName)"
Write-SmokeLog "Install process exit code: $installExit"

$resolvedExeCandidates = Get-ChildItem -Path $dest -Recurse -File -Filter 'Maxframe.exe' -ErrorAction SilentlyContinue |
  Sort-Object FullName
$appExe = $null
if ($resolvedExeCandidates) {
  $appExe = $resolvedExeCandidates[0].FullName
}
if (-not $appExe) {
  $installTree = Get-ChildItem -Path $dest -Recurse -File -ErrorAction SilentlyContinue |
    Select-Object -First 200 -ExpandProperty FullName
  $installTreeText = if ($installTree) { $installTree -join [Environment]::NewLine } else { '(no files found under install prefix)' }
  Set-Content -Path $installTreePath -Value $installTreeText -Encoding UTF8
  Fail-Smoke -Status 'fail-install' -Message "Could not find Maxframe.exe under install prefix '$dest'."
}
Write-SmokeLog "Resolved app executable: $appExe"

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
  Write-SmokeLog "Launching Maxframe ($attemptName), args: $argText"

  if ($attemptArgs.Count -gt 0) {
    $launched = Start-Process -FilePath $appExe -ArgumentList $attemptArgs -PassThru
  }
  else {
    $launched = Start-Process -FilePath $appExe -PassThru
  }

  $startupDeadline = (Get-Date).AddSeconds($startupGraceSeconds)
  $stayedUp = $true
  $observedSeconds = 0
  $attemptExitCode = $null

  while ((Get-Date) -lt $startupDeadline) {
    Start-Sleep -Seconds 2
    $observedSeconds += 2
    if ($launched.HasExited) {
      $stayedUp = $false
      $attemptExitCode = $launched.ExitCode
      $lastExitCode = $attemptExitCode
      Write-SmokeLog "Maxframe exited early on attempt '$attemptName' with code: $attemptExitCode"
      break
    }
  }

  $summary.startupAttempts += [ordered]@{
    name = $attemptName
    args = $attemptArgs
    stayedUp = $stayedUp
    exitCode = $attemptExitCode
    observedForSeconds = $observedSeconds
  }

  if ($stayedUp) {
    Write-SmokeLog "Maxframe stayed alive for startup grace window on attempt '$attemptName'."
    break
  }
}

if (-not $launched -or $launched.HasExited) {
  $startupDetails = ($summary.startupAttempts | ConvertTo-Json -Depth 6)
  Set-Content -Path $startupFailurePath -Value $startupDetails -Encoding UTF8
  Fail-Smoke -Status 'fail-startup' -Message "Maxframe.exe exited during startup window on all attempts; last exit code: $lastExitCode"
}

# Prefer stopping the exact PID (Electron can spawn children with other names)
Stop-Process -Id $launched.Id -Force -ErrorAction SilentlyContinue
# Clean up if the name is what remains
Get-Process -Name 'Maxframe' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$summary.finalStatus = 'pass'
$summary.failureMessage = $null
Save-SmokeSummary
Write-SmokeLog "Smoke diagnostics summary: $summaryPath"
Write-SmokeLog 'windows-smoke-test: OK'
exit 0
