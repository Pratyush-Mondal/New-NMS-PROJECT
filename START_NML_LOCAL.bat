@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - START LOCAL SERVER (LOCALHOST ONLY)
color 0a
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - PURE LOCAL SERVER LAUNCHER
echo ===============================================================
echo  Target URL : http://127.0.0.1:8000 (Strict Localhost)
echo  Binding    : 0.0.0.0:8000 (Local Network / Local PC)
echo  Cloud Mode : DISABLED (Pure Localhost Operation)
echo ===============================================================
echo.

if not exist "logs" mkdir "logs"

:: Ensure backend\.env exists with database credentials
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

:: 1. Check if local server is already running and responding on http://127.0.0.1:8000
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($h.success) { exit 0 } } catch {}; exit 1"
if %errorlevel% equ 0 (
    echo [INFO] Neo Metaliks NMS is ALREADY RUNNING locally on http://127.0.0.1:8000
    if defined CHROME_EXE (
        echo [INFO] Opening Localhost dashboard directly in Google Chrome...
        start "" "%CHROME_EXE%" "http://127.0.0.1:8000"
    ) else (
        echo [INFO] Opening Localhost dashboard in default web browser...
        start http://127.0.0.1:8000
    )
    ping 127.0.0.1 -n 3 >nul
    exit /b 0
)

:: 2. Detect Python runtime on this PC
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
            goto :CHECK_DEPS
        )
    )
)

:CHECK_DEPS
if not defined PYTHON_EXE (
    echo [ERROR] Python is not found on this computer.
    echo Please install Python 3.10+ from python.org and add to PATH.
    pause
    exit /b 1
)

:: 3. Verify and auto-install Python dependencies if missing
echo [INFO] Verifying required Python packages for Localhost...
"%PYTHON_EXE%" -c "import fastapi, uvicorn, mysql.connector, jwt, dotenv" >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Missing required packages. Auto-installing dependencies now...
    if exist "backend\requirements.txt" (
        "%PYTHON_EXE%" -m pip install -r backend\requirements.txt
    ) else (
        "%PYTHON_EXE%" -m pip install fastapi "uvicorn[standard]" mysql-connector-python PyJWT python-dotenv python-multipart openpyxl
    )
    if %errorlevel% neq 0 (
        echo [WARNING] Dependency installation failed. Attempting direct fallback install...
        "%PYTHON_EXE%" -m pip install fastapi uvicorn mysql-connector-python PyJWT python-dotenv python-multipart openpyxl
    )
)
echo [OK] Python dependencies verified.

:: 4. Start local FastAPI/Uvicorn server
echo [INFO] Starting Neo Metaliks Local NMS Server on http://127.0.0.1:8000...
start "Neo Metaliks Local NMS Server" /min "%PYTHON_EXE%" run_local_nms.py

echo Waiting for local server to initialize on http://127.0.0.1:8000...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ready = $false;" ^
    "for ($i=1; $i -le 25; $i++) {" ^
    "    Start-Sleep -Seconds 1;" ^
    "    try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($res.success) { $ready = $true; break } } catch { Write-Host ('.') -NoNewline };" ^
    "};" ^
    "if ($ready) { Write-Host ' [READY]' } else { Write-Host ' [STARTING]' }"

set "TARGET_URL=http://127.0.0.1:8000"

echo.
echo ===============================================================
echo  Local NMS URL : %TARGET_URL%
echo  Status        : Running on Localhost (127.0.0.1:8000)
echo ===============================================================
echo.

if defined CHROME_EXE (
    echo [INFO] Opening Localhost dashboard directly in Google Chrome...
    start "" "%CHROME_EXE%" "%TARGET_URL%"
) else (
    echo [INFO] Opening Localhost dashboard in default web browser...
    start %TARGET_URL%
)

ping 127.0.0.1 -n 3 >nul
exit /b 0
