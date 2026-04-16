@echo off
setlocal enabledelayedexpansion

echo.
echo ======================================
echo  Baker's Raid Monitor - Build Script
echo ======================================
echo.

REM Cambiar al directorio electron
cd /d "%~dp0electron"

echo [1/3] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo ERROR: npm install falló
    exit /b 1
)

echo.
echo [2/3] Compilando aplicación...
call npm run dist
if errorlevel 1 (
    echo ERROR: npm run dist falló
    exit /b 1
)

echo.
echo [3/3] Build completado!
echo.
echo ======================================
echo  RESULTADO:
echo ======================================
echo.
if exist "dist\Bakers Raid Monitor.exe" (
    echo ✓ Archivo ejecutable creado exitosamente:
    echo.
    echo   %CD%\dist\Bakers Raid Monitor.exe
    echo.
    for /F "tokens=*" %%A in ('dir /b "dist\Bakers Raid Monitor.exe"') do (
        for /F "tokens=*" %%B in ('dir /s "dist\Bakers Raid Monitor.exe" ^| findstr /R /C:"[0-9]* archivo"') do (
            echo   Tamaño: %%B
        )
    )
    echo.
    echo Para ejecutar:
    echo   - Doble click en el archivo .exe
    echo   - O desde cmd: "%CD%\dist\Bakers Raid Monitor.exe"
) else (
    echo ✗ Error: Archivo .exe no encontrado en dist\
)
echo.
echo ======================================
echo.

pause
