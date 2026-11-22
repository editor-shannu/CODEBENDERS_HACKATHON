#!/usr/bin/env bash
# Baaki - one-command local setup (macOS / Linux): ./setup.sh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null; then echo "[baaki] Install Node.js 20+ from https://nodejs.org and rerun."; exit 1; fi
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] || { echo "[baaki] Node 20+ required."; exit 1; }
USE_DOCKER=""
if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  USE_DOCKER="--docker"
  docker start baaki-db >/dev/null 2>&1 || docker run -d --name baaki-db -e POSTGRES_USER=baaki -e POSTGRES_PASSWORD=baaki -e POSTGRES_DB=baaki -p 5432:5432 postgres:16 >/dev/null
  sleep 5
fi
npm ci || npm install
node scripts/setup-env.mjs $USE_DOCKER
npx prisma db push
echo "[baaki] Open http://localhost:3000/api/demo for the demo (no sign-in)."
( sleep 12; (command -v open >/dev/null && open http://localhost:3000/api/demo) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000/api/demo) || true ) &
npm run dev
