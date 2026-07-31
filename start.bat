@echo off
title Server Toko Berkah Jaya
echo ========================================================
echo   MENJALANKAN SERVER TOKO DAN DASHBOARD BERKAH JAYA
echo ========================================================
echo.
cd /d "%~dp0"

if not exist node_modules (
    echo Memeriksa dependensi... Installing node modules...
    call npm install
)

echo Membuka browser Dashboard...
start http://localhost:3000/dashboard.html

netstat -o -n -a | findstr ":3000 " >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo   [OK] Server lokal sudah aktif berjalan di port 3000!
    echo   Dashboard otomatis terbuka di browser.
    echo ========================================================
    echo.
    pause
    exit /b 0
)

echo Menjalankan server lokal di http://localhost:3000 ...
call npm start
pause
