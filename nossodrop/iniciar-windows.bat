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

rem teste com concegue ler ?
rem RESPOSTA: consigo ler sim! :) - voce escreveu aqui, eu li aqui. Apague estas 2 linhas quando quiser.

rem nao tem forma mais facil de criar isso e se usar um chat boot nosso ? e usar aqui dentro no lugar do bat?
rem RESPOSTA: tem sim! Criei o arquivo CONVERSA.md aqui no projeto - e nosso caderno/chat.
rem Voce escreve la, eu leio e respondo la. O .bat volta a ser so o script de iniciar, limpinho.
