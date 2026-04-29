#Requires -Version 5.1
# ai-kit launcher - Node.js + Ink CLI (PowerShell)
# Falls back to legacy PS CLI if Node is unavailable.

$ErrorActionPreference = 'Stop'
$Dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $Dir

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "X Node.js not found. Install Node 18+:" -ForegroundColor Red
  Write-Host "  winget install OpenJS.NodeJS.LTS"
  exit 1
}

$nodeMajor = [int](& node -p 'process.versions.node.split(".")[0]')
if ($nodeMajor -lt 18) {
  Write-Host "X Node.js $nodeMajor detected - ai-kit needs >= 18." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path (Join-Path $RepoRoot 'node_modules'))) {
  Write-Host "Installing Node deps (one-time)..."
  Push-Location $RepoRoot
  try {
    & npm install --omit=dev --silent
    if ($LASTEXITCODE -ne 0) {
      Write-Host "X npm install failed; falling back to legacy CLI" -ForegroundColor Red
      & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Dir 'ai-kit.legacy.ps1') @args
      exit $LASTEXITCODE
    }
  } finally { Pop-Location }
}

& node (Join-Path $Dir 'ai-kit.mjs') @args
exit $LASTEXITCODE
