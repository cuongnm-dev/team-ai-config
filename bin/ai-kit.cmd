@echo off
REM ai-kit launcher - Node.js + Ink CLI (Windows)
REM Falls back to legacy PowerShell CLI if Node is unavailable.

setlocal
chcp 65001 >nul

set "DIR=%~dp0"
set "REPO_ROOT=%DIR%.."

where node >nul 2>nul
if errorlevel 1 (
  echo X Node.js not found. Install Node 18+:
  echo   winget install OpenJS.NodeJS.LTS
  exit /b 1
)

if not exist "%REPO_ROOT%\node_modules" (
  echo Installing Node deps ^(one-time^)...
  pushd "%REPO_ROOT%"
  call npm install --omit=dev --silent
  set "NPM_EXIT=%ERRORLEVEL%"
  popd
  if not "%NPM_EXIT%"=="0" (
    echo X npm install failed; falling back to legacy CLI
    powershell -NoProfile -ExecutionPolicy Bypass -File "%DIR%ai-kit.legacy.ps1" %*
    exit /b %ERRORLEVEL%
  )
)

node "%DIR%ai-kit.mjs" %*
exit /b %ERRORLEVEL%
