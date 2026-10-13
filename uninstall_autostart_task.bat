@echo off
title NEO METALIKS NMS - UNINSTALL AUTO-STARTUP TASK
color 0c
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - REMOVE AUTO-STARTUP SCHEDULED TASK
echo ===============================================================
echo.

echo 1. Removing user startup folder launcher (if present)...
set "STARTUP_VBS=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\NeoMetaliks_PlantProbe.vbs"
if exist "%STARTUP_VBS%" (
    del /f /q "%STARTUP_VBS%" >nul 2>&1
    echo [OK] Removed user startup launcher: %STARTUP_VBS%
) else (
    echo [INFO] No user startup VBS launcher found.
)

echo.
echo 2. Removing Task Scheduler task (NeoMetaliks_PlantProbe)...
schtasks /end /tn "NeoMetaliks_PlantProbe" >nul 2>&1
schtasks /delete /tn "NeoMetaliks_PlantProbe" /f >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Scheduled task 'NeoMetaliks_PlantProbe' has been removed.
) else (
    echo [INFO] Task was not found in Task Scheduler (or already removed).
)

echo.
echo ===============================================================
echo Autostart configuration has been completely removed.
echo ===============================================================
pause
