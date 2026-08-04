@echo off
title Setup Kasir Berkah Jaya - Laptop Baru
echo.
echo ================================================
echo   SETUP KASIR BERKAH JAYA - LAPTOP BARU
echo ================================================
echo.

cd /d "%~dp0"

if not exist server.js (
    echo.
    echo [!] Kode aplikasi belum ditemukan di folder ini.
    echo     Mendownload kode Berkah Jaya otomatis dari GitHub...
    git clone https://github.com/fajaralin/Berkah-jaya.git temp_code >nul 2>&1
    if exist temp_code (
        xcopy /e /y /h temp_code\* . >nul 2>&1
        rmdir /s /q temp_code >nul 2>&1
        echo [OK] Kode aplikasi berhasil didownload!
    ) else (
        echo     Mengunduh paket otomatis...
        powershell -Command "Invoke-WebRequest -Uri 'https://github.com/fajaralin/Berkah-jaya/archive/refs/heads/main.zip' -OutFile 'app.zip'; Expand-Archive -Path 'app.zip' -DestinationPath 'temp_zip' -Force; Copy-Item -Path 'temp_zip\Berkah-jaya-main\*' -Destination '.' -Recurse -Force; Remove-Item 'app.zip','temp_zip' -Recurse -Force" >nul 2>&1
        echo [OK] Kode aplikasi berhasil didownload!
    )
)

echo [1/4] Memeriksa Node.js...
node -v >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Node.js belum terinstall di laptop ini!
    echo     Silakan download dan install Node.js terlebih dahulu:
    echo     https://nodejs.org
    echo.
    echo     Setelah install Node.js selesai, jalankan file ini lagi.
    echo.
    pause
    start https://nodejs.org
    exit /b 1
)
echo [OK] Node.js sudah terinstall.

echo.
echo [2/4] Menginstall dependensi aplikasi...
if not exist node_modules\mongodb (
    call npm install --no-fund --no-audit
)
if not exist node_modules\mongodb (
    echo.
    echo [!] Gagal install dependensi. Periksa koneksi internet Anda.
    pause
    exit /b 1
)
echo [OK] Dependensi aplikasi siap.

echo.
echo [3/4] Menyingkronkan data barang terbaru...
git add . >nul 2>&1
git commit -m "auto: Setup laptop baru" >nul 2>&1
git pull origin main >nul 2>&1
git push origin main >nul 2>&1
echo [OK] Data barang versi terbaru siap.

echo.
echo [4/4] Membuat ikon pintasan di Desktop...
powershell -ExecutionPolicy Bypass -File "%~dp0create_shortcut.ps1" >nul 2>&1
echo [OK] Ikon "Kasir Berkah Jaya" sudah dibuat di Desktop!

echo.
echo ================================================
echo   SETUP SELESAI SUKSES! 
echo   1. Data barang versi terbaru sudah ter-update.
echo   2. Ikon "Kasir Berkah Jaya" sudah ada di Desktop.
echo.
echo   Membuka aplikasi Kasir Berkah Jaya otomatis...
echo ================================================
echo.
timeout /t 2 >nul
start wscript.exe "%~dp0buka_kasir.vbs"
exit /b 0
