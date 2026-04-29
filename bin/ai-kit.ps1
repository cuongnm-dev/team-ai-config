# ai-kit — team AI config CLI (Windows / PowerShell 5.1+)
# Wraps git + docker + deploy.ps1 for one-command updates.

#Requires -Version 5.1
param(
  [string] $Command = '',
  [Parameter(ValueFromRemainingArguments=$true)] $Rest
)

$ErrorActionPreference = 'Stop'

# Workaround: PowerShell's `-File` mode silently drops args starting with `-` that
# don't match a declared parameter name. So `ai-kit -v` arrives with $Command = ''.
# We catch via $args and the powershell.exe fallback raw-args buffer below.
if (-not $Command -and $args -and $args.Count -gt 0) { $Command = [string]$args[0] }
if (-not $Command) { $Command = 'help' }
# Map flag-style synonyms back to subcommands.
switch -Regex ($Command) {
  '^(-v|--version|/v|/version)$' { $Command = 'version'; break }
  '^(-h|--help|/h|/help|/\?)$'   { $Command = 'help';    break }
}

$AiKitHome = if ($env:AI_KIT_HOME) { $env:AI_KIT_HOME } else { Join-Path $env:USERPROFILE '.ai-kit' }
$RepoDir   = Join-Path $AiKitHome 'team-ai-config'
$Version   = '0.1.0'

function Write-Info($msg) { Write-Host "▶ $msg" -ForegroundColor White }
function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }
function Write-Dim($msg)  { Write-Host $msg -ForegroundColor DarkGray }

function Invoke-GitChecked {
  param(
    [Parameter(Mandatory)] [string[]] $Args,
    [Parameter(Mandatory)] [string] $ErrorMessage
  )

  & git @Args
  if ($LASTEXITCODE -ne 0) {
    Write-Err $ErrorMessage
    exit 1
  }
}

function Resolve-DirtyRepo {
  param([Parameter(Mandatory)] [string] $Path)

  $dirty = @(git -C $Path status --porcelain)
  if ($dirty.Count -eq 0) { return }

  if ($env:AI_KIT_FORCE_CLEAN -eq '1') {
    Write-Warn "AI_KIT_FORCE_CLEAN=1 - discarding local repo changes"
    Invoke-GitChecked -Args @('-C', $Path, 'reset', '--hard', 'HEAD') -ErrorMessage "Failed to reset local changes in $Path"
    Invoke-GitChecked -Args @('-C', $Path, 'clean', '-fd') -ErrorMessage "Failed to clean untracked files in $Path"
    return
  }

  Write-Err "Local changes detected in $Path. Refusing to auto-merge."
  Write-Host "  Review with:  git -C $Path status"
  Write-Host "  Keep changes: git -C $Path stash push -u"
  Write-Host "  Discard all:  `$env:AI_KIT_FORCE_CLEAN='1'; ai-kit update"
  Write-Host "  Or run:       ai-kit reset    (interactive: review then discard)"
  exit 1
}

function DoReset {
  Ensure-Repo
  Push-Location $RepoDir
  try {
    $dirty = @(git status --porcelain)
    if ($dirty.Count -eq 0) {
      Write-Ok "Repo already clean. Nothing to reset."
      return
    }

    Write-Host "Local changes:" -ForegroundColor White
    git status --short
    Write-Host ''
    Write-Warn "ai-kit reset will:"
    Write-Warn "  1. git reset --hard HEAD       (discard tracked file edits)"
    Write-Warn "  2. git clean -fd               (remove untracked files/dirs)"
    Write-Warn "  3. git pull --ff-only          (re-sync to remote)"
    Write-Host ''
    $yn = Read-Host 'Continue? (y/N)'
    if ($yn -notmatch '^[Yy]') { Write-Host 'Aborted.'; return }

    git reset --hard HEAD
    git clean -fd
    git pull --ff-only --quiet
    Write-Ok "Repo reset to $(git rev-parse --short HEAD)"
  } finally { Pop-Location }
}

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
  Resolve-DirtyRepo -Path $RepoDir
  Invoke-GitChecked -Args @('-C', $RepoDir, 'fetch', '--quiet') -ErrorMessage 'Failed to fetch latest team config'
  $before = (& git -C $RepoDir rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to read current commit at $RepoDir"
    exit 1
  }
  Invoke-GitChecked -Args @('-C', $RepoDir, 'pull', '--ff-only', '--quiet') -ErrorMessage 'Failed to pull latest team config'
  $after  = (& git -C $RepoDir rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Failed to read updated commit at $RepoDir"
    exit 1
  }
  if ($before -eq $after) {
    Write-Ok "Already up to date ($($before.Substring(0,7)))"
  } else {
    Write-Ok ("Updated {0} -> {1}" -f $before.Substring(0,7), $after.Substring(0,7))
    Write-Info "Changes:"
    git -C $RepoDir log --oneline "$before..$after" | ForEach-Object { Write-Host "    $_" }
  }

  # Self-update: refresh ai-kit CLI itself in user's PATH bin/
  $binDir = Join-Path $AiKitHome 'bin'
  if (Test-Path $binDir) {
    foreach ($f in @('ai-kit.ps1','ai-kit.cmd','ai-kit')) {
      $src = Join-Path $RepoDir "bin\$f"
      if (Test-Path $src) {
        Copy-Item -Force $src (Join-Path $binDir $f)
      }
    }
    Write-Ok 'ai-kit CLI refreshed in PATH bin/'
  }

  Write-Info "Deploying claude\ + cursor\"
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoDir 'deploy.ps1')
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Deploy failed"
    exit 1
  }

  Write-Info "Refreshing MCP image (stop -> pull -> start)"
  Push-Location (Join-Path $RepoDir 'mcp\etc-platform')
  try {
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    docker compose down *>&1 | Out-Null
    docker compose pull --quiet
    docker compose up -d
  } finally {
    $ErrorActionPreference = $prevEAP
    Pop-Location
  }
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
      'pull'    {
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try { docker compose down *>&1 | Out-Null; docker compose pull; docker compose up -d }
        finally { $ErrorActionPreference = $prevEAP }
      }
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

  # Stop MCP container — wrap docker call to avoid PS NativeCommandError on stderr
  $mcpDir = Join-Path $RepoDir 'mcp\etc-platform'
  if (Test-Path $mcpDir) {
    Push-Location $mcpDir
    try {
      $prevEAP = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      docker compose down *>&1 | Out-Null
    } finally {
      $ErrorActionPreference = $prevEAP
      Pop-Location
    }
  }

  # Move out of $AiKitHome before deleting (cwd may be inside it)
  Set-Location $env:USERPROFILE
  Remove-Item -Recurse -Force $AiKitHome
  Write-Ok "Removed $AiKitHome"
  Write-Ok "Restore previous ~\.claude / ~\.cursor from latest backup at ~\ai-config-backup-* if needed."
}

function DoLogs {
  Ensure-Repo
  Push-Location (Join-Path $RepoDir 'mcp\etc-platform')
  try { docker compose logs -f etc-platform } finally { Pop-Location }
}

function DoPack {
  Ensure-Repo
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoDir 'pack.ps1') @Rest
}

function DoPublish {
  Ensure-Repo
  $msg = if ($Rest.Count -gt 0) { $Rest[0] } else { '' }
  if (-not $msg) {
    Write-Err 'Usage: ai-kit publish "<commit message>"'
    exit 1
  }
  Write-Info 'Pack ~/ -> repo'
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoDir 'pack.ps1')
  Write-Info 'Git commit + push'
  Push-Location $RepoDir
  try {
    git diff --quiet 2>$null; $unstagedClean = $LASTEXITCODE -eq 0
    git diff --cached --quiet 2>$null; $stagedClean = $LASTEXITCODE -eq 0
    $untracked = (git status --porcelain) -ne $null
    if ($unstagedClean -and $stagedClean -and -not $untracked) {
      Write-Ok 'No changes to publish'
      return
    }
    git add -A
    git commit -m $msg
    git push
    $sha = (git rev-parse --short HEAD).Trim()
    Write-Ok "Published $sha"
  } finally { Pop-Location }
}

function DoListBackups {
  $backups = Get-ChildItem -Path $env:USERPROFILE -Directory -Filter 'ai-config-backup-*' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending
  if ($backups.Count -eq 0) {
    Write-Warn "No backups found at $env:USERPROFILE\ai-config-backup-*"
    return
  }
  Write-Host 'Available backups (newest first):' -ForegroundColor White
  $i = 1
  foreach ($b in $backups) {
    $size = (Get-ChildItem $b.FullName -Recurse -Force -ErrorAction SilentlyContinue |
             Measure-Object -Property Length -Sum).Sum
    $sizeStr = if ($size -gt 1MB) { '{0:N1} MB' -f ($size / 1MB) } else { '{0:N0} KB' -f ($size / 1KB) }
    "{0,3}. {1}  ({2})" -f $i, $b.Name, $sizeStr | Write-Host
    $i++
  }
  Write-Host ''
  Write-Host 'Restore: ai-kit rollback [N]   (default 1 = newest)'
}

function DoRollback {
  $idx = if ($Rest.Count -gt 0) { [int]$Rest[0] } else { 1 }
  $backups = Get-ChildItem -Path $env:USERPROFILE -Directory -Filter 'ai-config-backup-*' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending
  if ($idx -lt 1 -or $idx -gt $backups.Count) {
    Write-Err "Backup #$idx not found. Run: ai-kit list-backups"
    exit 1
  }
  $backup = $backups[$idx - 1]
  Write-Warn "Restore from: $($backup.FullName)"
  Write-Warn 'This OVERWRITES ~\.claude and ~\.cursor with backup contents.'
  $yn = Read-Host 'Continue? (y/N)'
  if ($yn -notmatch '^[Yy]') { Write-Host 'Aborted.'; exit 0 }

  $cb = Join-Path $backup.FullName '.claude'
  $cu = Join-Path $backup.FullName '.cursor'
  if (Test-Path $cb) {
    Remove-Item -Recurse -Force (Join-Path $env:USERPROFILE '.claude') -ErrorAction SilentlyContinue
    Copy-Item -Recurse -Force $cb (Join-Path $env:USERPROFILE '.claude')
    Write-Ok 'Restored ~\.claude'
  }
  if (Test-Path $cu) {
    Remove-Item -Recurse -Force (Join-Path $env:USERPROFILE '.cursor') -ErrorAction SilentlyContinue
    Copy-Item -Recurse -Force $cu (Join-Path $env:USERPROFILE '.cursor')
    Write-Ok 'Restored ~\.cursor'
  }
  Write-Ok 'Rollback complete'
}

function DoClean {
  $keep = 3
  for ($i = 0; $i -lt $Rest.Count; $i++) {
    if ($Rest[$i] -eq '--keep' -and $i + 1 -lt $Rest.Count) {
      $keep = [int]$Rest[$i + 1]
    }
  }
  Write-Info "Keeping $keep most recent backups, deleting rest"
  $backups = Get-ChildItem -Path $env:USERPROFILE -Directory -Filter 'ai-config-backup-*' -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending
  $deleted = 0
  for ($i = $keep; $i -lt $backups.Count; $i++) {
    Remove-Item -Recurse -Force $backups[$i].FullName
    Write-Ok "Deleted: $($backups[$i].Name)"
    $deleted++
  }
  if ($deleted -eq 0) { Write-Ok 'Nothing to delete' }

  Write-Info 'Pruning unused docker images'
  docker image prune -f *> $null
  Write-Ok 'Docker images pruned'
}

function DoDiff {
  Ensure-Repo
  Write-Host 'Local edits vs team-config repo' -ForegroundColor White
  Write-Host ''
  foreach ($dir in @('claude', 'cursor')) {
    $repo = Join-Path $RepoDir $dir
    $deploy = Join-Path $env:USERPROFILE ".$dir"
    if (-not (Test-Path $repo) -or -not (Test-Path $deploy)) { continue }
    Write-Host "~\.$dir <-> repo\$dir" -ForegroundColor White

    # Compare via hash
    $repoFiles = Get-ChildItem -Path $repo -Recurse -File -ErrorAction SilentlyContinue |
      ForEach-Object { @{ rel = $_.FullName.Substring($repo.Length + 1); hash = (Get-FileHash $_.FullName -Algorithm MD5).Hash } }
    $deployFiles = Get-ChildItem -Path $deploy -Recurse -File -ErrorAction SilentlyContinue |
      ForEach-Object { @{ rel = $_.FullName.Substring($deploy.Length + 1); hash = (Get-FileHash $_.FullName -Algorithm MD5).Hash } }

    $repoMap = @{}; $repoFiles | ForEach-Object { $repoMap[$_.rel] = $_.hash }
    $deployMap = @{}; $deployFiles | ForEach-Object { $deployMap[$_.rel] = $_.hash }

    $diffs = @()
    foreach ($k in $deployMap.Keys) {
      if (-not $repoMap.ContainsKey($k))      { $diffs += "  + (local-only) $k" }
      elseif ($repoMap[$k] -ne $deployMap[$k]) { $diffs += "  ~ (modified)   $k" }
    }
    foreach ($k in $repoMap.Keys) {
      if (-not $deployMap.ContainsKey($k))    { $diffs += "  - (in-repo)    $k" }
    }
    if ($diffs.Count -eq 0) { Write-Ok 'In sync' }
    else { $diffs | Select-Object -First 50 | ForEach-Object { Write-Host $_ }
           if ($diffs.Count -gt 50) { Write-Host "  ... and $($diffs.Count - 50) more" } }
    Write-Host ''
  }
  Write-Host "Tip: 'ai-kit publish `"msg`"' to upstream local edits."
}

function DoEdit {
  Ensure-Repo
  if (Get-Command code -ErrorAction SilentlyContinue) {
    & code $RepoDir
  } elseif ($env:EDITOR) {
    & $env:EDITOR $RepoDir
  } else {
    Write-Info "Opening repo in Explorer (no `$env:EDITOR set, no VS Code)"
    Invoke-Item $RepoDir
  }
}

# ─── docs ──────────────────────────────────────────────────────────────
function Docs-RenderMd {
  param([Parameter(Mandatory)] [string] $File)
  if (Get-Command glow -ErrorAction SilentlyContinue) {
    & glow -p $File
  } elseif (Get-Command bat -ErrorAction SilentlyContinue) {
    & bat --style=plain --paging=always $File
  } else {
    # Set console output + codepage to UTF-8 so Vietnamese diacritics render
    $prev = [Console]::OutputEncoding
    $prevCP = $null
    try {
      $prevCP = (chcp) -replace '[^\d]'
      $null = chcp 65001
    } catch {}
    try {
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      $content = [System.IO.File]::ReadAllText($File, [System.Text.Encoding]::UTF8)
      if ($content.Length -gt 0 -and $content[0] -eq [char]0xFEFF) { $content = $content.Substring(1) }
      $content
    } finally {
      [Console]::OutputEncoding = $prev
      if ($prevCP) { try { $null = chcp $prevCP } catch {} }
    }
  }
}

function Docs-ListTopics {
  $docsDir = Join-Path $RepoDir 'docs'
  Write-Host "Available docs" -ForegroundColor White
  Write-Host ''
  Write-Dim "Workflows (task-oriented):"
  Get-ChildItem -Path (Join-Path $docsDir 'workflows') -Filter '*.md' -ErrorAction SilentlyContinue | ForEach-Object {
    $title = (Select-String -Path $_.FullName -Pattern '^title:\s*(.*)$' -List | ForEach-Object { $_.Matches[0].Groups[1].Value -replace '"','' })
    "  {0,-30} {1}" -f $_.BaseName, $title | Write-Host
  }
  Write-Host ''
  Write-Dim "Reference:"
  Get-ChildItem -Path (Join-Path $docsDir 'reference') -Filter '*.md' -ErrorAction SilentlyContinue | ForEach-Object {
    $title = (Select-String -Path $_.FullName -Pattern '^title:\s*(.*)$' -List | ForEach-Object { $_.Matches[0].Groups[1].Value -replace '"','' })
    "  {0,-30} {1}" -f $_.BaseName, $title | Write-Host
  }
  Write-Host ''
  Write-Dim "Other:"
  Get-ChildItem -Path $docsDir -Filter '*.md' -File -ErrorAction SilentlyContinue | ForEach-Object {
    $title = (Select-String -Path $_.FullName -Pattern '^title:\s*(.*)$' -List | ForEach-Object { $_.Matches[0].Groups[1].Value -replace '"','' })
    "  {0,-30} {1}" -f $_.BaseName, $title | Write-Host
  }
  Write-Host ''
  Write-Dim "Auto-generated:"
  Write-Host "  skills                         List all Claude + Cursor skills"
  Write-Host "  agents                         List all Claude + Cursor agents"
  Write-Host ''
  Write-Host "Usage: ai-kit docs <topic>   |   ai-kit docs --search <term>"
}

function Docs-ResolveTopic {
  param([string] $Topic)
  $docsDir = Join-Path $RepoDir 'docs'
  $candidates = @(
    (Join-Path $docsDir "$Topic.md"),
    (Join-Path $docsDir "workflows\$Topic.md"),
    (Join-Path $docsDir "reference\$Topic.md")
  )
  foreach ($p in $candidates) {
    if (Test-Path $p) { return $p }
  }
  # Fuzzy match
  $match = Get-ChildItem -Path $docsDir -Filter '*.md' -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.BaseName -like "*$Topic*" } | Select-Object -First 1
  if ($match) { return $match.FullName }
  return $null
}

function Docs-CleanDesc([string]$desc) {
  return ($desc -replace '^"','' -replace '"$','' -replace "^'",'' -replace "'$",'' -replace '^\[[^\]]+\]\s*','')
}

function Docs-PrintItem {
  param([string]$Name, [string]$Desc, [string]$Mode = 'full', [int]$NameWidth = 30)
  if ($Mode -eq 'brief') {
    $short = if ($Desc.Length -gt 90) { $Desc.Substring(0, 87) + '...' } else { $Desc }
    ("  {0,-$NameWidth} {1}" -f $Name, $short) | Write-Host
  } else {
    Write-Host ("  $Name") -ForegroundColor White
    Write-Host ("      $Desc")
    Write-Host ''
  }
}

function Docs-SkillsIndex {
  param([string]$Mode = 'full')
  Ensure-Repo
  Write-Host "Claude Skills  (~/.claude/skills/)" -ForegroundColor White
  Write-Host ''
  Get-ChildItem -Path (Join-Path $RepoDir 'claude\skills') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $skillMd = Join-Path $_.FullName 'SKILL.md'
    if (-not (Test-Path $skillMd)) { return }
    $desc = (Select-String -Path $skillMd -Pattern '^description:\s*(.*)$' -List | ForEach-Object { $_.Matches[0].Groups[1].Value })
    $desc = Docs-CleanDesc $desc
    Docs-PrintItem -Name "/$($_.Name)" -Desc $desc -Mode $Mode -NameWidth 25
  }
  Write-Host ''
  Write-Host "Cursor Skills  (~/.cursor/skills/)" -ForegroundColor White
  Write-Host ''
  Get-ChildItem -Path (Join-Path $RepoDir 'cursor\skills') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $skillMd = Join-Path $_.FullName 'SKILL.md'
    if (-not (Test-Path $skillMd)) { return }
    $desc = (Select-String -Path $skillMd -Pattern '^description:\s*(.*)$' -List | ForEach-Object { $_.Matches[0].Groups[1].Value })
    $desc = Docs-CleanDesc $desc
    Docs-PrintItem -Name "/$($_.Name)" -Desc $desc -Mode $Mode -NameWidth 25
  }
}

function Docs-AgentsIndex {
  param([string]$Mode = 'full')
  Ensure-Repo
  Write-Host "Claude Agents  (~/.claude/agents/)" -ForegroundColor White
  Write-Host ''
  Get-ChildItem -Path (Join-Path $RepoDir 'claude\agents') -Filter '*.md' -ErrorAction SilentlyContinue | ForEach-Object {
    $desc = (Select-String -Path $_.FullName -Pattern '^description:\s*(.*)$' -List | ForEach-Object { $_.Matches[0].Groups[1].Value })
    $desc = Docs-CleanDesc $desc
    Docs-PrintItem -Name $_.BaseName -Desc $desc -Mode $Mode -NameWidth 30
  }
  Write-Host ''
  Write-Host "Cursor Agents  (~/.cursor/agents/)" -ForegroundColor White
  Write-Host ''
  Get-ChildItem -Path (Join-Path $RepoDir 'cursor\agents') -Filter '*.md' -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike 'ref-*' } | ForEach-Object {
    $desc = (Select-String -Path $_.FullName -Pattern '^description:\s*(.*)$' -List | ForEach-Object { $_.Matches[0].Groups[1].Value })
    $desc = Docs-CleanDesc $desc
    Docs-PrintItem -Name $_.BaseName -Desc $desc -Mode $Mode -NameWidth 30
  }
}

function Docs-Search {
  param([Parameter(Mandatory)] [string] $Term)
  Ensure-Repo
  Write-Host "Searching for: $Term" -ForegroundColor White
  Write-Host ''
  $paths = @(
    (Join-Path $RepoDir 'docs'),
    (Join-Path $RepoDir 'claude\agents'),
    (Join-Path $RepoDir 'claude\skills'),
    (Join-Path $RepoDir 'cursor\agents'),
    (Join-Path $RepoDir 'cursor\skills')
  ) | Where-Object { Test-Path $_ }
  Get-ChildItem -Path $paths -Recurse -File -Include *.md -ErrorAction SilentlyContinue |
    Select-String -Pattern $Term -CaseSensitive:$false -SimpleMatch |
    Select-Object -First 50 |
    ForEach-Object {
      $rel = $_.Path.Replace($RepoDir, '').TrimStart('\','/')
      "  {0}:{1}: {2}" -f $rel, $_.LineNumber, $_.Line.Trim() | Write-Host
    }
}

function DoDocs {
  Ensure-Repo
  $sub = if ($Rest.Count -gt 0) { $Rest[0] } else { '' }
  switch ($sub) {
    ''               { Docs-ListTopics }
    '--toc'          { Docs-ListTopics }
    '--list'         { Docs-ListTopics }
    '-l'             { Docs-ListTopics }
    'index'          { Docs-ListTopics }
    'skills'         {
      $mode = if ($Rest.Count -gt 1 -and $Rest[1] -eq '--brief') { 'brief' } else { 'full' }
      Docs-SkillsIndex -Mode $mode
    }
    'agents'         {
      $mode = if ($Rest.Count -gt 1 -and $Rest[1] -eq '--brief') { 'brief' } else { 'full' }
      Docs-AgentsIndex -Mode $mode
    }
    '--search'       {
      if ($Rest.Count -lt 2) { Write-Err 'Usage: ai-kit docs --search <term>'; exit 1 }
      Docs-Search -Term $Rest[1]
    }
    '-s'             {
      if ($Rest.Count -lt 2) { Write-Err 'Usage: ai-kit docs -s <term>'; exit 1 }
      Docs-Search -Term $Rest[1]
    }
    '--open'         { DoEdit }
    '-o'             { DoEdit }
    default          {
      $file = Docs-ResolveTopic -Topic $sub
      if ($file) { Docs-RenderMd -File $file }
      else {
        Write-Err "Topic not found: $sub"
        Write-Host ''
        Docs-ListTopics
        exit 1
      }
    }
  }
}

function DoHelp {
@"
ai-kit $Version — team AI config manager

Usage:  ai-kit <command>

User commands:
  install            First-time setup (use bootstrap.ps1; this exists for symmetry)
  update | up        Pull latest team config + redeploy + refresh MCP image
  status | st        Show versions, deployed counts, MCP health
  logs               Tail MCP container logs
  doctor | dr        Verify deps + paths
  version | -v       Show ai-kit + team-config + MCP image versions

Documentation:
  docs               Show docs index (workflows + reference)
  docs <topic>       Render specific doc (eg: ai-kit docs new-feature)
  docs skills        Auto-list all skills (Claude + Cursor)
  docs agents        Auto-list all agents (Claude + Cursor)
  docs --search <t>  Grep across docs + agents + skills
  docs --open        Open repo docs/ in editor

MCP control:
  mcp <verb>         start | stop | restart | logs | pull | status

Backups:
  list-backups       List ~\ai-config-backup-* (newest first)
  rollback [N]       Restore from backup #N (default 1 = newest)
  clean [--keep N]   Delete old backups (keep N most recent, default 3) + docker prune

Maintainer:
  pack               Run pack.ps1: snapshot ~\ -> repo (review with 'ai-kit diff')
  publish "<msg>"    pack + git commit -m <msg> + git push (one-shot release)
  diff               Show what differs between deployed config and repo
  edit               Open team-ai-config in VS Code / `$env:EDITOR / Explorer

Misc:
  reset              Discard local repo edits + pull (interactive)
  uninstall          Remove $AiKitHome (keeps deployed config)
  help               Show this message

Layout:  $AiKitHome
"@ | Write-Host
}

switch ($Command) {
  'install'           { DoInstall }
  'update'            { DoUpdate }
  'up'                { DoUpdate }
  'status'            { DoStatus }
  'st'                { DoStatus }
  'doctor'            { DoDoctor }
  'dr'                { DoDoctor }
  'mcp'               { DoMcp }
  'logs'              { DoLogs }
  'pack'              { DoPack }
  'publish'           { DoPublish }
  'list-backups'      { DoListBackups }
  'backups'           { DoListBackups }
  'rollback'          { DoRollback }
  'clean'             { DoClean }
  'diff'              { DoDiff }
  'edit'              { DoEdit }
  'docs'              { DoDocs }
  'doc'               { DoDocs }
  'reset'             { DoReset }
  'version'           { DoVersion }
  '-v'                { DoVersion }
  '--version'         { DoVersion }
  'uninstall'         { DoUninstall }
  'help'              { DoHelp }
  '-h'                { DoHelp }
  '--help'            { DoHelp }
  default             { Write-Err "Unknown command: $Command"; DoHelp; exit 1 }
}
