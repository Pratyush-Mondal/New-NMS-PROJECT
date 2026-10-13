@echo off
title NEO METALIKS - ON-PREMISES PLANT LAN PROBE AGENT
color 0b
cd /d "%~dp0"

echo =======================================================
echo    NEO METALIKS NMS - ON-PREM PLANT PROBE AGENT
echo =======================================================
echo.
echo Starting direct Plant LAN ping monitor (192.168.x.x) -> TiDB Cloud...
echo.

if exist ".\backend\venv\Scripts\python.exe" (
    .\backend\venv\Scripts\python.exe plant_lan_probe.py
) else (
    python plant_lan_probe.py
)

if %errorlevel% equ 0 (
    if exist "logs\plant_probe.log" (
        echo.
        echo [Recent Log Entries]:
        powershell -NoProfile -Command "Get-Content 'logs\plant_probe.log' -Tail 10"
    )
)

pause
