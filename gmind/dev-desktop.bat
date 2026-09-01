@echo off
title Gmind Desktop Dev
rem Windows dirs are missing from this machine's PATH, so ping/curl/taskkill
rem resolve to nothing. Put them back for this process only.
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\Wbem;%PATH%"

echo [0/2] Killing old processes...
taskkill /F /IM "gmind-server-x86_64-pc-windows-msvc.exe" /T >nul 2>&1
taskkill /F /IM "gmind.exe" /T >nul 2>&1

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
