@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - ONE-CLICK PORTAL
color 0b
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - ONE-CLICK PORTAL LAUNCHER
echo ===============================================================
echo  Automatically connecting to the best available pathway...
echo ===============================================================
echo.

:: Detect Chrome
set "CHROME_EXE="
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

set "TARGET_URL="

echo Checking connection pathways...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$endpoints = @('http://127.0.0.1:8000', 'http://192.168.115.66:8000', 'https://neo-metaliks-nms.onrender.com');" ^
  "foreach ($ep in $endpoints) {" ^
  "  try {" ^
  "    $res = Invoke-RestMethod -Uri ($ep + '/api/health') -TimeoutSec 2;" ^
  "    if ($res.success) {" ^
  "      Write-Output ('TARGET=' + $ep);" ^
  "      exit 0;" ^
  "    }" ^
  "  } catch {}" ^
  "};" ^
  "Write-Output 'TARGET=https://neo-metaliks-nms.onrender.com';" > "%TEMP%\nms_target.txt"

for /f "tokens=2 delims==" %%A in ('type "%TEMP%\nms_target.txt"') do set "TARGET_URL=%%A"
if exist "%TEMP%\nms_target.txt" del "%TEMP%\nms_target.txt"

if not defined TARGET_URL set "TARGET_URL=https://neo-metaliks-nms.onrender.com"

echo [SUCCESS] Connecting to NMS Portal at: %TARGET_URL%
echo.

if defined CHROME_EXE (
    echo Opening dashboard directly in Google Chrome...
    start "" "%CHROME_EXE%" "%TARGET_URL%"
) else (
    echo Opening dashboard in default web browser...
    start %TARGET_URL%
)

ping 127.0.0.1 -n 3 >nul
exit /b 0
