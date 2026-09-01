@echo off
cd /d "%~dp0"
rem Windows dirs are missing from this machine's PATH, so ping/curl/taskkill
rem resolve to nothing. Put them back for this process only.
set "PATH=%SystemRoot%\System32;%SystemRoot%;%SystemRoot%\System32\Wbem;%PATH%"
echo ========================================
echo  Gmind - Quick Start
echo ========================================
echo.
echo [1] Web (http://localhost:1011)
echo [2] Tauri Desktop
echo [3] Backend only (http://localhost:1010)
echo.
set /p gmind_choice="Select (1/2/3): "
if "%gmind_choice%"=="3" goto backend
if "%gmind_choice%"=="2" goto tauri
if "%gmind_choice%"=="1" goto web
echo Invalid choice, defaulting to Web...
goto web

:web
echo.
call :startbackend
if errorlevel 1 goto end
echo Starting frontend on http://localhost:1011 ...
cd gmind\frontend
rem --open opens the browser when Vite is actually listening, and on the port
rem it really picked - a fixed "start http://..." fired into a dead port.
npm run dev -- --open
goto end

:tauri
echo.
call :startbackend
if errorlevel 1 goto end
echo Starting Tauri...
cd gmind\frontend
npm run tauri:dev
goto end

:backend
echo.
echo Backend on http://localhost:1010 - Ctrl+C to stop.
cd gmind\backend
go run .\cmd\server
goto end

:end
echo.
pause
exit /b

rem ---------------------------------------------------------------------------
rem Starts the backend and waits until it actually answers. The old fixed
rem 5-second ping let the frontend come up against a backend that was still
rem compiling, and pointed at the wrong port on top of that.
:startbackend
echo Starting backend...
start "Gmind Backend" /min cmd /c "cd /d "%~dp0gmind\backend" && go run .\cmd\server"
echo Waiting for backend on :1010 ...
set /a gmind_wait=0
:waitloop
curl -s -o nul --max-time 2 http://localhost:1010/health >nul 2>&1
if not errorlevel 1 (
    echo Backend is up.
    exit /b 0
)
set /a gmind_wait+=1
if %gmind_wait% geq 45 (
    echo.
    echo Backend did not answer on :1010. Look at the "Gmind Backend" window:
    echo a first run compiles Go and can take longer, or the port is taken.
    exit /b 1
)
ping -n 2 127.0.0.1 >nul
goto waitloop
