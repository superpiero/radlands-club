#!/usr/bin/env sh
# Spustí herní server (Linux/macOS). Vyžaduje Node.js 20+.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
[ -f dist/server.mjs ] || npm run build
npm start
