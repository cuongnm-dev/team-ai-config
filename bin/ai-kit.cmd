@echo off
REM ai-kit launcher - Node.js + Ink CLI (Windows)

setlocal

set "DIR=%~dp0"
pushd "%DIR%.." & set "AI_HOME=%CD%" & popd
if defined AI_KIT_HOME set "AI_HOME=%AI_KIT_HOME%"
set "REPO_DIR=%AI_HOME%\team-ai-config"

where node >nul 2>nul
if errorlevel 1 (
  echo X Node.js not found. Install Node 18+:
  echo   winget install OpenJS.NodeJS.LTS
  exit /b 1
)

if exist "%AI_HOME%\node_modules" goto :run

echo Installing Node deps...
if exist "%REPO_DIR%\package.json" (
  copy /y "%REPO_DIR%\package.json" "%AI_HOME%\package.json" >nul
)
pushd "%AI_HOME%"
call npm install --omit=dev --silent
if errorlevel 1 (
  popd
  echo X npm install failed.
  echo   Try manually: cd %AI_HOME% ^&^& npm install --omit=dev
  exit /b 1
)
popd

:run
REM Self-heal: sync bin\lib from repo if missing (post-modular-refactor)
if not exist "%DIR%lib\util.mjs" (
  if exist "%REPO_DIR%\bin\lib" (
    xcopy /E /I /Y /Q "%REPO_DIR%\bin\lib" "%DIR%lib\" >nul
  )
)
node "%DIR%ai-kit.mjs" %*
exit /b %ERRORLEVEL%
