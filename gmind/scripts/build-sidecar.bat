@echo off
REM Build Go backend and copy to Tauri sidecar location
REM Run this before `cargo tauri dev` or `cargo tauri build`

set TARGET=x86_64-pc-windows-msvc
set BIN_DIR=%~dp0..\frontend\src-tauri\binaries

if not exist "%BIN_DIR%" mkdir "%BIN_DIR%"

echo Building gmind-server.exe...
cd /d "%~dp0..\backend"
CGO_ENABLED=0 go build -o "%BIN_DIR%\gmind-server-%TARGET%.exe" ./cmd/server

echo Done: %BIN_DIR%\gmind-server-%TARGET%.exe
