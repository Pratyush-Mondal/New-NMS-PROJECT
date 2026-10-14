@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - ONE-CLICK LOCAL PORTAL
color 0b
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - ONE-CLICK LOCAL PORTAL
echo ===============================================================
echo  Target URL : http://127.0.0.1:8000 (Localhost Only)
echo ===============================================================
echo.

:: Detect Chrome
set "CHROME_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

:: Check if localhost is responding
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $res = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($res.success) { exit 0 } } catch {}; exit 1"
if %errorlevel% neq 0 (
    echo [INFO] Local server is not currently running. Starting it now...
    call START_NML_LOCAL.bat
    exit /b 0
)

echo [SUCCESS] Connecting to NMS Localhost Portal at: http://127.0.0.1:8000
echo.

if defined CHROME_EXE (
    echo Opening dashboard directly in Google Chrome...
    start "" "%CHROME_EXE%" "http://127.0.0.1:8000"
) else (
    echo Opening dashboard in default web browser...
    start http://127.0.0.1:8000
)

ping 127.0.0.1 -n 3 >nul
exit /b 0
