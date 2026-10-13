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

.\backend\venv\Scripts\python.exe plant_lan_probe.py
if %errorlevel% neq 0 (
    python plant_lan_probe.py
)

pause
