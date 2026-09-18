@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo   Pixelator - GPU Accelerated Pixel Sorting Simulator
echo ========================================================

set "PY_CMD="

:: 1. Check existing CUDA-enabled PyTorch environment
if exist "D:\subworks\english practice\.venv\Scripts\python.exe" (
    echo [INFO] Found CUDA environment: D:\subworks\english practice\.venv
    set "PY_CMD=D:\subworks\english practice\.venv\Scripts\python.exe"
)

:: 2. If not found, check system python
if "%PY_CMD%"=="" (
    where python >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        python -c "import torch; exit(0 if torch.cuda.is_available() else 1)" >nul 2>&1
        if %ERRORLEVEL% EQU 0 (
            echo [INFO] System Python has CUDA acceleration enabled!
            set "PY_CMD=python"
        )
    )
)

:: 3. Fallback to embedded python if CUDA python is not found
if "%PY_CMD%"=="" (
    echo [INFO] Using standalone embedded Python runtime...
    if not exist "%~dp0python\python.exe" (
        echo [INFO] Embedded Python environment not found. Running setup first...
        call "%~dp0setup.bat"
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Setup failed.
            pause
            exit /b 1
        )
    )
    set "PY_CMD=%~dp0python\python.exe"
)

echo [INFO] Running with Python: %PY_CMD%
echo [INFO] Launching Pixelator Server and opening browser...
start "" "http://127.0.0.1:5000"
"%PY_CMD%" "%~dp0server.py"

pause
