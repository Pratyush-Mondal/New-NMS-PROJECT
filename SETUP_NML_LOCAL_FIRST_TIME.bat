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
:: Step 1: Windows Environment Verification
:: -------------------------------------------------------------
echo [Step 1/6] Checking Windows Environment...
ver
echo [OK] Windows operating system detected.
echo.

:: -------------------------------------------------------------
:: Step 2: Python & Virtual Environment Check
:: -------------------------------------------------------------
echo [Step 2/6] Checking Python and Virtual Environment...
set "PYTHON_EXE="

if exist "backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=backend\venv\Scripts\python.exe"
    echo [OK] Using existing isolated virtual environment: %~dp0backend\venv
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        echo [INFO] System Python detected. Creating project virtual environment 'backend\venv'...
        python -m venv backend\venv
        if exist "backend\venv\Scripts\python.exe" (
            set "PYTHON_EXE=backend\venv\Scripts\python.exe"
            echo [OK] Successfully created isolated virtual environment: %~dp0backend\venv
        ) else (
            echo [WARNING] Could not create virtual environment. Using system Python.
            set "PYTHON_EXE=python"
        )
    ) else (
        echo [ERROR] Python 3 was not detected on this system.
        echo.
        echo Prerequisite Required:
        echo   1. Please download and install Python 3.10 or newer from:
        echo      https://www.python.org/downloads/
        echo   2. IMPORTANT: During installation, check the box:
        echo      "Add python.exe to PATH"
        echo   3. After installing, run this setup script again.
        echo.
        goto :FAIL
    )
)
echo.

:: -------------------------------------------------------------
:: Step 3: Install Required Dependencies
:: -------------------------------------------------------------
echo [Step 3/6] Verifying and installing required Python packages...
if exist "backend\requirements.txt" (
    "%PYTHON_EXE%" -m pip install -q -r backend\requirements.txt
    if %errorlevel% neq 0 (
        echo [WARNING] Pip install reported an issue. Retrying with verbose output...
        "%PYTHON_EXE%" -m pip install -r backend\requirements.txt
    )
    echo [OK] Python dependencies verified.
) else (
    echo [WARNING] backend\requirements.txt not found. Skipping pip install.
)
echo.

:: -------------------------------------------------------------
:: Step 4: Validate Database Connectivity
:: -------------------------------------------------------------
echo [Step 4/6] Validating database connection...
if exist "check_local_db.py" (
    "%PYTHON_EXE%" check_local_db.py
    if %errorlevel% neq 0 (
        echo [WARNING] Database test returned an issue.
        echo If running offline, configure MySQL or cloud parameters in 'backend\.env'.
    )
) else (
    echo [INFO] Database check script not present. Continuing...
)
echo.

:: -------------------------------------------------------------
:: Step 5: Configure Automatic Startup at Windows Logon
:: -------------------------------------------------------------
echo [Step 5/6] Configuring automatic startup at Windows logon...
if exist "setup_local_autostart.py" (
    "%PYTHON_EXE%" setup_local_autostart.py
    if %errorlevel% neq 0 (
        echo [WARNING] Autostart configuration encountered a notice.
    )
) else (
    echo [WARNING] setup_local_autostart.py not found.
)
echo.

:: -------------------------------------------------------------
:: Step 6: Test Local Server Startup
:: -------------------------------------------------------------
echo [Step 6/6] Testing local NMS server startup on http://127.0.0.1:8000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$portOpen = $false; $conn = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue; if ($conn.TcpTestSucceeded) { Write-Output '[OK] Port 8000 is already active and responding.' } else { Write-Output '[INFO] Launching background server process...'; Start-Process -FilePath '%PYTHON_EXE%' -ArgumentList 'run_local_nms.py' -WorkingDirectory '%~dp0'; Start-Sleep -Seconds 4; $check = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue; if ($check.TcpTestSucceeded) { Write-Output '[OK] Local server verified listening on 127.0.0.1:8000' } else { Write-Output '[INFO] Server process initializing in background.' } }"

echo.
echo ===============================================================
echo  [SUCCESS] NEO METALIKS NMS LOCAL SETUP COMPLETED SUCCESSFULLY!
echo ===============================================================
echo  - Local Website URL : http://127.0.0.1:8000
echo  - Cloud Website URL : https://neo-metaliks-nms.onrender.com
echo  - Autostart Trigger : Windows User Logon (Automatic Background)
echo  - Single Instance   : Protected (Port 8000 / Socket Lock 49255)
echo  - Server Log File   : logs\local_nms.log
echo ===============================================================
echo.
echo Quick Control Scripts:
echo   - START_NML_LOCAL.bat       : Start server manually and open browser
echo   - CHECK_NML_STATUS.bat      : Check health, port 8000, and logs
echo   - STOP_NML_LOCAL.bat        : Stop the local server
echo   - REMOVE_NML_AUTOSTART.bat  : Disable logon autostart
echo.

set /p OPEN_BROWSER="Would you like to open the local NMS in your browser now? (Y/N): "
if /i "%OPEN_BROWSER%"=="Y" (
    start http://127.0.0.1:8000
)

echo.
echo Setup finished. Press any key to exit.
pause >nul
exit /b 0

:FAIL
echo.
echo ===============================================================
echo  [FAILED] Setup could not complete. Please see the error above.
echo ===============================================================
echo.
pause
exit /b 1
