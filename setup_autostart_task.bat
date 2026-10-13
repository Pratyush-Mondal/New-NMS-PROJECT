@echo off
title NEO METALIKS NMS - AUTO-STARTUP SETUP
color 0b
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - AUTOMATIC STARTUP SETUP WIZARD
echo ===============================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Administrator privileges are required to configure Windows Task Scheduler.
    echo [INFO] Requesting elevation...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~dp0setup_autostart_task.bat\"\" elevated' -Verb RunAs"
    exit /b
)

:: Running elevated
echo [OK] Running with Administrator privileges.
echo Configuring Task Scheduler for non-interactive background monitoring...
echo.

if exist ".\backend\venv\Scripts\python.exe" (
    ".\backend\venv\Scripts\python.exe" setup_autostart.py
) else (
    python setup_autostart.py
)

echo.
echo ===============================================================
echo Setup complete. You can close this window.
echo ===============================================================
pause
