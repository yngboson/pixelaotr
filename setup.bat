@echo off
setlocal
cd /d "%~dp0"

echo [Pixelator Setup] Starting Embedded Python and Dependency Setup...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Setup encountered an issue. Please check the logs above.
    pause
    exit /b %ERRORLEVEL%
)

echo [Pixelator Setup] All components ready!
pause
