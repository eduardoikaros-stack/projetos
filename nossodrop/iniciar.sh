#!/usr/bin/env bash
# NossoDrop — iniciar com 1 comando (Linux/Mac):  ./iniciar.sh
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Node.js não encontrado. Instale em https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install
echo "Abrindo http://localhost:3000 ..."
(command -v xdg-open >/dev/null && xdg-open http://localhost:3000 || open http://localhost:3000) >/dev/null 2>&1 &
npm start
