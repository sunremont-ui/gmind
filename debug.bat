@echo off
cd /d "%~dp0"
echo Building debug binary (if needed)...
cd gmind\frontend\src-tauri
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
set MSYSTEM=
cargo build 2>&1
echo.
echo ========================================
echo  Starting Gmind (debug mode)
echo  Error messages will appear below
echo  Press Ctrl+C to close
echo ========================================
echo.
target\debug\gmind.exe
echo.
echo App closed with code: %errorlevel%
pause
