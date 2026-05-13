@echo off
cd /d "%~dp0"
echo ========================================
echo  Gmind - Quick Start
echo ========================================
echo.
echo [1] Web (http://localhost:5173)
echo [2] Tauri Desktop
echo [3] Backend only
echo.
set /p gmind_choice="Select (1/2/3): "
if "%gmind_choice%"=="3" goto backend
if "%gmind_choice%"=="2" goto tauri
if "%gmind_choice%"=="1" goto web
echo Invalid choice, defaulting to Web...
goto web

:web
echo.
echo Starting backend...
start "Gmind Backend" /min cmd /c "cd /d gmind\backend && go run .\cmd\server"
echo Waiting for backend on :8080...
ping -n 5 127.0.0.1 >nul
echo Starting frontend...
cd gmind\frontend
start http://localhost:5173
npm run dev
goto end

:tauri
echo.
echo Starting backend...
start "Gmind Backend" /min cmd /c "cd /d gmind\backend && go run .\cmd\server"
echo Waiting for backend on :8080...
ping -n 5 127.0.0.1 >nul
echo Starting Tauri...
cd gmind\frontend
npm run tauri:dev
goto end

:backend
echo.
cd gmind\backend
go run .\cmd\server
goto end

:end
echo.
pause
