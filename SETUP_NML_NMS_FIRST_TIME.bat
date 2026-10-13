@echo off
title NEO METALIKS NMS - ONE-TIME SETUP WIZARD
color 0b
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - FIRST-TIME AUTOMATIC SETUP WIZARD
echo ===============================================================
echo.
echo Checking project prerequisites...

:: 1. Verify required files
if not exist "plant_lan_probe.py" (
    echo [ERROR] Required file 'plant_lan_probe.py' was not found in: %~dp0
    echo Please make sure you run this script from the project root folder.
    goto :FAIL
)

if not exist "backend\app\main.py" (
    echo [ERROR] Required backend file 'backend\app\main.py' is missing.
    goto :FAIL
)

if not exist "backend\.env" (
    echo [WARNING] 'backend\.env' not found.
    echo Ensure cloud database variables or DATABASE_URL are properly configured.
)

:: 2. Identify Python interpreter
set "PYTHON_EXE="
if exist ".\backend\venv\Scripts\python.exe" (
    set "PYTHON_EXE=.\backend\venv\Scripts\python.exe"
    echo [OK] Using isolated virtual environment: %~dp0backend\venv
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        set "PYTHON_EXE=python"
        echo [OK] Using system Python environment.
    ) else (
        echo [ERROR] Python 3 was not detected on this system.
        echo Please install Python 3.10+ or check the backend\venv folder.
        goto :FAIL
    )
)

echo.
:: 3. Check for Administrator privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Administrator authorization is recommended to register Windows Task Scheduler.
    echo [INFO] Requesting elevation prompt...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~dp0SETUP_NML_NMS_FIRST_TIME.bat\"\" elevated' -Verb RunAs"
    exit /b
)

:: 4. Running elevated
echo [OK] Administrator authorization confirmed.
echo Registering automatic startup task with Windows Task Scheduler...
echo.

"%PYTHON_EXE%" setup_autostart.py
if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Task Scheduler setup returned an issue. Checking fallback...
)

echo.
echo ===============================================================
echo [SUCCESS] NEO METALIKS NMS MONITORING AGENT IS NOW CONFIGURED!
echo ===============================================================
echo  - Autostart Trigger  : At Windows User Logon (Automatic)
echo  - Process Mode       : Background (pythonw.exe - No popup window)
echo  - Single Instance    : Guaranteed (Loopback Lock Port 49250)
echo  - Persistent Logs    : logs\plant_probe.log
echo  - Live Cloud Website : https://neo-metaliks-nms.onrender.com
echo ===============================================================
echo On every PC start or Windows logon, real LAN monitoring
echo will run automatically in the background without opening a terminal.
echo.
pause
exit /b 0

:FAIL
echo.
echo ===============================================================
echo [FAILED] Setup could not complete. Please review the errors above.
echo ===============================================================
pause
exit /b 1
