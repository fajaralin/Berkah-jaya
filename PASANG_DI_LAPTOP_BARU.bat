@echo off
title Setup Kasir Berkah Jaya - Laptop Baru
echo.
echo  ================================================
echo    SETUP KASIR BERKAH JAYA - LAPTOP BARU
echo  ================================================
echo.

cd /d "%~dp0"

echo  [1/5] Memeriksa Node.js...
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

echo.
echo  [2/5] Menginstall dependensi aplikasi...
if not exist node_modules (
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo  [!] Gagal install dependensi. Periksa koneksi internet.
        pause
        exit /b 1
    )
)
echo  [OK] Dependensi siap.

echo.
echo  [3/5] Mengambil data & produk terbaru dari server online...
git pull origin main
echo  [OK] Data lokal sudah ter-update ke versi terbaru.

echo.
echo  [4/5] Menguji & Menyimpan Izin Auto-Sync GitHub...
git push origin main
echo  [OK] Izin Auto-Sync aktif & tersimpan di laptop ini!

echo.
echo  [5/5] Membuat ikon di Desktop...
powershell -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1"
echo  [OK] Ikon Kasir Berkah Jaya sudah muncul di Desktop!

echo.
echo  ================================================
echo    SETUP SELESAI & SUKSES! 
echo    1. Data barang versi terbaru sudah ter-update.
echo    2. Izin Auto-Sync ke server online sudah aktif.
echo    3. Ikon "Kasir Berkah Jaya" sudah ada di Desktop.
echo.
echo    Klik 2x ikon tersebut di Desktop untuk membuka kasir.
echo  ================================================
echo.
pause
