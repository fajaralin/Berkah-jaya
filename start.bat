@echo off
title Server Toko Berkah Jaya
echo ========================================================
echo   MENJALANKAN SERVER TOKO & DASHBOARD BERKAH JAYA
echo ========================================================
echo.
cd /d "%~dp0"
echo Memeriksa dependensi...
if not exist node_modules (
    echo Installing node modules...
    call npm install
)

echo Membuka browser...
start http://localhost:3000/dashboard.html

echo Menjalankan server lokal di http://localhost:3000 ...
call npm start
pause
