@echo off
title NEO METALIKS NMS - UNINSTALL AUTO-STARTUP TASK
color 0c
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - REMOVE AUTO-STARTUP SCHEDULED TASK
echo ===============================================================
echo.

:: Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Administrator privileges are required to remove Windows Scheduled Tasks.
    echo [INFO] Requesting elevation...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~dp0uninstall_autostart_task.bat\"\" elevated' -Verb RunAs"
    exit /b
)

echo [OK] Stopping and removing task NeoMetaliks_PlantProbe...
schtasks /end /tn "NeoMetaliks_PlantProbe" >nul 2>&1
schtasks /delete /tn "NeoMetaliks_PlantProbe" /f
if %errorlevel% equ 0 (
    echo [SUCCESS] Scheduled task 'NeoMetaliks_PlantProbe' has been successfully removed.
) else (
    echo [INFO] Task was not found or already removed.
)

echo.
pause
