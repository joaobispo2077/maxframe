#requires -Version 5.0
$ErrorActionPreference = 'Stop'

$diagnosticsRoot = Join-Path -Path $env:RUNNER_TEMP 'smoke-diagnostics'
if (Test-Path -LiteralPath $diagnosticsRoot) {
  Remove-Item -LiteralPath $diagnosticsRoot -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -Path $diagnosticsRoot -ItemType Directory -Force | Out-Null

$logPath            = Join-Path -Path $diagnosticsRoot 'smoke-console.log'
$summaryPath        = Join-Path -Path $diagnosticsRoot 'summary.json'
$startupFailurePath = Join-Path -Path $diagnosticsRoot 'startup-failure.txt'

$summary = [ordered]@{
  runId           = $env:GITHUB_RUN_ID
  portablePath    = $null
  startupAttempts = @()
  finalStatus     = $null
  failureMessage  = $null
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
  $summary.finalStatus   = $Status
  $summary.failureMessage = $Message
  Save-SmokeSummary
  throw $Message
}

Write-SmokeLog "Diagnostics directory: $diagnosticsRoot"
Write-SmokeLog "CI smoke mode: $($env:MAXFRAME_CI_SMOKE)"

$searchRoot = if ($env:SMOKE_INSTALLER_DIR) { $env:SMOKE_INSTALLER_DIR } else { (Get-Location).Path }
$portable = Get-ChildItem -Path $searchRoot -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like '*-portable-win-x64.exe' } |
  Select-Object -First 1

if (-not $portable) {
  Fail-Smoke -Status 'fail-not-found' -Message "No *-portable-win-x64.exe under $searchRoot (set SMOKE_INSTALLER_DIR to the download-artifact dir)."
}

$summary.portablePath = $portable.FullName
Write-SmokeLog "Portable exe: $($portable.FullName)"

$launchAttempts = @(
  @{ Name = 'ci-flags'; Args = @('--disable-gpu', '--disable-software-rasterizer', '--no-sandbox') },
  @{ Name = 'plain';    Args = @() }
)
$launched           = $null
$lastExitCode       = $null
$startupGraceSeconds = 12

foreach ($attempt in $launchAttempts) {
  $attemptName = [string]$attempt.Name
  $attemptArgs = [string[]]$attempt.Args
  $argText     = if ($attemptArgs.Count -gt 0) { $attemptArgs -join ' ' } else { '(none)' }
  Write-SmokeLog "Launching portable ($attemptName), args: $argText"

  $env:MAXFRAME_CI_SMOKE = '1'

  if ($attemptArgs.Count -gt 0) {
    $launched = Start-Process -FilePath $portable.FullName -ArgumentList $attemptArgs -PassThru
  } else {
    $launched = Start-Process -FilePath $portable.FullName -PassThru
  }

  $startupDeadline  = (Get-Date).AddSeconds($startupGraceSeconds)
  $stayedUp         = $true
  $observedSeconds  = 0
  $attemptExitCode  = $null

  while ((Get-Date) -lt $startupDeadline) {
    Start-Sleep -Seconds 2
    $observedSeconds += 2
    if ($launched.HasExited) {
      $stayedUp        = $false
      $attemptExitCode = $launched.ExitCode
      $lastExitCode    = $attemptExitCode
      Write-SmokeLog "Portable exited early on attempt '$attemptName' with code: $attemptExitCode"
      break
    }
  }

  $summary.startupAttempts += [ordered]@{
    name             = $attemptName
    args             = $attemptArgs
    stayedUp         = $stayedUp
    exitCode         = $attemptExitCode
    observedForSeconds = $observedSeconds
  }

  if ($stayedUp) {
    Write-SmokeLog "Portable stayed alive for startup grace window on attempt '$attemptName'."
    break
  }
}

if (-not $launched -or $launched.HasExited) {
  $startupDetails = ($summary.startupAttempts | ConvertTo-Json -Depth 6)
  Set-Content -Path $startupFailurePath -Value $startupDetails -Encoding UTF8
  Fail-Smoke -Status 'fail-startup' -Message "Portable exe exited during startup window on all attempts; last exit code: $lastExitCode"
}

Stop-Process -Id $launched.Id -Force -ErrorAction SilentlyContinue
Get-Process -Name 'Maxframe' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

$summary.finalStatus   = 'pass'
$summary.failureMessage = $null
Save-SmokeSummary
Write-SmokeLog "Smoke diagnostics summary: $summaryPath"
Write-SmokeLog 'windows-portable-smoke-test: OK'
exit 0
