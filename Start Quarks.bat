@echo off
cd /d "%~dp0"
start /b cmd /c "timeout /t 4 /nobreak >nul & start "" http://localhost:5000"
npm run dev
pause
