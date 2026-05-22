@echo off
taskkill /f /im "gmind-server.exe" 2>nul
taskkill /f /im "go.exe" 2>nul
ping -n 3 127.0.0.1 >nul
cd /d "%~dp0"
CGO_ENABLED=0 go build -o gmind-server.exe .\cmd\server
start /min "" "gmind-server.exe"
echo Backend started on :1010
pause
