# deploy.ps1 — migration stub for ai-kit versions < 0.2.0 (PS CLI era)
# New ai-kit (Node.js) handles deployment inline in cmdUpdate.
# This stub is kept so old cached CLIs can finish their update cycle cleanly.
param()
$ErrorActionPreference = 'Stop'
$RepoDir = $PSScriptRoot

function Write-Ok($t) { Write-Host "  + $t" -ForegroundColor Green }

function Deploy-Dir {
  param([string]$Sub, [string]$Target)
  $src = Join-Path $RepoDir $Sub
  $dst = Join-Path $env:USERPROFILE $Target
  if (-not (Test-Path $src)) { return }
  New-Item -ItemType Directory -Path $dst -Force | Out-Null
  Get-ChildItem -Path $src -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($src.Length).TrimStart('\/')
    $dstFile = Join-Path $dst $rel
    New-Item -ItemType Directory -Path (Split-Path $dstFile) -Force | Out-Null
    Copy-Item -Force $_.FullName $dstFile
  }
  Write-Ok $Target
}

Write-Host "  Deploying agents + skills" -ForegroundColor Cyan
Deploy-Dir "claude\agents" ".claude\agents"
Deploy-Dir "claude\skills" ".claude\skills"
Deploy-Dir "cursor\agents" ".cursor\agents"
Deploy-Dir "cursor\skills" ".cursor\skills"
# Windsurf (added 2026-05-04). Workflows nested at .codeium\windsurf\windsurf\workflows per Windsurf convention.
Deploy-Dir "windsurf\skills"    ".codeium\windsurf\skills"
Deploy-Dir "windsurf\memories"  ".codeium\windsurf\memories"
Deploy-Dir "windsurf\workflows" ".codeium\windsurf\windsurf\workflows"
Write-Ok "Deploy complete (run 'ai-kit update' again to use new Node.js CLI)"
