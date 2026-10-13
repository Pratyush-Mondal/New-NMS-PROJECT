@echo off
title NEO METALIKS NMS - PROBE STATUS CHECK
color 0a
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - BACKGROUND MONITORING STATUS
echo ===============================================================
echo.

echo 1. Checking Windows Scheduled Task...
schtasks /query /tn "NeoMetaliks_PlantProbe" /fo LIST 2>nul
if %errorlevel% neq 0 (
    echo [NOTE] Scheduled task 'NeoMetaliks_PlantProbe' is not currently registered.
    echo Run setup_autostart_task.bat to register Task Scheduler autostart.
)

echo.
echo 2. Checking Active Probe Process...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*plant_lan_probe.py*' } | Select-Object ProcessId, Name | Format-Table -AutoSize"

echo.
echo 3. Recent Activity Log [logs\plant_probe.log]...
if exist "logs\plant_probe.log" (
    powershell -NoProfile -Command "Get-Content 'logs\plant_probe.log' -Tail 15"
) else (
    echo [INFO] Log file not found yet: logs\plant_probe.log
)

echo.
echo ===============================================================
pause
