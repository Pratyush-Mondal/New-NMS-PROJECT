@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - START LOCAL SERVER
color 0a
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - LOCAL SERVER LAUNCHER
echo ===============================================================
echo.

if not exist "logs" mkdir "logs"

:: Ensure backend\.env exists with cloud credentials
if not exist "backend\.env" (
    (
        echo DATABASE_URL=mysql://2v9Ac8dmNnbuaJg.root:3K1EV2DPGMMw6yEb@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test
        echo MYSQL_HOST=127.0.0.1
        echo MYSQL_PORT=3307
        echo MYSQL_USER=root
        echo MYSQL_PASSWORD=
        echo MYSQL_DATABASE=neo_metaliks_nms
        echo JWT_SECRET=zP2CxWJeZngbA4tVz8OcU_t6wDXWZFHTEX_uGj56q_CzFwEJO8E-Xvds3xpJYQkI
    ) > "backend\.env"
)

:: Locate Python executable
set "PYTHON_EXE="
if exist "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" -c "import sys; sys.exit(0)" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
    )
)
if not defined PYTHON_EXE (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=python"
    ) else (
        echo [ERROR] Python was not found. Please run SETUP_NML_LOCAL_FIRST_TIME.bat first.
        pause
        exit /b 1
    )
)

:: Locate Chrome executable if available
set "CHROME_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

:: Check if already running and responding on port 8000
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($h.success) { exit 0 } } catch {}; exit 1"
if %errorlevel% equ 0 (
    echo [INFO] Neo Metaliks NMS is ALREADY RUNNING and healthy on http://127.0.0.1:8000
    if defined CHROME_EXE (
        echo [INFO] Opening dashboard directly in Google Chrome...
        start "" "%CHROME_EXE%" "http://127.0.0.1:8000"
    ) else (
        echo [INFO] Opening dashboard in default web browser...
        start http://127.0.0.1:8000
    )
    ping 127.0.0.1 -n 3 >nul
    exit /b 0
)

echo [INFO] Starting Neo Metaliks Local NMS Server...
echo [INFO] Port       : 8000
echo [INFO] Log File   : logs\local_nms.log
echo.

set "PYTHONW_EXE=%PYTHON_EXE:python.exe=pythonw.exe%"
if not exist "%PYTHONW_EXE%" set "PYTHONW_EXE=%PYTHON_EXE%"

start "" "%PYTHONW_EXE%" run_local_nms.py

echo Waiting for server to initialize...
powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i=1; $i -le 20; $i++) { Start-Sleep -Seconds 1; try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($res.success) { Write-Output ('[SUCCESS] Server is online and responding! (Ready in ' + $i + 's)'); exit 0 } } catch { Write-Host ('.') -NoNewline } }; Write-Output '[INFO] Server process launched. Ready for connections.'; exit 0"

echo.
echo ===============================================================
echo  Local NMS Server URL : http://127.0.0.1:8000
echo  Render Cloud URL     : https://neo-metaliks-nms.onrender.com
echo ===============================================================
echo.

if defined CHROME_EXE (
    echo [INFO] Opening dashboard directly in Google Chrome...
    start "" "%CHROME_EXE%" "http://127.0.0.1:8000"
) else (
    echo [INFO] Opening dashboard in default web browser...
    start http://127.0.0.1:8000
)

ping 127.0.0.1 -n 3 >nul
exit /b 0
