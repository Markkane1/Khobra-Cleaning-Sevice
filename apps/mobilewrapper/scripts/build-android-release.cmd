@echo off
title Khobra Android Release Build
cd /d "%~dp0.."
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-android-release.ps1"
echo.
if errorlevel 1 echo Build failed. Review the error above.
pause
