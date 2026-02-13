@echo off
chcp 65001 >nul
title SW Portal

echo Starting Docker containers...
docker-compose up -d

echo Waiting for PostgreSQL...
:wait_pg
docker exec sw_portal_db pg_isready -U sw_portal -q 2>nul
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_pg
)
echo PostgreSQL ready.

echo.
echo ===================================
echo   Starting SW Portal...
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo   Login:    admin / admin123
echo ===================================
echo.

start "SW Portal Backend" cmd /c "cd /d %~dp0backend && python app.py"
cd /d %~dp0frontend
npx pnpm dev
