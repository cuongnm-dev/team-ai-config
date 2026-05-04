#Requires -Version 5.1
# ai-kit launcher - Node.js + Ink CLI (PowerShell)

$ErrorActionPreference = 'Stop'
$Dir     = Split-Path -Parent $MyInvocation.MyCommand.Path
$AiHome  = if ($env:AI_KIT_HOME) { $env:AI_KIT_HOME } else { Join-Path $env:USERPROFILE '.ai-kit' }
$RepoDir = Join-Path $AiHome 'team-ai-config'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "X Node.js not found. Install Node 18+:" -ForegroundColor Red
  Write-Host "  winget install OpenJS.NodeJS.LTS"
  exit 1
}

$nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 18) {
  Write-Host "X Node.js $nodeMajor detected - ai-kit needs >= 18." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $AiHome 'node_modules'))) {
  Write-Host "Installing Node deps (one-time)..."
  # Always copy latest package.json from repo to AI_KIT_HOME
  $pkgSrc = Join-Path $RepoDir 'package.json'
  if (Test-Path $pkgSrc) {
    Copy-Item -Force $pkgSrc (Join-Path $AiHome 'package.json')
  }
  Push-Location $AiHome
  try {
    & npm.cmd install --omit=dev --silent
    if ($LASTEXITCODE -ne 0) {
      Write-Host "X npm install failed." -ForegroundColor Red
      Write-Host "  Try manually: cd $AiHome; npm install --omit=dev" -ForegroundColor Yellow
      exit 1
    }
  } finally { Pop-Location }
}

# Always sync bin\lib + ai-kit.mjs from repo (idempotent — ensures new modules land in launcher copy).
# Pre-2026-05-04: only synced when util.mjs missing → broke when adding new lib files like lib\telemetry\*.
$LibDir    = Join-Path $Dir 'lib'
$RepoLib   = Join-Path $RepoDir 'bin\lib'
$RepoMjs   = Join-Path $RepoDir 'bin\ai-kit.mjs'
$LauncherMjs = Join-Path $Dir 'ai-kit.mjs'
if (Test-Path $RepoLib) {
  Copy-Item -Recurse -Force $RepoLib $LibDir
}
if (Test-Path $RepoMjs) {
  Copy-Item -Force $RepoMjs $LauncherMjs
}

& node $LauncherMjs @args
exit $LASTEXITCODE
