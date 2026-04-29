@echo off
REM ai-kit Windows shim — invokes ai-kit.ps1 so users can call `ai-kit` from cmd.exe
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ai-kit.ps1" %*
