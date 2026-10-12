@echo off
title NEO METALIKS NMS - LIVE CLOUDFLARE LAUNCHER
color 0a

cd /d "%~dp0"

echo =======================================================
echo     NEO METALIKS NMS - GLOBAL LIVE LINK GENERATOR
echo =======================================================
echo.
echo Starting Smart Live Launcher...
echo.

python live_tunnel.py
if %errorlevel% neq 0 (
    echo.
    echo Python failed or was not found in PATH.
    echo Trying to start cloudflared directly...
    cloudflared.exe tunnel --url http://127.0.0.1:8081
)

pause
