@echo off
title Gmind Launcher
echo Starting Gmind...
echo.
echo Opening backend (port 1010) and frontend (port 5173)...
echo Close the windows or press Ctrl+C to stop.
echo.

start "Gmind Backend" cmd /k "cd /d "%~dp0backend" && echo Backend starting on :1010... && go run ./cmd/server"
start "Gmind Frontend" cmd /k "cd /d "%~dp0frontend" && echo Frontend starting on :5173... && npm run dev"

echo.
echo Both servers starting in separate windows.
echo Backend: http://localhost:1010
echo Frontend: http://localhost:5173
echo.
pause
