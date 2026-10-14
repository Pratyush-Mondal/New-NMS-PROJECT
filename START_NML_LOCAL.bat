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

:: Locate Chrome executable if available
set "CHROME_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

:: 1. Check if local server is already running and responding
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

:: 2. Detect Python runtime
set "PYTHON_EXE="
if exist "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" -c "import sys; sys.exit(0)" >nul 2>&1
    if !errorlevel! equ 0 set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
)
if not defined PYTHON_EXE (
    where python >nul 2>&1
    if !errorlevel! equ 0 set "PYTHON_EXE=python"
)
if not defined PYTHON_EXE (
    where py >nul 2>&1
    if !errorlevel! equ 0 set "PYTHON_EXE=py -3"
)
if not defined PYTHON_EXE (
    for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*" "C:\Program Files\Python3*" "C:\Program Files (x86)\Python3*" "C:\Python3*") do (
        if exist "%%~D\python.exe" (
            set "PYTHON_EXE=%%~D\python.exe"
            goto :START_SERVER
        )
    )
)

:START_SERVER
set "TARGET_URL="

if defined PYTHON_EXE (
    echo [INFO] Starting Neo Metaliks Local NMS Server (0.0.0.0:8000)...
    set "PYTHONW_EXE=%PYTHON_EXE:python.exe=pythonw.exe%"
    if not exist "%PYTHONW_EXE%" set "PYTHONW_EXE=%PYTHON_EXE%"

    start "" "%PYTHONW_EXE%" run_local_nms.py

    echo Waiting for server to initialize...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ready = $false;" ^
        "for ($i=1; $i -le 15; $i++) {" ^
        "    Start-Sleep -Seconds 1;" ^
        "    try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($res.success) { $ready = $true; break } } catch { Write-Host ('.') -NoNewline };" ^
        "};" ^
        "if ($ready) {" ^
        "    Write-Output 'TARGET=http://127.0.0.1:8000';" ^
        "} else {" ^
        "    try { $lan = Invoke-RestMethod -Uri 'http://192.168.115.66:8000/api/health' -TimeoutSec 2; if ($lan.success) { Write-Output 'TARGET=http://192.168.115.66:8000'; exit 0 } } catch {};" ^
        "    Write-Output 'TARGET=https://neo-metaliks-nms.onrender.com';" ^
        "}" > "%TEMP%\nms_start_target.txt"

    for /f "tokens=2 delims==" %%A in ('type "%TEMP%\nms_start_target.txt"') do set "TARGET_URL=%%A"
    if exist "%TEMP%\nms_start_target.txt" del "%TEMP%\nms_start_target.txt"
) else (
    echo [INFO] Python not found on this machine. Connecting via Network/Cloud...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "try { $lan = Invoke-RestMethod -Uri 'http://192.168.115.66:8000/api/health' -TimeoutSec 2; if ($lan.success) { Write-Output 'TARGET=http://192.168.115.66:8000'; exit 0 } } catch {};" ^
        "Write-Output 'TARGET=https://neo-metaliks-nms.onrender.com';" > "%TEMP%\nms_start_target.txt"

    for /f "tokens=2 delims==" %%A in ('type "%TEMP%\nms_start_target.txt"') do set "TARGET_URL=%%A"
    if exist "%TEMP%\nms_start_target.txt" del "%TEMP%\nms_start_target.txt"
)

if not defined TARGET_URL set "TARGET_URL=https://neo-metaliks-nms.onrender.com"

echo.
echo ===============================================================
echo  Active NMS URL   : %TARGET_URL%
echo  Render Cloud URL : https://neo-metaliks-nms.onrender.com
echo ===============================================================
echo.

if defined CHROME_EXE (
    echo [INFO] Opening dashboard directly in Google Chrome...
    start "" "%CHROME_EXE%" "%TARGET_URL%"
) else (
    echo [INFO] Opening dashboard in default web browser...
    start %TARGET_URL%
)

ping 127.0.0.1 -n 3 >nul
exit /b 0
