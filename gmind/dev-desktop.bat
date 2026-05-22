@echo off
title Gmind Desktop Dev

echo [1/2] Building Go sidecar...
cd /d "%~dp0backend"
set CGO_ENABLED=0
go build -o "..\frontend\src-tauri\binaries\gmind-server-x86_64-pc-windows-msvc.exe" ./cmd/server
if errorlevel 1 (
    echo.
    echo ERROR: Go build failed. See output above.
    pause
    exit /b 1
)
echo Done.

echo [2/2] Starting Tauri dev...
cd /d "%~dp0frontend"
npx tauri dev
