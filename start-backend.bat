@echo off
chcp 65001 >nul
title MarkItDown Backend
cd /d "%~dp0backend"

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python tidak ditemukan di PATH.
  echo Install Python 3.10+ dulu dari https://www.python.org/downloads/
  pause
  exit /b 1
)

echo ============================================================
echo  MarkItDown Backend
echo  URL    : http://localhost:8000
echo  Health : http://localhost:8000/api/health
echo.
echo  JANGAN tutup jendela ini selama website masih dipakai.
echo  Tutup jendela / tekan Ctrl+C = server mati.
echo ============================================================
echo.

python -m uvicorn main:app --host 127.0.0.1 --port 8000

echo.
echo Server berhenti.
pause
