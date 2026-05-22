@echo off
title Gmind Release Build
echo ============================================
echo  Gmind Release Builder
echo ============================================
echo.

echo [1/3] Building Go sidecar (optimized)...
cd /d "%~dp0backend"
set CGO_ENABLED=0
go build -ldflags="-s -w" -o "..\frontend\src-tauri\binaries\gmind-server-x86_64-pc-windows-msvc.exe" ./cmd/server
if errorlevel 1 (
    echo.
    echo ERROR: Go build failed.
    pause
    exit /b 1
)
echo Done.
echo.

echo [2/3] Installing npm dependencies...
cd /d "%~dp0frontend"
call npm install
if errorlevel 1 (
    echo.
    echo ERROR: npm install failed.
    pause
    exit /b 1
)
echo Done.
echo.

echo [3/3] Building Tauri app (this takes ~3-5 min)...
call npx tauri build
if errorlevel 1 (
    echo.
    echo ERROR: Tauri build failed.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  BUILD COMPLETE
echo ============================================
echo.
echo Installer:
echo   frontend\src-tauri\target\release\bundle\nsis\
echo.
echo Executable (portable):
echo   frontend\src-tauri\target\release\gmind.exe
echo.
pause
