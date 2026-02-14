#!/bin/bash
# ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ — one-command launcher
# Starts Docker containers, backend (Flask :5000), and frontend (Vite :5173)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 1. Start Docker containers (PostgreSQL + Redis)
echo "Starting Docker containers..."
docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
until docker exec sw_portal_db pg_isready -U sw_portal -q 2>/dev/null; do
  sleep 1
done
echo "PostgreSQL ready."

# 2. Start backend
echo "Starting Flask backend on :5000..."
cd "$SCRIPT_DIR/backend"
python app.py &
BACKEND_PID=$!

# 3. Start frontend
echo "Starting Vite frontend on :5173..."
cd "$SCRIPT_DIR/frontend"
npx pnpm dev &
FRONTEND_PID=$!

# Cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
  echo "Done."
}
trap cleanup INT TERM

echo ""
echo "==================================="
echo "  ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ is running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:5000"
echo "  Login:    admin / admin123"
echo "==================================="
echo ""
echo "Press Ctrl+C to stop."

wait
