# publish.ps1 — Maintainer deploy: pack → validate → commit → push
# After push, every team member gets updates via: ai-kit update
#
# Usage:
#   .\publish.ps1                    # prompts for commit message
#   .\publish.ps1 "fix: ..."         # non-interactive

#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string] $Message
)

$ErrorActionPreference = 'Stop'
$RepoRoot = $PSScriptRoot

function Write-Step  { param($t) Write-Host "`n▶ $t" -ForegroundColor Cyan }
function Write-Ok    { param($t) Write-Host "  ✓ $t" -ForegroundColor Green }
function Write-Warn  { param($t) Write-Host "  ⚠ $t" -ForegroundColor Yellow }
function Write-Fail  { param($t) Write-Host "  ✗ $t" -ForegroundColor Red }

# ── 1. Pack ~/.claude + ~/.cursor into repo ─────────────────────────────────
Write-Step "Packing configs from ~/.claude + ~/.cursor"
& (Join-Path $RepoRoot 'pack.ps1')
if ($LASTEXITCODE -ne 0) { Write-Fail "pack.ps1 failed"; exit 1 }

# ── 2. Show what changed ─────────────────────────────────────────────────────
Write-Step "Changed files"
$diffStat = git -C $RepoRoot diff --stat
$staged   = git -C $RepoRoot diff --cached --stat
$untracked = git -C $RepoRoot ls-files --others --exclude-standard

if (-not $diffStat -and -not $staged -and -not $untracked) {
  Write-Ok "Nothing changed — already up to date"
  exit 0
}

if ($diffStat)   { Write-Host $diffStat }
if ($staged)     { Write-Host $staged }
if ($untracked)  { $untracked | ForEach-Object { Write-Host "  ? $_" } }

# ── 3. Commit message ────────────────────────────────────────────────────────
if (-not $Message) {
  Write-Host ""
  $Message = Read-Host "  Commit message (Enter to cancel)"
  if (-not $Message.Trim()) {
    Write-Warn "Cancelled — nothing committed"
    exit 0
  }
}

# ── 4. Commit + push ────────────────────────────────────────────────────────
Write-Step "Committing"
git -C $RepoRoot add -A
$result = git -C $RepoRoot commit -m $Message 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Warn "Nothing to commit (working tree clean)"
  exit 0
}
Write-Host $result

Write-Step "Pushing to origin"
git -C $RepoRoot push
if ($LASTEXITCODE -ne 0) { Write-Fail "git push failed"; exit 1 }

# ── 5. Done ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Ok "Published. Team members run: ai-kit update"
