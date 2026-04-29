@echo off
REM ai-kit Windows shim - invokes ai-kit.ps1 so users can call ai-kit from cmd.
REM Translates flag-style aliases (-v, --version, -h, --help) to subcommand
REM tokens because PowerShells -File mode swallows - args that dont match
REM declared parameter names.

setlocal
set "AIK_ARGS=%*"
if /i "%~1"=="-v"        set "AIK_ARGS=version"
if /i "%~1"=="--version" set "AIK_ARGS=version"
if /i "%~1"=="/v"        set "AIK_ARGS=version"
if /i "%~1"=="-h"        set "AIK_ARGS=help"
if /i "%~1"=="--help"    set "AIK_ARGS=help"
if /i "%~1"=="/h"        set "AIK_ARGS=help"
if /i "%~1"=="/?"        set "AIK_ARGS=help"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ai-kit.ps1" %AIK_ARGS%
endlocal
