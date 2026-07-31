@echo off
title Setup Kasir Berkah Jaya - Laptop Baru
echo.
echo  ================================================
echo    SETUP KASIR BERKAH JAYA - LAPTOP BARU
echo  ================================================
echo.

cd /d "%~dp0"

echo  [1/3] Memeriksa Node.js...
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo  [!] Node.js belum terinstall di laptop ini!
    echo      Silakan download dan install Node.js terlebih dahulu:
    echo      https://nodejs.org
    echo.
    echo      Setelah install Node.js, jalankan file ini lagi.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)
echo  [OK] Node.js sudah terinstall.

echo  [2/3] Menginstall dependensi aplikasi...
if not exist node_modules (
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo  [!] Gagal install dependensi. Periksa koneksi internet.
        pause
        exit /b 1
    )
)
echo  [OK] Dependensi siap.

echo  [3/3] Membuat ikon di Desktop...
powershell -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"
echo  [OK] Ikon Kasir Berkah Jaya sudah muncul di Desktop!

echo.
echo  ================================================
echo    SETUP SELESAI! 
echo    Ikon "Kasir Berkah Jaya" sudah ada di Desktop.
echo    Klik 2x ikon tersebut untuk membuka kasir.
echo  ================================================
echo.
pause
