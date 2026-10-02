@echo off
setlocal

title Tien Lo Tro Thu - Local Server
cd /d "%~dp0"

set "TIENLO_PORT=8765"
set "TIENLO_URL=http://127.0.0.1:%TIENLO_PORT%/index.html"

where node >nul 2>&1
if not errorlevel 1 goto use_node

echo [LOI] Can Node.js de chay server va luu log quest.
echo Cai Node.js, sau do chay lai file nay.
pause
exit /b 1

:use_node
echo Dang mo %TIENLO_URL%
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process '%TIENLO_URL%'"
echo Server dang chay bang Node.js. Nhan Ctrl+C de tat.
node tools\dev-server.cjs %TIENLO_PORT%

:done
if errorlevel 1 (
  echo.
  echo [LOI] Khong khoi dong duoc server. Cong %TIENLO_PORT% co the dang duoc su dung.
  pause
)

endlocal
