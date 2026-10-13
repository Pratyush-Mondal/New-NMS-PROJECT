@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - REMOVE LOCAL AUTOSTART
color 0e
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - REMOVE AUTOMATIC STARTUP
echo ===============================================================
echo.

set "PYTHON_EXE="
if exist "backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=backend\venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

if exist "setup_local_autostart.py" (
    "%PYTHON_EXE%" setup_local_autostart.py --remove
) else (
    echo [ERROR] setup_local_autostart.py not found in %~dp0
)

echo.
echo ===============================================================
echo Automatic startup at logon has been disabled.
echo You can still start the server manually anytime using:
echo    START_NML_LOCAL.bat
echo ===============================================================
echo.
pause
exit /b 0
