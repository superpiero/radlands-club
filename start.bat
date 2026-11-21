@echo off
REM Spusti herni server (Windows). Vyzaduje Node.js 20+ (https://nodejs.org).
cd /d "%~dp0"
if not exist node_modules call npm install
if not exist dist\server.mjs call npm run build
call npm start
pause
