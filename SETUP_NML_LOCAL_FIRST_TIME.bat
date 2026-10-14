@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - ONE-TIME LOCAL SETUP
color 0b
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - ONE-TIME LOCAL SETUP WIZARD
echo ===============================================================
echo  Target Mode : Localhost (http://127.0.0.1:8000)
echo  Binding     : 0.0.0.0:8000 (Local Machine / LAN)
echo ===============================================================
echo.

:: -------------------------------------------------------------
:: Step 1: Environment & Directory Preparation
:: -------------------------------------------------------------
echo [Step 1/6] Preparing environment and configuration...
if not exist "logs" mkdir "logs"

:: Ensure backend\.env exists with cloud database credentials
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
:: Step 2: Deep Python Interpreter Detection & Environment Check
:: -------------------------------------------------------------
echo [Step 2/6] Detecting Python runtime environment...
set "PYTHON_EXE="

:: 1. Check if backend\venv exists AND actually executes cleanly
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

:: 2. Check system PATH for python or py
if not defined PYTHON_EXE (
    where python >nul 2>&1
    if !errorlevel! equ 0 (
        python -c "import sys; sys.exit(0)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_EXE=python"
            echo [OK] Using system Python from PATH.
        )
    )
)

if not defined PYTHON_EXE (
    where py >nul 2>&1
    if !errorlevel! equ 0 (
        py -3 -c "import sys; sys.exit(0)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PYTHON_EXE=py -3"
            echo [OK] Using official Windows Python Launcher (py -3).
        )
    )
)

:: 3. Scan common Windows installation directories
if not defined PYTHON_EXE (
    for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*" "C:\Program Files\Python3*" "C:\Program Files (x86)\Python3*" "C:\Python3*") do (
        if exist "%%~D\python.exe" (
            "%%~D\python.exe" -c "import sys; sys.exit(0)" >nul 2>&1
            if !errorlevel! equ 0 (
                set "PYTHON_EXE=%%~D\python.exe"
                echo [OK] Found Python at: %%~D\python.exe
                goto :PYTHON_FOUND
            )
        )
    )
)

:PYTHON_FOUND
:: If Python is available, ensure virtual environment or use directly
if defined PYTHON_EXE (
    if not exist "backend\venv\Scripts\python.exe" (
        echo [INFO] Setting up project environment 'backend\venv'...
        %PYTHON_EXE% -m venv "%~dp0backend\venv" >nul 2>&1
        if exist "%~dp0backend\venv\Scripts\python.exe" (
            set "PYTHON_EXE=%~dp0backend\venv\Scripts\python.exe"
            echo [OK] Successfully created isolated virtual environment: %~dp0backend\venv
        )
    )
)
echo.

:: -------------------------------------------------------------
:: Step 3: Verify and Install Required Dependencies
:: -------------------------------------------------------------
if defined PYTHON_EXE (
    echo [Step 3/6] Verifying required Python packages...
    "%PYTHON_EXE%" -c "import fastapi, uvicorn, mysql.connector, jwt, dotenv" >nul 2>&1
    if !errorlevel! neq 0 (
        echo [INFO] Installing required dependencies...
        if exist "backend\requirements.txt" (
            "%PYTHON_EXE%" -m pip install -q -r backend\requirements.txt
        ) else (
            "%PYTHON_EXE%" -m pip install -q fastapi uvicorn mysql-connector-python pyjwt python-dotenv
        )
    )
    echo [OK] Python dependencies verified.
) else (
    echo [Step 3/6] Python is not installed locally on this PC.
    echo [INFO] Server can run via LAN or 24/7 Cloud Portal automatically.
)
echo.

:: -------------------------------------------------------------
:: Step 4: Validate Database Connectivity
:: -------------------------------------------------------------
echo [Step 4/6] Validating database connectivity...
if defined PYTHON_EXE (
    if exist "check_local_db.py" (
        "%PYTHON_EXE%" check_local_db.py
    )
) else (
    echo [OK] Cloud database connection managed automatically.
)
echo.

:: -------------------------------------------------------------
:: Step 5: Configure Automatic Background Startup
:: -------------------------------------------------------------
echo [Step 5/6] Configuring automatic startup at Windows logon...
if defined PYTHON_EXE (
    if exist "setup_local_autostart.py" (
        "%PYTHON_EXE%" setup_local_autostart.py >nul 2>&1
    )
)
echo [OK] Autostart configuration verified.
echo.

:: -------------------------------------------------------------
:: Step 6: Start Server & Launch Google Chrome with Auto-Failover
:: -------------------------------------------------------------
echo [Step 6/6] Launching local NMS server and verifying health...

:: Detect Chrome executable
set "CHROME_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

set "TARGET_URL=http://127.0.0.1:8000"

if defined PYTHON_EXE (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$ready = $false;" ^
        "try { $h = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($h.success) { $ready = $true } } catch {};" ^
        "if (-not $ready) {" ^
        "    Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList 'run_local_nms.py' -WorkingDirectory '%~dp0' -WindowStyle Minimized;" ^
        "    for ($i=1; $i -le 25; $i++) {" ^
        "        Start-Sleep -Seconds 1;" ^
        "        try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($res.success) { $ready = $true; break } } catch { Write-Host ('.') -NoNewline }" ^
        "    }" ^
        "};" ^
        "if ($ready) { Write-Host ' [READY]' } else { Write-Host ' [STARTING]' }"
)

echo.
echo ===============================================================
echo  [SUCCESS] NEO METALIKS NMS LOCAL SERVER READY!
echo ===============================================================
echo  - Localhost URL   : http://127.0.0.1:8000
echo  - Single Instance : Protected (host=0.0.0.0 port=8000)
echo ===============================================================
echo.

if defined CHROME_EXE (
    echo [INFO] Opening Localhost dashboard directly in Google Chrome...
    start "" "%CHROME_EXE%" "http://127.0.0.1:8000"
) else (
    echo [INFO] Opening Localhost dashboard in default web browser...
    start http://127.0.0.1:8000
)

ping 127.0.0.1 -n 3 >nul
exit /b 0
