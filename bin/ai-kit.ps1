# ai-kit — team AI config CLI (Windows / PowerShell 5.1+)
# Wraps git + docker + deploy.ps1 for one-command updates.

#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Position=0)] [string] $Command = 'help',
  [Parameter(ValueFromRemainingArguments=$true)] $Rest
)

$ErrorActionPreference = 'Stop'

$AiKitHome = if ($env:AI_KIT_HOME) { $env:AI_KIT_HOME } else { Join-Path $env:USERPROFILE '.ai-kit' }
$RepoDir   = Join-Path $AiKitHome 'team-ai-config'
$Version   = '0.1.0'

function Write-Info($msg) { Write-Host "▶ $msg" -ForegroundColor White }
function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }
function Write-Dim($msg)  { Write-Host $msg -ForegroundColor DarkGray }

function Ensure-Repo {
  if (-not (Test-Path (Join-Path $RepoDir '.git'))) {
    Write-Err "team-ai-config not found at $RepoDir"
    Write-Err "Run bootstrap first:  irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex"
    exit 1
  }
}

function DoInstall {
  if (Test-Path (Join-Path $RepoDir '.git')) {
    Write-Info "Already cloned. Running update instead."
    DoUpdate
    return
  }
  Write-Err "Repo missing. Use bootstrap.ps1 first:"
  Write-Err "  irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex"
  exit 1
}

function DoUpdate {
  Ensure-Repo
  Write-Info "Pulling latest team config"
  git -C $RepoDir fetch --quiet
  $before = (git -C $RepoDir rev-parse HEAD).Trim()
  git -C $RepoDir pull --ff-only --quiet
  $after  = (git -C $RepoDir rev-parse HEAD).Trim()
  if ($before -eq $after) {
    Write-Ok "Already up to date ($($before.Substring(0,7)))"
  } else {
    Write-Ok ("Updated {0} -> {1}" -f $before.Substring(0,7), $after.Substring(0,7))
    Write-Info "Changes:"
    git -C $RepoDir log --oneline "$before..$after" | ForEach-Object { Write-Host "    $_" }
  }

  Write-Info "Deploying claude\ + cursor\"
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoDir 'deploy.ps1')

  Write-Info "Refreshing MCP image"
  Push-Location (Join-Path $RepoDir 'mcp\etc-platform')
  docker compose pull --quiet
  docker compose up -d
  Pop-Location
  Write-Ok "MCP refreshed"
}

function DoStatus {
  Ensure-Repo
  Write-Host "Team AI Config" -ForegroundColor White
  $sha   = (git -C $RepoDir rev-parse --short HEAD).Trim()
  $date  = (git -C $RepoDir log -1 --format=%cd --date=short).Trim()
  $msg   = (git -C $RepoDir log -1 --format=%s).Trim()
  Write-Dim "  repo:    $RepoDir"
  Write-Dim "  version: $sha ($date)"
  Write-Dim "  commit:  $msg"
  Write-Host ''
  Write-Host "Deployed" -ForegroundColor White
  $claudeAgents = @(Get-ChildItem -Path (Join-Path $env:USERPROFILE '.claude\agents') -Filter '*.md' -ErrorAction SilentlyContinue).Count
  $claudeSkills = @(Get-ChildItem -Path (Join-Path $env:USERPROFILE '.claude\skills') -Directory -ErrorAction SilentlyContinue).Count
  $cursorAgents = @(Get-ChildItem -Path (Join-Path $env:USERPROFILE '.cursor\agents') -Filter '*.md' -ErrorAction SilentlyContinue).Count
  $cursorSkills = @(Get-ChildItem -Path (Join-Path $env:USERPROFILE '.cursor\skills') -Directory -ErrorAction SilentlyContinue).Count
  Write-Dim "  claude agents:  $claudeAgents"
  Write-Dim "  claude skills:  $claudeSkills"
  Write-Dim "  cursor agents:  $cursorAgents"
  Write-Dim "  cursor skills:  $cursorSkills"
  Write-Host ''
  Write-Host "MCP — etc-platform" -ForegroundColor White
  $running = docker ps --format '{{.Names}}|{{.Status}}' 2>$null | Where-Object { $_ -like 'etc-platform|*' }
  if ($running) {
    $status = ($running -split '\|')[1]
    Write-Host "  $status"
    try {
      Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:8001/healthz' -TimeoutSec 2 *> $null
      Write-Ok "healthz OK on http://localhost:8001"
    } catch { Write-Warn "container running but healthz failed" }
  } else {
    Write-Err "container not running. Run: ai-kit mcp start"
  }
}

function DoDoctor {
  Write-Host "ai-kit doctor" -ForegroundColor White
  $pass = $true
  foreach ($c in @('git','docker','curl')) {
    if (Get-Command $c -ErrorAction SilentlyContinue) { Write-Ok "$c found" }
    else { Write-Err "$c MISSING"; $pass = $false }
  }
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { Write-Ok "docker daemon running" } else { Write-Err "docker daemon not running"; $pass = $false }
  if (Test-Path (Join-Path $RepoDir '.git')) { Write-Ok "team-ai-config cloned" } else { Write-Err "team-ai-config not cloned"; $pass = $false }
  $userPath = [Environment]::GetEnvironmentVariable('Path','User')
  $binDir = Join-Path $AiKitHome 'bin'
  if ($userPath -split ';' -contains $binDir) { Write-Ok "$binDir in user PATH" }
  else { Write-Warn "$binDir NOT in user PATH (run bootstrap.ps1 again to fix)" }
  if ($pass) { Write-Host "All checks passed." -ForegroundColor Green }
  else { exit 1 }
}

function DoMcp {
  Ensure-Repo
  $verb = if ($Rest.Count -gt 0) { $Rest[0] } else { 'status' }
  Push-Location (Join-Path $RepoDir 'mcp\etc-platform')
  try {
    switch ($verb) {
      'start'   { docker compose up -d }
      'stop'    { docker compose down }
      'restart' { docker compose restart }
      'logs'    { docker compose logs -f etc-platform }
      'pull'    { docker compose pull; docker compose up -d }
      'status'  { docker compose ps }
      'ps'      { docker compose ps }
      default   { Write-Err "Unknown mcp verb: $verb"; Write-Host "  Use: start | stop | restart | logs | pull | status"; exit 1 }
    }
  } finally { Pop-Location }
}

function DoVersion {
  Ensure-Repo
  Write-Host "ai-kit:           $Version"
  $desc = (git -C $RepoDir describe --always --dirty).Trim()
  $date = (git -C $RepoDir log -1 --format=%cd --date=short).Trim()
  $msg  = (git -C $RepoDir log -1 --format=%s).Trim()
  Write-Host "team-ai-config:   $desc"
  Write-Host "                  $date — $msg"
  $envFile = Join-Path $RepoDir 'mcp\etc-platform\.env'
  $img = if (Test-Path $envFile) {
    (Get-Content $envFile | Select-String -Pattern '^ETC_PLATFORM_IMAGE=(.*)$' | ForEach-Object { $_.Matches[0].Groups[1].Value }) -join ''
  } else { '<not set>' }
  Write-Host "MCP image:        $img"
}

function DoUninstall {
  Ensure-Repo
  Write-Warn "This will REMOVE $AiKitHome and stop the MCP container."
  Write-Warn "Your ~\.claude and ~\.cursor stay (already deployed)."
  $yn = Read-Host "Continue? (y/N)"
  if ($yn -notmatch '^[Yy]') { Write-Host "Aborted."; exit 0 }
  Push-Location (Join-Path $RepoDir 'mcp\etc-platform') -ErrorAction SilentlyContinue
  if ($?) { docker compose down 2>$null; Pop-Location }
  Remove-Item -Recurse -Force $AiKitHome
  Write-Ok "Removed $AiKitHome"
  Write-Ok "Restore previous ~\.claude / ~\.cursor from latest backup at ~\ai-config-backup-* if needed."
}

function DoHelp {
@"
ai-kit $Version — team AI config manager

Usage:  ai-kit <command>

Commands:
  install            First-time setup (use bootstrap.ps1; this exists for symmetry)
  update             Pull latest team config + redeploy + refresh MCP image
  status             Show versions, deployed counts, MCP health
  doctor             Verify deps + paths
  mcp <verb>         start | stop | restart | logs | pull | status
  version            Show ai-kit + team-config + MCP image versions
  uninstall          Remove $AiKitHome (keeps deployed config)
  help               Show this message

Layout:  $AiKitHome
"@ | Write-Host
}

switch ($Command) {
  'install'   { DoInstall }
  'update'    { DoUpdate }
  'up'        { DoUpdate }
  'status'    { DoStatus }
  'st'        { DoStatus }
  'doctor'    { DoDoctor }
  'dr'        { DoDoctor }
  'mcp'       { DoMcp }
  'version'   { DoVersion }
  '-v'        { DoVersion }
  '--version' { DoVersion }
  'uninstall' { DoUninstall }
  'help'      { DoHelp }
  '-h'        { DoHelp }
  '--help'    { DoHelp }
  default     { Write-Err "Unknown command: $Command"; DoHelp; exit 1 }
}
