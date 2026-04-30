# publish.ps1 — Maintainer: pack → validate → commit → push
#
# Gom hết ~/.claude + ~/.cursor vào repo rồi push lên git.
# Team members chạy "ai-kit update" để nhận bản mới.
#
# Usage:
#   .\publish.ps1                    # hỏi commit message
#   .\publish.ps1 "fix: mô tả"       # non-interactive

#Requires -Version 5.1
[CmdletBinding()]
param(
  [Parameter(Position = 0)]
  [string] $Message
)

$ErrorActionPreference = 'Stop'
$RepoRoot   = $PSScriptRoot
$ClaudeHome = Join-Path $env:USERPROFILE '.claude'
$CursorHome = Join-Path $env:USERPROFILE '.cursor'

function Write-Step { param($t) Write-Host "`n▶ $t" -ForegroundColor Cyan }
function Write-Ok   { param($t) Write-Host "  ✓ $t" -ForegroundColor Green }
function Write-Warn { param($t) Write-Host "  ⚠ $t" -ForegroundColor Yellow }
function Write-Fail { param($t) Write-Host "  ✗ $t" -ForegroundColor Red }

# Những gì được chia sẻ từ ~/.claude
$INCLUDE_CLAUDE = @('agents','skills','schemas','scripts','CLAUDE.md')

# Những gì được chia sẻ từ ~/.cursor
$INCLUDE_CURSOR = @('agents','skills','skills-cursor','rules','commands','playbooks','templates','AGENTS.md','mcp.json')

# ── 0. Cảnh báo nếu có direct edits trong claude/ hoặc cursor/ của repo ─────
# (vì pack step sẽ overwrite bằng version từ ~/.claude + ~/.cursor)
$dirtyDeployed = git -C $RepoRoot diff --name-only HEAD -- claude/ cursor/
if ($dirtyDeployed) {
  Write-Warn "Phát hiện sửa thẳng trong claude/ hoặc cursor/ của repo:"
  $dirtyDeployed | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
  Write-Host ""
  Write-Host "  ⚠ Pack step sẽ GHI ĐÈ các file này bằng version từ ~/.claude và ~/.cursor." -ForegroundColor Yellow
  Write-Host "    Nếu muốn giữ sửa: copy chúng sang ~/.claude / ~/.cursor trước khi tiếp tục." -ForegroundColor Yellow
  $ans = Read-Host "  Tiếp tục pack (sẽ mất các sửa trên)? (y/N)"
  if ($ans -ne 'y') { Write-Warn "Cancelled — chuyển sửa sang ~/.claude rồi chạy lại"; exit 0 }
}

# ── 1. Pack ──────────────────────────────────────────────────────────────────
Write-Step "Packing ~/.claude → claude/"
foreach ($name in $INCLUDE_CLAUDE) {
  $src = Join-Path $ClaudeHome $name
  $dst = Join-Path $RepoRoot 'claude' $name
  if (-not (Test-Path $src)) { Write-Warn "  missing: $name"; continue }
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  Copy-Item -Recurse -Force $src $dst
  Write-Host "  + $name"
}

Write-Step "Packing ~/.cursor → cursor/"
foreach ($name in $INCLUDE_CURSOR) {
  $src = Join-Path $CursorHome $name
  $dst = Join-Path $RepoRoot 'cursor' $name
  if (-not (Test-Path $src)) { Write-Warn "  missing: $name"; continue }
  if (Test-Path $dst) { Remove-Item -Recurse -Force $dst }
  Copy-Item -Recurse -Force $src $dst
  Write-Host "  + $name"
}

# ── 1b. Sync ref-*.md templates → MCP data/registry/templates ────────────────
# MCP server reads templates via volume bind ./data:/data
# Path inside container: /data/registry/templates/{namespace}/{template_id}.md
Write-Step "Syncing skill templates → MCP registry"
$MCP_TPL_ROOT = Join-Path $RepoRoot 'mcp\etc-platform\data\registry\templates'
$TEMPLATE_NAMESPACES = @('new-workspace', 'new-document-workspace')
foreach ($ns in $TEMPLATE_NAMESPACES) {
  $srcDir = Join-Path $ClaudeHome "skills\$ns"
  $dstDir = Join-Path $MCP_TPL_ROOT $ns
  if (-not (Test-Path $srcDir)) { Write-Warn "  skip $ns (no source)"; continue }
  if (Test-Path $dstDir) { Remove-Item -Recurse -Force $dstDir }
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
  $refs = Get-ChildItem -Path $srcDir -Filter 'ref-*.md' -File
  foreach ($f in $refs) { Copy-Item -Force $f.FullName (Join-Path $dstDir $f.Name) }
  Write-Host "  + $ns ($($refs.Count) templates)"
}

# ── 2. Kiểm tra path máy cá nhân ────────────────────────────────────────────
Write-Step "Scanning machine-specific paths"
$suspicious = @()
foreach ($dir in @('claude','cursor')) {
  $path = Join-Path $RepoRoot $dir
  if (-not (Test-Path $path)) { continue }
  Get-ChildItem -Path $path -Recurse -File |
    Where-Object { $_.Extension -in '.md','.json','.yaml','.yml','.ps1','.sh','.py' } |
    ForEach-Object {
      $c = Get-Content -Raw $_.FullName -ErrorAction SilentlyContinue
      if ($c -match 'C:[/\\]Users[/\\]\w+|D:[/\\]MCP Server|/Users/\w+/\.claude') {
        $suspicious += $_.FullName
      }
    }
}
if ($suspicious.Count -gt 0) {
  Write-Warn "$($suspicious.Count) file(s) chứa path máy cá nhân — kiểm tra trước khi push:"
  $suspicious | Select-Object -First 5 | ForEach-Object { Write-Host "    $_" }
  $ans = Read-Host "  Tiếp tục? (y/N)"
  if ($ans -ne 'y') { Write-Warn "Cancelled"; exit 0 }
} else {
  Write-Ok "No machine-specific paths"
}

# ── 3. Xem thay đổi ─────────────────────────────────────────────────────────
Write-Step "Changed files"
$diffStat  = git -C $RepoRoot diff --stat
$untracked = git -C $RepoRoot ls-files --others --exclude-standard

if (-not $diffStat -and -not $untracked) {
  Write-Ok "Nothing changed — already up to date"
  exit 0
}
if ($diffStat)   { Write-Host $diffStat }
if ($untracked)  { $untracked | ForEach-Object { Write-Host "  ? $_" } }

# ── 4. Commit message ────────────────────────────────────────────────────────
if (-not $Message) {
  Write-Host ""
  $Message = Read-Host "  Commit message (Enter to cancel)"
  if (-not $Message.Trim()) { Write-Warn "Cancelled — nothing committed"; exit 0 }
}

# ── 5. Commit + push ─────────────────────────────────────────────────────────
Write-Step "Committing"
git -C $RepoRoot add -A
$out = git -C $RepoRoot commit -m $Message 2>&1
if ($LASTEXITCODE -ne 0) { Write-Warn "Nothing new to commit"; exit 0 }
Write-Host $out

Write-Step "Pushing to origin"
git -C $RepoRoot push
if ($LASTEXITCODE -ne 0) { Write-Fail "git push failed"; exit 1 }

Write-Host ""
Write-Ok "Done. Team members run: ai-kit update"
