@echo off
setlocal
set PYTHONIOENCODING=utf-8
echo ==============================================
echo NEO METALIKS NMS - STARTUP SCRIPT
echo ==============================================
echo.

:: 1. Find LAN IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do set LAN_IP=%%a
set LAN_IP=%LAN_IP: =%

:: 2. Check and start MySQL on Port 3307
echo [1/3] Starting Database Server...
netstat -ano | findstr ":3307 " >nul
if %errorlevel% equ 0 (
    echo Database is already running on port 3307.
) else (
    start "NML MySQL" /MIN cmd /c "C:\xampp\mysql\bin\mysqld.exe --defaults-file=C:\xampp\mysql\bin\my.ini --standalone"
    echo Database started.
    ping 127.0.0.1 -n 4 >nul
)

:: 3. Stop old Python servers on ports 8000 and 8081
echo.
echo [2/3] Cleaning up old server instances...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8081 "') do taskkill /f /pid %%a >nul 2>&1

:: 4. Start FastAPI Backend
echo.
echo [3/3] Starting Application Servers...
cd /d "%~dp0backend"
start "NML Backend API" cmd /c ".\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > backend_log.txt 2>&1"
ping 127.0.0.1 -n 4 >nul

:: 5. Start Frontend (Unified Gateway & Proxy)
cd /d "%~dp0Neo_Metaliks_NMS_Desktop_FIXED\Neo_Metaliks_NMS_CCTV_Device_Ready"
start "NML Frontend" cmd /c "python proxy_server.py > frontend_log.txt 2>&1"

echo.
echo ==============================================
echo STARTUP COMPLETE
echo ==============================================
echo.
echo [LOCAL ACCESS]
echo Frontend : http://127.0.0.1:8081
echo API Base : http://127.0.0.1:8000
echo.
echo [LAN / OTHER LAPTOPS ACCESS]
echo Frontend : http://%LAN_IP%:8081
echo API Base : http://%LAN_IP%:8000
echo ==============================================
echo.
echo Press any key to close this window. The servers will continue running in the background.
pause >nul
