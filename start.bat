@echo off
title Spotify Tablet Stream Deck
cls
echo ===============================================================
echo     SPOTIFY TABLET STREAM DECK LAUNCHER
echo ===============================================================
echo.

set PYTHON_CMD=
if exist "C:\Users\Reyansh\AppData\Local\Python\pythoncore-3.14-64\python.exe" (
    set "PYTHON_CMD=C:\Users\Reyansh\AppData\Local\Python\pythoncore-3.14-64\python.exe"
) else (
    where py >nul 2>nul
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py
    ) else (
        where python >nul 2>nul
        if %errorlevel% equ 0 (
            set PYTHON_CMD=python
        )
    )
)

if "%PYTHON_CMD%"=="" (
    echo [ERROR] Python not found. Please install Python 3.10+ from python.org.
    pause
    exit /b 1
)

echo [OK] Using Python: %PYTHON_CMD%
echo.
echo ---------------------------------------------------------------
echo   * On this PC, open:     http://localhost:5000
echo   * On your Tablet, open: http://192.168.31.197:5000
echo ---------------------------------------------------------------
echo.
echo Starting server... Press Ctrl+C anytime to stop.
echo.

start "" "http://localhost:5000"
"%PYTHON_CMD%" "%~dp0server.py"

pause
