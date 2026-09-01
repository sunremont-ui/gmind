@echo off
title Gmind Launcher
rem Windows dirs are missing from this machine's PATH, so ping/curl/taskkill
rem resolve to nothing. Put them back for this process only.
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\Wbem;%PATH%"
echo Starting Gmind...
echo.
echo Opening backend (port 1010) and frontend (port 1011)...
echo Close the windows or press Ctrl+C to stop.
echo.

start "Gmind Backend" cmd /k "cd /d "%~dp0backend" && echo Backend starting on :1010... && go run ./cmd/server"
rem --open waits until Vite is really listening and opens the browser on the
rem port it actually took, so no separate "start http://..." is needed.
start "Gmind Frontend" cmd /k "cd /d "%~dp0frontend" && echo Frontend starting on :1011... && npm run dev -- --open"

echo.
echo Both servers starting in separate windows.
echo Backend: http://localhost:1010
echo Frontend: http://localhost:1011
echo.
pause
