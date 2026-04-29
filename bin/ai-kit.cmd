@echo off
REM ai-kit launcher - Node.js + Ink CLI (Windows)
REM node_modules live in AI_KIT_HOME so ESM resolves them.

setlocal

set "DIR=%~dp0"
pushd "%DIR%.." & set "PKG_ROOT=%CD%" & popd

where node >nul 2>nul
if errorlevel 1 (
  echo X Node.js not found. Install Node 18+:
  echo   winget install OpenJS.NodeJS.LTS
  exit /b 1
)

if not exist "%PKG_ROOT%\node_modules" (
  echo Installing Node deps ^(one-time^)...
  pushd "%PKG_ROOT%"
  call npm install --omit=dev --silent
  set "NPM_EXIT=%ERRORLEVEL%"
  popd
  if not "%NPM_EXIT%"=="0" (
    echo X npm install failed.
    exit /b 1
  )
)

node "%DIR%ai-kit.mjs" %*
exit /b %ERRORLEVEL%
