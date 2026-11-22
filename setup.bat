@echo off
setlocal
title Baaki - one-click setup
cd /d "%~dp0"
echo ============================================
echo   Baaki - one-click local setup (Windows)
echo ============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [baaki] Node.js not found. Installing Node.js LTS with winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo [baaki] Could not install Node.js automatically. Install Node 20+ from https://nodejs.org and run setup.bat again.
    pause & exit /b 1
  )
  echo [baaki] Node.js installed. Close this window and double-click setup.bat again.
  pause & exit /b 0
)
for /f "tokens=1 delims=." %%v in ('node -p "process.versions.node"') do set NODE_MAJOR=%%v
if %NODE_MAJOR% LSS 20 (
  echo [baaki] Node %NODE_MAJOR% found, but Node 20 or newer is required. Get it from https://nodejs.org
  pause & exit /b 1
)
echo [baaki] Node.js OK

set USE_DOCKER=
where docker >nul 2>nul
if not errorlevel 1 (
  docker info >nul 2>nul
  if not errorlevel 1 set USE_DOCKER=--docker
)
if defined USE_DOCKER (
  echo [baaki] Docker found: starting local Postgres container...
  docker start baaki-db >nul 2>nul || docker run -d --name baaki-db -e POSTGRES_USER=baaki -e POSTGRES_PASSWORD=baaki -e POSTGRES_DB=baaki -p 5432:5432 postgres:16 >nul
  timeout /t 5 /nobreak >nul
)

echo [baaki] Installing packages (first run takes a few minutes)...
call npm ci || call npm install
if errorlevel 1 ( echo [baaki] npm install failed. & pause & exit /b 1 )

call node scripts/setup-env.mjs %USE_DOCKER%
if errorlevel 1 ( pause & exit /b 1 )

echo [baaki] Creating database tables...
call npx prisma db push
if errorlevel 1 ( echo [baaki] Could not reach the database. Check DATABASE_URL in .env. & pause & exit /b 1 )

echo.
echo [baaki] Setup complete. Starting the app at http://localhost:3000
echo [baaki] The demo opens automatically (no sign-in needed). Press Ctrl+C to stop.
start "" cmd /c "timeout /t 12 /nobreak >nul & start http://localhost:3000/api/demo"
call npm run dev
endlocal
