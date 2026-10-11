@echo off
title NEO METALIKS NMS - CLOUDFLARE LIVE TUNNEL
color 0b
echo =======================================================
echo     NEO METALIKS NMS - GLOBAL LIVE LINK GENERATOR
echo =======================================================
echo.
echo Connecting port 8081 to Cloudflare Global Edge...
echo Please wait a few seconds...
echo.

cd /d "%~dp0"
if not exist "cloudflared.exe" (
    echo [ERROR] cloudflared.exe not found!
    pause
    exit /b
)

echo Starting Cloudflare Tunnel...
echo Look for the https://xxxx.trycloudflare.com URL below:
echo =======================================================
echo.

cloudflared.exe tunnel --url http://127.0.0.1:8081
pause
