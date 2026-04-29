# Pack current ~/.claude and ~/.cursor into team-ai-config repo (Windows).
# Maintainer-only: run this BEFORE git commit to refresh shared config.
#
# Whitelist approach: ONLY copy paths in INCLUDE_CLAUDE / INCLUDE_CURSOR.
# Everything else stays in your local ~/. The team repo is a curated shareable subset.

#Requires -Version 5.1
[CmdletBinding()]
param(
  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'

$RepoRoot   = $PSScriptRoot
$ClaudeHome = Join-Path $env:USERPROFILE '.claude'
$CursorHome = Join-Path $env:USERPROFILE '.cursor'

# What to share from ~/.claude
$INCLUDE_CLAUDE = @(
  'agents',          # team agents
  'skills',          # team skills
  'schemas',         # LIFECYCLE.md, JSON schemas, intel contracts
  'scripts',         # meta_helper.py, merger.py, validators
  'CLAUDE.md'        # global rules
)

# What to share from ~/.cursor
$INCLUDE_CURSOR = @(
  'agents',          # team agents
  'skills',          # team skills
  'skills-cursor',   # Cursor-specific skill variants
  'rules',           # Cursor rules
  'commands',        # slash commands
  'playbooks',       # playbooks
  'templates',       # code templates
  'AGENTS.md',       # Cursor conventions
  'mcp.json'         # MCP server config (template — secrets stripped at maintainer)
)

function Sync-Whitelist {
  param(
    [Parameter(Mandatory)] [string]   $Source,
    [Parameter(Mandatory)] [string]   $Destination,
    [Parameter(Mandatory)] [string[]] $Include
  )

  if (-not (Test-Path $Source)) {
    Write-Host "  ! $Source not found, skip"
    return
  }

  if (-not $DryRun) {
    if (Test-Path $Destination) { Remove-Item -Recurse -Force $Destination }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  }

  foreach ($name in $Include) {
    $src = Join-Path $Source $name
    if (-not (Test-Path $src)) {
      Write-Host "  ! missing in source: $name"
      continue
    }
    $dst = Join-Path $Destination $name
    $size = if ((Get-Item $src) -is [System.IO.DirectoryInfo]) {
      "{0:N1} MB" -f ((Get-ChildItem $src -Recurse -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB)
    } else { "{0:N1} KB" -f ((Get-Item $src).Length / 1KB) }
    Write-Host "  + $name ($size)"
    if ($DryRun) { continue }
    if ((Get-Item $src).PSIsContainer) {
      Copy-Item -Recurse -Force -Path $src -Destination $dst
    } else {
      Copy-Item -Force -Path $src -Destination $dst
    }
  }
}

Write-Host "▶ Packing claude config from $ClaudeHome"
Sync-Whitelist -Source $ClaudeHome -Destination (Join-Path $RepoRoot 'claude') -Include $INCLUDE_CLAUDE

Write-Host ''
Write-Host "▶ Packing cursor config from $CursorHome"
Sync-Whitelist -Source $CursorHome -Destination (Join-Path $RepoRoot 'cursor') -Include $INCLUDE_CURSOR

# Sanitization warning: machine-specific paths
Write-Host ''
Write-Host '▶ Scanning for machine-specific paths in shared content...'
$Suspicious = @()
$SearchPaths = @(
  (Join-Path $RepoRoot 'claude'),
  (Join-Path $RepoRoot 'cursor')
)
foreach ($p in $SearchPaths) {
  if (-not (Test-Path $p)) { continue }
  Get-ChildItem -Path $p -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.Extension -in '.md','.json','.yaml','.yml','.sh','.ps1','.py' } |
    ForEach-Object {
      $content = Get-Content -Raw -Path $_.FullName -ErrorAction SilentlyContinue
      if ($content -match 'C:[/\\]Users[/\\]\w+|D:[/\\]MCP Server|/Users/\w+/\.claude') {
        $Suspicious += $_.FullName
      }
    }
}
if ($Suspicious.Count -gt 0) {
  Write-Host "  ! found machine-specific paths in $($Suspicious.Count) files:" -ForegroundColor Yellow
  $Suspicious | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" }
  if ($Suspicious.Count -gt 10) { Write-Host "    ... and $($Suspicious.Count - 10) more" }
  Write-Host ''
  Write-Host "  Replace before commit:" -ForegroundColor Yellow
  Write-Host "    C:/Users/<name>/.claude  ->  ~/.claude  (or `$env:USERPROFILE/.claude)"
  Write-Host "    D:/MCP Server/etc-platform  ->  bake into image / parameterize"
} else {
  Write-Host "  ok: no machine-specific paths detected"
}

Write-Host ''
Write-Host "Packed. Next: git status / git add / git commit / git push"
if ($DryRun) { Write-Host '(dry-run only - nothing copied)' }
