@echo off
cd /d "%~dp0"
echo Pokemon kart verileri indiriliyor. Bu islem birkac dakika surebilir...
set tries=0
:again
set /a tries+=1
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0veri-cek.ps1"
if errorlevel 1 (
  if %tries% lss 5 (
    echo Sunucu hatasi - kaldigi yerden devam ediliyor... [%tries%/5]
    timeout /t 10 >nul
    goto again
  )
  echo Indirme tamamlanamadi. Biraz sonra tekrar deneyin; indirilen kisimlar korunur.
)
pause
