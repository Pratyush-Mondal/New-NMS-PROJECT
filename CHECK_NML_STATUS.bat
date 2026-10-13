@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - STATUS DIAGNOSTIC
color 0e
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - SYSTEM STATUS DIAGNOSTIC
echo ===============================================================
echo.

:: 1. Check Port 8000 & Health Endpoint
echo [1] Checking Local Server Status (Port 8000)...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue; if ($c.TcpTestSucceeded) { Write-Output '    Port 8000       : OPEN / LISTENING'; try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 3; Write-Output ('    Health Endpoint : HEALTHY (' + $h.status + ')') } catch { Write-Output '    Health Endpoint : Port open, but HTTP error: ' + $_.Exception.Message } } else { Write-Output '    Port 8000       : NOT RUNNING / CLOSED'; Write-Output '    Health Endpoint : Offline' }"

echo.
:: 2. Check Autostart Configuration
echo [2] Checking Windows Autostart Status...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$task = schtasks /query /tn 'NeoMetaliks_LocalNMS' 2>$null; $vbs = Test-Path ($env:APPDATA + '\Microsoft\Windows\Start Menu\Programs\Startup\NeoMetaliks_LocalNMS.vbs'); if ($LASTEXITCODE -eq 0) { Write-Output '    Task Scheduler  : REGISTERED (NeoMetaliks_LocalNMS)' } else { Write-Output '    Task Scheduler  : Not registered in Task Scheduler' }; if ($vbs) { Write-Output '    Startup Folder  : ACTIVE (NeoMetaliks_LocalNMS.vbs)' } else { Write-Output '    Startup Folder  : Not present in Startup folder' }"

echo.
:: 3. Check Database Connectivity
echo [3] Checking Database Connectivity...
if exist "check_local_db.py" (
    if exist "backend\venv\Scripts\python.exe" (
        "backend\venv\Scripts\python.exe" check_local_db.py
    ) else (
        python check_local_db.py 2>nul
    )
) else (
    echo     [INFO] check_local_db.py not found.
)

echo.
:: 4. Check Cloud Production Deployment
echo [4] Checking Render Cloud Website...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $res = Invoke-WebRequest -Uri 'https://neo-metaliks-nms.onrender.com/api/health' -TimeoutSec 5 -UseBasicParsing; Write-Output ('    Render Website  : ONLINE (HTTP ' + $res.StatusCode + ')') } catch { Write-Output '    Render Website  : Note: May be sleeping or offline (' + $_.Exception.Message + ')' }"

echo.
:: 5. Recent Server Log
echo [5] Recent Server Log Entries (logs\local_nms.log):
echo ---------------------------------------------------------------
if exist "logs\local_nms.log" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content 'logs\local_nms.log' -Tail 8 -ErrorAction SilentlyContinue"
) else (
    echo     [INFO] No log file created yet.
)
echo ---------------------------------------------------------------

echo.
echo ===============================================================
echo  Access Points:
echo   - Local Website : http://127.0.0.1:8000
echo   - Cloud Website : https://neo-metaliks-nms.onrender.com
echo ===============================================================
echo.
pause
exit /b 0
