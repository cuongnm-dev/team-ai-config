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

$AutoInstall = ($args -contains '--auto-install') -or ($env:AI_KIT_AUTO_INSTALL -eq '1')

function Hint-Install($tool) {
  switch ($tool) {
    'git'    { 'winget install --id Git.Git -e' }
    'docker' { 'Download Docker Desktop: https://www.docker.com/products/docker-desktop/  (or: winget install --id Docker.DockerDesktop -e)' }
    'python' { 'winget install --id Python.Python.3.12 -e' }
    'node'   { 'winget install --id OpenJS.NodeJS.LTS -e' }
    'curl'   { 'Built-in on Windows 10+; install via winget if missing: winget install --id curl.curl -e' }
    default  { "winget install $tool" }
  }
}

function Auto-Install($tool) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Write-Err 'winget not found. Install App Installer from Microsoft Store, then re-run.'
    return $false
  }
  switch ($tool) {
    'git'    { winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements; return ($LASTEXITCODE -eq 0) }
    'python' { winget install --id Python.Python.3.12 -e --accept-source-agreements --accept-package-agreements; return ($LASTEXITCODE -eq 0) }
    'node'   { winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements; return ($LASTEXITCODE -eq 0) }
    'docker' { Write-Err 'Docker Desktop auto-install too risky (needs admin + reboot for WSL2). Install manually:'; Write-Host "  $(Hint-Install 'docker')"; return $false }
    default  { winget install $tool; return ($LASTEXITCODE -eq 0) }
  }
}

# ─── env check ─────────────────────────────────────────────────────────
Write-Info 'Checking environment'
$missing = @()
foreach ($t in @('git','docker','python','curl','node')) {
  $bin = $t
  if ($t -eq 'python') { $bin = 'python' }
  if (Get-Command $bin -ErrorAction SilentlyContinue) {
    Write-Ok "$t found"
  } else {
    Write-Err "$t MISSING — Install: $(Hint-Install $t)"
    $missing += $t
  }
}
# Node version check (>= 18)
if (Get-Command node -ErrorAction SilentlyContinue) {
  $nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0])
  if ($nodeMajor -lt 18) {
    Write-Err "node v$nodeMajor too old — ai-kit needs Node >= 18"
    $missing += 'node'
  }
}
# Docker daemon
if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) { Write-Ok 'docker daemon running' }
  else { Write-Err 'docker daemon NOT running — Start Docker Desktop and re-run'; $missing += 'docker-daemon' }
}

if ($missing.Count -gt 0) {
  Write-Host ''
  if ($AutoInstall) {
    Write-Info 'Auto-installing missing tools (--auto-install)'
    foreach ($t in $missing) {
      if ($t -eq 'docker-daemon') { continue }
      Write-Info "  Installing $t..."
      if (Auto-Install $t) { Write-Ok "$t installed (may need terminal restart)" }
      else { Write-Err "$t install failed — install manually + re-run"; exit 1 }
    }
    Write-Host ''
    Write-Err 'Auto-install completed. Open a NEW terminal and re-run bootstrap (PATH/daemon refresh needed).'
    exit 0
  } else {
    Write-Err "Missing $($missing.Count) required tool(s). Install above + re-run, or use --auto-install:"
    Write-Err '  irm https://raw.githubusercontent.com/cuongnm-dev/team-ai-config/main/bootstrap.ps1 | iex; ai-kit-bootstrap --auto-install'
    Write-Err '  (or save script + run: .\bootstrap.ps1 --auto-install)'
    exit 1
  }
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

# Auto-install glow (markdown renderer for pretty 'ai-kit doc' output)
# Optional — failure is non-blocking, fallback is plain text.
if (-not (Get-Command glow -ErrorAction SilentlyContinue)) {
  Write-Info 'Installing glow (markdown renderer for prettier docs)'
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    & winget install --id charmbracelet.glow -e --accept-source-agreements --accept-package-agreements --silent 2>&1 | Out-Null
    if (Get-Command glow -ErrorAction SilentlyContinue) {
      Write-Ok 'glow installed (open NEW terminal to use)'
    } else {
      Write-Host '  ! glow install via winget failed — manual: winget install charmbracelet.glow'
    }
  } else {
    Write-Host '  ! winget not available — install glow manually for prettier docs:'
    Write-Host '    https://github.com/charmbracelet/glow#installation'
  }
}

# Install Node deps into $AiKitHome (where ai-kit.cmd + ai-kit looks for node_modules)
$pkgSrc = Join-Path $RepoDir 'package.json'
$pkgDst = Join-Path $AiKitHome 'package.json'
if ((Test-Path $pkgSrc) -and (-not (Test-Path (Join-Path $AiKitHome 'node_modules')))) {
  Write-Info 'Installing Node.js dependencies'
  Copy-Item -Force $pkgSrc $pkgDst
  Push-Location $AiKitHome
  try {
    & npm.cmd install --omit=dev --silent
    if ($LASTEXITCODE -eq 0) { Write-Ok 'Node deps installed' }
    else { Write-Host '  ! npm install failed — CLI will fall back to legacy mode' -ForegroundColor Yellow }
  } finally { Pop-Location }
}

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
