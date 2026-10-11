@echo off
setlocal
echo ========================================================
echo  NEO METALIKS NMS - PUBLIC / OTHER WI-FI LINK GENERATOR
echo ========================================================
echo.
cd /d "%~dp0"

if not exist ngrok.exe (
    echo [ERROR] ngrok.exe not found!
    pause
    exit /b
)

echo [1] Checking ngrok configuration...
echo.
echo To open this NMS on any other Wi-Fi / mobile network:
echo If this is your first time, make sure you added your free ngrok token:
echo    .\ngrok.exe config add-authtoken YOUR_TOKEN
echo.
echo Starting Public Tunnel on Port 8081...
echo Look for the "Forwarding" link below (e.g., https://xxxx.ngrok-free.app)
echo That URL opens the NMS from any network, any room, or mobile data!
echo ========================================================
echo.
.\ngrok.exe http 8081
pause
