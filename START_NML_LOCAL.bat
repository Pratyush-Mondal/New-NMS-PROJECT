@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - START LOCAL SERVER
color 0a
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - LOCAL SERVER LAUNCHER
echo ===============================================================
echo.

set "PYTHON_EXE="
if exist "backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=backend\venv\Scripts\python.exe"
) else (
    set "PYTHON_EXE=python"
)

:: Check if already running on port 8000
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue; if ($c.TcpTestSucceeded) { exit 0 } else { exit 1 }"
if %errorlevel% equ 0 (
    echo [INFO] Neo Metaliks NMS is ALREADY RUNNING on http://127.0.0.1:8000
    echo Opening dashboard in your default browser...
    start http://127.0.0.1:8000
    ping 127.0.0.1 -n 3 >nul
    exit /b 0
)

echo [INFO] Starting Neo Metaliks Local NMS Server...
echo [INFO] Executable : %PYTHON_EXE%
echo [INFO] Port       : 8000
echo [INFO] Log File   : logs\local_nms.log
echo.

:: Launch in background via pythonw if available, else python
set "PYTHONW_EXE=%PYTHON_EXE:python.exe=pythonw.exe%"
if not exist "%PYTHONW_EXE%" set "PYTHONW_EXE=%PYTHON_EXE%"

start "" "%PYTHONW_EXE%" run_local_nms.py

echo Waiting for server to initialize...
powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i=1; $i -le 15; $i++) { Start-Sleep -Seconds 1; try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($res.success) { Write-Output '[SUCCESS] Server is online and healthy!'; exit 0 } } catch {} }; Write-Output '[INFO] Server process launched. Please check logs\local_nms.log if port takes longer to respond.'; exit 0"

echo.
echo ===============================================================
echo  Local NMS Server URL : http://127.0.0.1:8000
echo  Render Cloud URL     : https://neo-metaliks-nms.onrender.com
echo ===============================================================
echo Opening browser...
start http://127.0.0.1:8000

ping 127.0.0.1 -n 3 >nul
exit /b 0
