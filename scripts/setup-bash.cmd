@echo off
REM setup-bash.cmd — double-click wrapper for setup-bash.ps1
REM Installs/detects Git for Windows bash and sets CODEBUFF_GIT_BASH_PATH.
REM After it finishes, close and reopen the app, then ask the assistant to continue.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-bash.ps1"
echo.
echo If the script succeeded, restart the app now, then continue the session.
pause
