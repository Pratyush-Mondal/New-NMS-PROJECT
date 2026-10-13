@echo off
setlocal enabledelayedexpansion
title NEO METALIKS NMS - STOP LOCAL SERVER
color 0c
cd /d "%~dp0"

echo ===============================================================
echo     NEO METALIKS NMS - STOP LOCAL SERVER
echo ===============================================================
echo.

echo [INFO] Finding and terminating local NMS server process on port 8000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$stopped = $false; try { $conns = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue; if ($conns) { foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Output ('[OK] Terminated server PID: ' + $c.OwningProcess); $stopped = $true } } } catch {}; $procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*run_local_nms.py*' }; foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; Write-Output ('[OK] Terminated launcher PID: ' + $p.ProcessId); $stopped = $true }; if (-not $stopped) { Write-Output '[INFO] No running NMS server process found on port 8000.' }"

echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000 -WarningAction SilentlyContinue; if (-not $c.TcpTestSucceeded) { Write-Output '[SUCCESS] Local NMS server has been completely stopped.' } else { Write-Output '[WARNING] Port 8000 is still responding. Another application may be using this port.' }"

echo.
echo ===============================================================
echo Local server stopped. To restart, run: START_NML_LOCAL.bat
echo ===============================================================
echo.
ping 127.0.0.1 -n 3 >nul
exit /b 0
