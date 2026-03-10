@echo off
setlocal enabledelayedexpansion
cd /d "C:\Users\novakv23\Desktop\elitni_nebezpeci\src\js"

echo Checking JavaScript syntax for all files...
echo.

set errorCount=0

for %%f in (config.js utils.js input.js ship.js station.js aiship.js universe.js trading.js docking.js hud.js renderer.js main.js) do (
    echo Checking %%f...
    node --check "%%f" >nul 2>&1
    if !errorlevel! neq 0 (
        echo   ERROR: Syntax error found in %%f
        node --check "%%f"
        set /a errorCount=!errorCount!+1
    ) else (
        echo   OK
    )
)

echo.
if !errorCount! equ 0 (
    echo All 12 JavaScript files passed syntax check.
    exit /b 0
) else (
    echo !errorCount! file(s) have syntax errors.
    exit /b 1
)
