# Deploy claude\ + cursor\ from this repo into ~\.claude and ~\.cursor (Windows).
# Called by ai-kit (install/update). Idempotent. Backs up first.
#
# Whitelist deploy: only touches paths PRESENT in the repo's claude\ and cursor\
# subtrees. Anything else in user's ~\.claude or ~\.cursor is never touched.

#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$RepoRoot   = $PSScriptRoot
$ClaudeHome = Join-Path $env:USERPROFILE '.claude'
$CursorHome = Join-Path $env:USERPROFILE '.cursor'
$Timestamp  = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupDir  = Join-Path $env:USERPROFILE "ai-config-backup-$Timestamp"

function Deploy-Whitelist {
  param(
    [Parameter(Mandatory)] [string] $Source,
    [Parameter(Mandatory)] [string] $Destination,
    [Parameter(Mandatory)] [string] $BackupSub
  )

  if (-not (Test-Path $Source)) {
    Write-Host "  ! $Source not in repo, skip"
    return
  }

  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  $backupTarget = Join-Path $BackupDir $BackupSub

  Get-ChildItem -Path $Source -Force | ForEach-Object {
    $name = $_.Name
    $userPath = Join-Path $Destination $name
    if (Test-Path $userPath) {
      New-Item -ItemType Directory -Path $backupTarget -Force | Out-Null
      Copy-Item -Recurse -Force -Path $userPath -Destination (Join-Path $backupTarget $name)
    }
  }

  Get-ChildItem -Path $Source -Force | ForEach-Object {
    $target = Join-Path $Destination $_.Name
    if (Test-Path $target) { Remove-Item -Recurse -Force $target }
    if ($_.PSIsContainer) {
      Copy-Item -Recurse -Force -Path $_.FullName -Destination $target
    } else {
      Copy-Item -Force -Path $_.FullName -Destination $target
    }
    Write-Host "  + $($_.Name) -> $target"
  }
}

New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
Deploy-Whitelist -Source (Join-Path $RepoRoot 'claude') -Destination $ClaudeHome -BackupSub '.claude'
Deploy-Whitelist -Source (Join-Path $RepoRoot 'cursor') -Destination $CursorHome -BackupSub '.cursor'

# Remove empty backup dir (first install)
if (-not (Get-ChildItem -Path $BackupDir -ErrorAction SilentlyContinue)) {
  Remove-Item -Force $BackupDir
} else {
  Write-Host "  ✓ backup -> $BackupDir"
}
