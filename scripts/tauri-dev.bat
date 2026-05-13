@echo off
cd /d "%~dp0..\gmind\frontend"
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
set MSYSTEM=
echo Starting Tauri dev mode...
npm run tauri:dev
