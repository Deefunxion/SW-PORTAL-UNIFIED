# ============================================================
# Stage 1: Build React frontend
# ============================================================
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

# Install pnpm
RUN npm install -g pnpm@10

# Copy package files first (Docker layer caching)
COPY frontend/package.json frontend/pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy frontend source
COPY frontend/ ./

# Build for production (base path = /)
ENV VITE_BASE_PATH=/
RUN pnpm build

# ============================================================
# Stage 2: Python backend + built frontend
# ============================================================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg2-binary and PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy built frontend from Stage 1
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Set environment variables
ENV FLASK_ENV=production
ENV FRONTEND_DIR=/app/frontend/dist
ENV PYTHONUNBUFFERED=1

# Expose port (Render provides $PORT)
EXPOSE 10000

# Start Gunicorn (--preload loads app once before forking workers)
CMD cd backend && gunicorn app:app \
    --bind 0.0.0.0:${PORT:-10000} \
    --preload \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
