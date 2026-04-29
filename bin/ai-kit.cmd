@echo off
REM ai-kit Windows shim - invokes ai-kit.ps1 so users can call ai-kit from cmd.
REM Translates flag-style aliases (-v, --version, -h, --help) to subcommand
REM tokens because PowerShells -File mode swallows - args that dont match
REM declared parameter names.

setlocal

REM Switch console codepage to UTF-8 so Vietnamese diacritics render correctly.
REM Save current codepage to restore on exit.
for /f "tokens=2 delims=:" %%i in ('chcp') do set "AIK_OLD_CP=%%i"
chcp 65001 >nul

set "AIK_ARGS=%*"
if /i "%~1"=="-v"        set "AIK_ARGS=version"
if /i "%~1"=="--version" set "AIK_ARGS=version"
if /i "%~1"=="/v"        set "AIK_ARGS=version"
if /i "%~1"=="-h"        set "AIK_ARGS=help"
if /i "%~1"=="--help"    set "AIK_ARGS=help"
if /i "%~1"=="/h"        set "AIK_ARGS=help"
if /i "%~1"=="/?"        set "AIK_ARGS=help"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ai-kit.ps1" %AIK_ARGS%
set "AIK_EXIT=%ERRORLEVEL%"

REM Restore previous codepage
chcp %AIK_OLD_CP% >nul

endlocal & exit /b %AIK_EXIT%
