@echo off
setlocal

title Tien Lo Tro Thu - Local Server
cd /d "%~dp0"

set "TIENLO_PORT=8765"
set "TIENLO_URL=http://127.0.0.1:%TIENLO_PORT%/index.html"

where py >nul 2>&1
if not errorlevel 1 goto use_py

where python >nul 2>&1
if not errorlevel 1 goto use_python

echo [LOI] Khong tim thay Python trong PATH.
echo Cai Python 3, sau do chay lai file nay.
pause
exit /b 1

:use_py
echo Dang mo %TIENLO_URL%
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process '%TIENLO_URL%'"
echo Server dang chay. Nhan Ctrl+C de tat.
py -3 -m http.server %TIENLO_PORT% --bind 127.0.0.1
goto done

:use_python
echo Dang mo %TIENLO_URL%
start "" powershell.exe -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 900; Start-Process '%TIENLO_URL%'"
echo Server dang chay. Nhan Ctrl+C de tat.
python -m http.server %TIENLO_PORT% --bind 127.0.0.1

:done
if errorlevel 1 (
  echo.
  echo [LOI] Khong khoi dong duoc server. Cong %TIENLO_PORT% co the dang duoc su dung.
  pause
)

endlocal
