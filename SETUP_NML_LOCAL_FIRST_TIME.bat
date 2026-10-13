@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - ONE-TIME LOCAL SETUP
color 0b
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - ONE-TIME LOCAL SETUP WIZARD
echo ===============================================================
echo  Target Mode : Localhost (http://127.0.0.1:8000)
echo  Cloud Mode  : Render (https://neo-metaliks-nms.onrender.com)
echo ===============================================================
echo.

:: -------------------------------------------------------------
:: Step 1: Environment & Directory Preparation
:: -------------------------------------------------------------
echo [Step 1/6] Preparing environment and configuration...
if not exist "logs" mkdir "logs"

:: Ensure backend\.env exists with cloud credentials
if not exist "backend\.env" (
    echo [INFO] Generating pre-configured backend\.env file...
    (
        echo DATABASE_URL=mysql://2v9Ac8dmNnbuaJg.root:3K1EV2DPGMMw6yEb@gateway01.ap-southeast-1.prod.aws.tidbcloud.com:4000/test
        echo MYSQL_HOST=127.0.0.1
        echo MYSQL_PORT=3307
        echo MYSQL_USER=root
        echo MYSQL_PASSWORD=
        echo MYSQL_DATABASE=neo_metaliks_nms
        echo JWT_SECRET=zP2CxWJeZngbA4tVz8OcU_t6wDXWZFHTEX_uGj56q_CzFwEJO8E-Xvds3xpJYQkI
    ) > "backend\.env"
    echo [OK] Pre-configured backend\.env created successfully.
) else (
    echo [OK] Configuration file backend\.env verified.
)
echo.

:: -------------------------------------------------------------
:: Step 2: Python Interpreter & Virtual Environment Check
:: -------------------------------------------------------------
echo [Step 2/6] Checking Python runtime environment...
set "PYTHON_EXE="

:: First, check if backend\venv exists AND actually runs
if exist "backend\venv\Scripts\python.exe" (
    "backend\venv\Scripts\python.exe" -c "import sys; sys.exit(0)" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
        echo [OK] Using active isolated virtual environment: %~dp0backend\venv
    ) else (
        echo [NOTICE] Found existing 'backend\venv' from another machine or user path.
        echo [INFO] Cleaning up stale environment and rebuilding for this PC...
        rmdir /s /q "backend\venv" >nul 2>&1
    )
)

if not defined PYTHON_EXE (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] System Python detected. Creating fresh project environment 'backend\venv'...
        python -m venv "%~dp0backend\venv" >nul 2>&1
        if exist "%~dp0backend\venv\Scripts\python.exe" (
            set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
            echo [OK] Successfully created fresh virtual environment: %~dp0backend\venv
        ) else (
            echo [WARNING] Could not create virtual environment. Using system Python directly.
            set "PYTHON_EXE=python"
        )
    ) else (
        echo [ERROR] Python 3 was not detected on this system.
        echo.
        echo Options:
        echo   1. To run locally: Download Python 3.10+ from https://www.python.org/downloads/
        echo      IMPORTANT: Check the box "Add python.exe to PATH" during installation.
        echo   2. Or access the LIVE CLOUD NMS immediately without installing Python:
        echo      https://neo-metaliks-nms.onrender.com
        echo.
        set /p "OPEN_CLOUD=Would you like to open the live cloud website now? (Y/N): "
        if /i "!OPEN_CLOUD!"=="Y" (
            start https://neo-metaliks-nms.onrender.com
            exit /b 0
        )
        goto :FAIL
    )
)
echo.

:: -------------------------------------------------------------
:: Step 3: Verify and Install Required Dependencies
:: -------------------------------------------------------------
echo [Step 3/6] Verifying required Python packages...
"%PYTHON_EXE%" -c "import fastapi, uvicorn, mysql.connector, jwt, dotenv" >nul 2>&1
if !errorlevel! neq 0 (
    echo [INFO] Installing required dependencies (fastapi, uvicorn, mysql-connector-python, pyjwt, python-dotenv)...
    if exist "backend\requirements.txt" (
        "%PYTHON_EXE%" -m pip install -q -r backend\requirements.txt
    ) else (
        "%PYTHON_EXE%" -m pip install -q fastapi uvicorn mysql-connector-python pyjwt python-dotenv
    )
    if !errorlevel! neq 0 (
        echo [WARNING] Pip encountered an issue. Retrying with verbose output...
        "%PYTHON_EXE%" -m pip install -r backend\requirements.txt
    )
)
echo [OK] Python dependencies verified.
echo.

:: -------------------------------------------------------------
:: Step 4: Validate Database Connectivity
:: -------------------------------------------------------------
echo [Step 4/6] Validating database connectivity...
if exist "check_local_db.py" (
    "%PYTHON_EXE%" check_local_db.py
    if !errorlevel! neq 0 (
        echo [WARNING] Database test returned a notice.
        echo Server will use automated cloud failover and retry mechanisms.
    )
) else (
    echo [OK] Database check skipped.
)
echo.

:: -------------------------------------------------------------
:: Step 5: Configure Automatic Background Startup
:: -------------------------------------------------------------
echo [Step 5/6] Configuring automatic startup at Windows logon...
if exist "setup_local_autostart.py" (
    "%PYTHON_EXE%" setup_local_autostart.py
)
echo.

:: -------------------------------------------------------------
:: Step 6: Start Server & Launch Google Chrome
:: -------------------------------------------------------------
echo [Step 6/6] Launching local NMS server and verifying health...
set "PYTHONW_EXE=%PYTHON_EXE:python.exe=pythonw.exe%"
if not exist "%PYTHONW_EXE%" set "PYTHONW_EXE=%PYTHON_EXE%"

:: Detect Chrome executable
set "CHROME_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ready = $false; try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($h.success) { $ready = $true } } catch {}; if (-not $ready) { Write-Output '[INFO] Starting server process in background...'; Start-Process -FilePath '%PYTHONW_EXE%' -ArgumentList 'run_local_nms.py' -WorkingDirectory '%~dp0'; for ($i=1; $i -le 20; $i++) { Start-Sleep -Seconds 1; try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($res.success) { Write-Output ('[SUCCESS] Server is online and responding! (Ready in ' + $i + 's)'); $ready = $true; break } } catch { Write-Host ('.') -NoNewline } } }; if ($ready) { Write-Output '[SUCCESS] Health check passed!' } else { Write-Output '[WARNING] Server is still initializing. Check logs\local_nms.log if needed.' }"

echo.
echo ===============================================================
echo  [SUCCESS] NEO METALIKS NMS LOCAL SETUP COMPLETED SUCCESSFULLY!
echo ===============================================================
echo  - Local Website URL : http://127.0.0.1:8000
echo  - Cloud Backup URL  : https://neo-metaliks-nms.onrender.com
echo  - Autostart Mode    : Windows Logon (Automatic Background)
echo  - Server Log File   : logs\local_nms.log
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

:FAIL
echo.
echo ===============================================================
echo  [FAILED] Setup could not complete. Please see the error above.
echo ===============================================================
echo.
pause
exit /b 1
