@echo off
chcp 65001 >nul
title NossoDrop
cd /d "%~dp0"
echo.
echo  ===== NossoDrop =====
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  [X] Node.js nao encontrado. Instale em https://nodejs.org e rode de novo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo  Instalando (so na primeira vez)...
  call npm install
)
echo  Abrindo o NossoDrop...
start "" http://localhost:3000
call npm start
pause

teste com concegue ler ?
