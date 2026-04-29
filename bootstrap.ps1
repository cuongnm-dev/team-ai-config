# Team AI config bootstrap — Windows (PowerShell 5.1+)
# One-liner: irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex

#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$RepoUrl   = if ($env:REPO_URL) { $env:REPO_URL } else { 'https://github.com/cuongnm-dev/team-ai-config.git' }
$AiKitHome = if ($env:AI_KIT_HOME) { $env:AI_KIT_HOME } else { Join-Path $env:USERPROFILE '.ai-kit' }
$RepoDir   = Join-Path $AiKitHome 'team-ai-config'
$BinDir    = Join-Path $AiKitHome 'bin'

function Write-Info($msg) { Write-Host "▶ $msg" -ForegroundColor White }
function Write-Ok($msg)   { Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Err($msg)  { Write-Host "  ✗ $msg" -ForegroundColor Red }

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
    Write-Info "AI_KIT_FORCE_CLEAN=1 detected - discarding local repo changes"
    Invoke-GitChecked -Args @('-C', $Path, 'reset', '--hard', 'HEAD') -ErrorMessage "Failed to reset local changes in $Path"
    Invoke-GitChecked -Args @('-C', $Path, 'clean', '-fd') -ErrorMessage "Failed to clean untracked files in $Path"
    return
  }

  Write-Err "Local changes detected in $Path. Refusing to auto-merge."
  Write-Host "  Review with:  git -C $Path status"
  Write-Host "  Keep changes: git -C $Path stash push -u"
  Write-Host "  Discard all:  `$env:AI_KIT_FORCE_CLEAN='1'; .\\bootstrap.ps1"
  exit 1
}

# Pre-flight
foreach ($cmd in @('git','docker')) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Err "Required: $cmd (not found in PATH). Install it and re-run."
    exit 1
  }
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Err "Docker daemon not running. Start Docker Desktop and re-run."
  exit 1
}

# Clone or update
New-Item -ItemType Directory -Path $AiKitHome -Force | Out-Null
if (Test-Path (Join-Path $RepoDir '.git')) {
  Write-Info "Existing repo at $RepoDir — pulling latest"
  Resolve-DirtyRepo -Path $RepoDir
  Invoke-GitChecked -Args @('-C', $RepoDir, 'pull', '--ff-only', '--quiet') -ErrorMessage "Failed to pull latest team-ai-config"
} else {
  Write-Info "Cloning team-ai-config to $RepoDir"
  Invoke-GitChecked -Args @('clone', '--quiet', $RepoUrl, $RepoDir) -ErrorMessage "Failed to clone team-ai-config"
}
$sha = (& git -C $RepoDir rev-parse --short HEAD).Trim()
if ($LASTEXITCODE -ne 0) {
  Write-Err "Failed to determine current commit at $RepoDir"
  exit 1
}
Write-Ok "Repo at $sha"

# Install ai-kit launcher to bin/
New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
Copy-Item -Force (Join-Path $RepoDir 'bin\ai-kit.cmd') (Join-Path $BinDir 'ai-kit.cmd')
Copy-Item -Force (Join-Path $RepoDir 'bin\ai-kit.ps1') (Join-Path $BinDir 'ai-kit.ps1')
Write-Ok "Installed ai-kit to $BinDir"

# Add to user PATH (persistent, no admin needed)
$userPath = [Environment]::GetEnvironmentVariable('Path','User')
$pathParts = if ($userPath) { $userPath -split ';' } else { @() }
if ($pathParts -notcontains $BinDir) {
  $newPath = if ($userPath) { "$userPath;$BinDir" } else { $BinDir }
  [Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
  Write-Ok "Added $BinDir to user PATH (effective in NEW terminals)"
} else {
  Write-Ok "$BinDir already in PATH"
}

# Make AI_KIT_HOME persistent
[Environment]::SetEnvironmentVariable('AI_KIT_HOME', $AiKitHome, 'User')

# Run first-time deploy + MCP via ai-kit (use repo path directly since PATH not yet refreshed)
Write-Info "Running first-time deploy"
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoDir 'bin\ai-kit.ps1') update

@"

✅ ai-kit installed.

  Open a NEW PowerShell / cmd terminal so PATH picks up.

  Then try:
    ai-kit status
    ai-kit help

  Update later:
    ai-kit update
"@ | Write-Host
