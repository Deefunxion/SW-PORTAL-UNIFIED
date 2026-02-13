# SW Portal — Render Deployment Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deploy the SW Portal monolith (Flask API + React SPA) to Render with managed PostgreSQL+pgvector, so it's live at a single URL for the Secretary General demo.

**Architecture:** Multi-stage Docker build — Node stage builds the React frontend, Python stage serves it via Flask+Gunicorn. Render managed PostgreSQL provides pgvector. All `/api/*` routes hit Flask; all other paths serve the SPA's `index.html`. No CORS needed (same origin).

**Tech Stack:** Docker multi-stage, Gunicorn, Render Web Service, Render PostgreSQL, OpenAI API (external).

**Current state:** The codebase runs locally with `python app.py` (backend) + `pnpm dev` (frontend). Frontend base path is `/SW-PORTAL-UNIFIED/` (GitHub Pages). There's already a catch-all `serve_frontend()` route in `routes.py:1047-1056` but it doesn't serve `index.html` for SPA routing. No Dockerfile exists. No `gunicorn` in requirements.

---

## Task 1: Add `gunicorn` to backend requirements

**Context:** Gunicorn is the production WSGI server. Flask's built-in server is development-only.

**Files:**
- Modify: `backend/requirements.txt`

**Step 1:** Add `gunicorn` to `backend/requirements.txt`. Append after the Utilities section:

```
# Production server
gunicorn>=21.2.0
```

**Step 2:** Install it locally to verify no dependency conflicts:

```bash
cd backend && pip install gunicorn
```

Expected: Installs without errors. (Note: on Windows, gunicorn won't run — that's fine, we only need it inside the Docker container which is Linux.)

**Step 3:** Commit:

```bash
git add backend/requirements.txt
git commit -m "chore: add gunicorn to requirements for production deployment"
```

---

## Task 2: Fix the frontend catch-all route for SPA serving

**Context:** `routes.py:1047-1056` has a catch-all that serves frontend files from `frontend/dist/`, but it falls back to a JSON message instead of `index.html`. For SPA routing, any non-API, non-file path must return `index.html` so React Router handles it.

Also, the path currently points to `../frontend/dist` which is a development path. In the Docker container, the built frontend will be copied to a different location. We need to make this configurable.

**Files:**
- Modify: `backend/my_project/routes.py` (lines 1043-1056)
- Modify: `backend/my_project/__init__.py` (add `FRONTEND_DIR` config)

**Step 1:** In `backend/my_project/__init__.py`, add a `FRONTEND_DIR` config after the `UPLOAD_FOLDER` line (around line 33). Find:

```python
    app.config['UPLOAD_FOLDER'] = os.environ.get('UPLOAD_FOLDER', '../content')
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
```

Replace with:

```python
    app.config['UPLOAD_FOLDER'] = os.environ.get('UPLOAD_FOLDER', '../content')
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
    app.config['FRONTEND_DIR'] = os.environ.get(
        'FRONTEND_DIR',
        os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'dist')
    )
```

**Step 2:** In `backend/my_project/routes.py`, replace the entire frontend serving section (lines 1043-1056) with:

```python
# ============================================================================
# FRONTEND SERVING (production: serves built React SPA)
# ============================================================================

@main_bp.route('/', defaults={'path': ''})
@main_bp.route('/<path:path>')
def serve_frontend(path):
    """Serve the React SPA.

    Static assets (js, css, images) are served directly.
    All other paths return index.html for client-side routing.
    """
    build_dir = os.path.abspath(current_app.config.get('FRONTEND_DIR', ''))

    if not os.path.isdir(build_dir):
        return jsonify({'message': 'SW Portal API is running. Frontend not built.'}), 200

    # Serve static files directly if they exist
    if path and os.path.exists(os.path.join(build_dir, path)):
        return send_from_directory(build_dir, path)

    # SPA catch-all: return index.html for React Router
    index_path = os.path.join(build_dir, 'index.html')
    if os.path.exists(index_path):
        return send_from_directory(build_dir, 'index.html')

    return jsonify({'message': 'SW Portal API is running. Frontend not built.'}), 200
```

**Step 3:** Verify the route doesn't interfere with API routes by running tests:

```bash
python -m pytest tests/test_basic.py -v
```

Expected: All basic tests pass. The catch-all is registered last (at the bottom of routes.py), so `/api/*` routes take priority because Flask matches more specific routes first.

**Step 4:** Commit:

```bash
git add backend/my_project/routes.py backend/my_project/__init__.py
git commit -m "feat: fix SPA catch-all route for production frontend serving

Serve index.html for all non-API, non-static paths (React Router).
Make frontend build directory configurable via FRONTEND_DIR env var.
Falls back gracefully when frontend isn't built."
```

---

## Task 3: Fix frontend base path and API URL for Render

**Context:** The frontend is currently configured for GitHub Pages deployment:
- `vite.config.js` has `base: '/SW-PORTAL-UNIFIED/'`
- `App.jsx` uses `basename={import.meta.env.BASE_URL.replace(/\/$/, '')}`
- `api.js` defaults to `http://localhost:5000`

For Render, the base is `/` and the API is on the same origin (no explicit URL needed).

**Files:**
- Modify: `frontend/vite.config.js`
- Modify: `frontend/src/App.jsx` (line 456)
- Modify: `frontend/src/lib/api.js` (line 5)

**Step 1:** In `frontend/vite.config.js`, change the `base` to be environment-aware. Replace:

```js
export default defineConfig({
  base: '/SW-PORTAL-UNIFIED/',
```

With:

```js
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
```

This defaults to `/` (for Render) but can be overridden to `/SW-PORTAL-UNIFIED/` for GitHub Pages by setting `VITE_BASE_PATH`.

**Step 2:** In `frontend/src/lib/api.js`, change the default baseURL from `http://localhost:5000` to empty string (same origin). Replace:

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
});
```

With:

```js
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});
```

When running locally with `pnpm dev`, the Vite proxy (added in Task 4) will forward `/api` calls to Flask on `:5000`. In production, the API is on the same origin.

**Step 3:** The `App.jsx` line 456 already dynamically uses `import.meta.env.BASE_URL` — this will automatically pick up the new base from vite.config.js. No change needed.

**Step 4:** Test the frontend build:

```bash
cd frontend && npx pnpm build
```

Expected: Build succeeds. Check that `dist/index.html` has `<script src="/assets/...">` (not `/SW-PORTAL-UNIFIED/assets/...`).

**Step 5:** Commit:

```bash
git add frontend/vite.config.js frontend/src/lib/api.js
git commit -m "feat: configure frontend for Render deployment

Default base path to '/' (overridable via VITE_BASE_PATH).
Default API URL to same-origin (overridable via VITE_API_URL).
Supports both Render (/) and GitHub Pages (/SW-PORTAL-UNIFIED/)."
```

---

## Task 4: Add Vite dev proxy for local development

**Context:** Since we changed `api.js` to default to same-origin (`''`), local development with `pnpm dev` (Vite on :5173) needs a proxy to forward `/api` calls to Flask on :5000. Without this, API calls would hit Vite itself and 404.

**Files:**
- Modify: `frontend/vite.config.js`

**Step 1:** Add a `server.proxy` section to `vite.config.js`. The full file should now be:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/content': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
```

This proxies both `/api/*` and `/content/*` to Flask during development.

**Step 2:** Test locally (requires Docker + Flask running):

```bash
# Terminal 1: backend
cd backend && python app.py

# Terminal 2: frontend
cd frontend && npx pnpm dev
```

Navigate to `http://localhost:5173/login` — login should work (API calls proxied to :5000).

**Step 3:** Commit:

```bash
git add frontend/vite.config.js
git commit -m "feat: add Vite dev proxy for /api and /content routes

Forwards API calls to Flask on :5000 during local development.
Preserves same-origin API calls in production (Render)."
```

---

## Task 5: Fix Render PostgreSQL URL compatibility

**Context:** Render provides `DATABASE_URL` starting with `postgres://` but SQLAlchemy 1.4+ requires `postgresql://`. We need to handle this in the config. This is a well-known Render/Heroku gotcha.

**Files:**
- Modify: `backend/my_project/__init__.py` (line 25-26)

**Step 1:** In `backend/my_project/__init__.py`, after the `DATABASE_URL` override (line 25-26), add a URL fix. Replace:

```python
    # Override with environment variables if present
    if os.environ.get('DATABASE_URL'):
        app.config['SQLALCHEMY_DATABASE_URI'] = os.environ['DATABASE_URL']
```

With:

```python
    # Override with environment variables if present
    if os.environ.get('DATABASE_URL'):
        db_url = os.environ['DATABASE_URL']
        # Render/Heroku provides postgres:// but SQLAlchemy requires postgresql://
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = db_url
```

**Step 2:** Run tests to ensure nothing broke:

```bash
python -m pytest tests/test_basic.py -v
```

Expected: All pass (tests use `sqlite://` so the postgres fix doesn't affect them).

**Step 3:** Commit:

```bash
git add backend/my_project/__init__.py
git commit -m "fix: handle Render's postgres:// URL prefix for SQLAlchemy

Render provides DATABASE_URL with 'postgres://' but SQLAlchemy
requires 'postgresql://'. Auto-replace on startup."
```

---

## Task 6: Update ProductionConfig for Render

**Context:** The `ProductionConfig` in `backend/config/__init__.py` has some settings that need adjustment for Render:
- `LOG_FILE` points to `/var/log/sw-portal/app.log` which doesn't exist on Render (use stdout)
- CORS origins should allow the Render domain
- Need to handle proxy headers (Render terminates SSL)

**Files:**
- Modify: `backend/config/__init__.py` (ProductionConfig, lines 55-71)

**Step 1:** Replace the `ProductionConfig` class with:

```python
class ProductionConfig(Config):
    """Production configuration (Render)."""
    DEBUG = False
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')

    # Security settings
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # In production on Render, CORS isn't needed (same origin)
    # but keep configurable for future split deployments
    CORS_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*').split(',')

    # Logging to stdout (Render captures stdout)
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
```

**Step 2:** Run tests:

```bash
python -m pytest tests/test_basic.py -v
```

Expected: All pass.

**Step 3:** Commit:

```bash
git add backend/config/__init__.py
git commit -m "fix: update ProductionConfig for Render deployment

Log to stdout (Render captures it). Remove hardcoded log file path.
Make CORS origins configurable. Default to allow-all for monolith."
```

---

## Task 7: Create the Dockerfile

**Context:** This is the core of the deployment. A multi-stage Docker build:
- **Stage 1 (Node):** Install pnpm, install deps, build the React frontend
- **Stage 2 (Python):** Install Python deps, copy the built frontend, run Gunicorn

**Files:**
- Create: `Dockerfile` (project root)
- Create: `.dockerignore` (project root)

**Step 1:** Create `.dockerignore` in the project root:

```
node_modules
.git
*.pyc
__pycache__
.env
.venv
*.db
content/
uploads/
logs/
frontend/node_modules
frontend/.vite
SW_PORTAL_demo/
docs/
tests/
*.md
!requirements.txt
```

**Step 2:** Create `Dockerfile` in the project root:

```dockerfile
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

# Start Gunicorn
CMD cd backend && gunicorn app:app \
    --bind 0.0.0.0:${PORT:-10000} \
    --workers 2 \
    --threads 4 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
```

**Step 3:** Test the Docker build locally (optional — requires Docker):

```bash
docker build -t sw-portal .
```

Expected: Build completes. Both stages succeed.

**Step 4:** Test run locally (optional):

```bash
docker run -p 10000:10000 \
  -e DATABASE_URL=postgresql://sw_portal:sw_portal_dev@host.docker.internal:5432/sw_portal \
  -e SECRET_KEY=test-secret-key-32-bytes-long-ok \
  -e JWT_SECRET_KEY=test-jwt-key-32-bytes-long-okay \
  -e OPENAI_API_KEY=sk-your-key \
  sw-portal
```

Expected: App starts on :10000, frontend loads, API responds.

**Step 5:** Commit:

```bash
git add Dockerfile .dockerignore
git commit -m "feat: add multi-stage Dockerfile for Render deployment

Stage 1: Node 20 builds React frontend with pnpm.
Stage 2: Python 3.11 runs Flask+Gunicorn serving API + SPA.
2 workers, 4 threads, 120s timeout."
```

---

## Task 8: Create render.yaml (Infrastructure as Code)

**Context:** `render.yaml` is Render's Blueprint spec — it defines all services, databases, and environment variables as code. This lets anyone deploy the entire stack with one click on Render.

**Files:**
- Create: `render.yaml` (project root)

**Step 1:** Create `render.yaml`:

```yaml
# Render Blueprint — deploy with one click
# https://render.com/docs/blueprint-spec

services:
  - type: web
    name: sw-portal
    runtime: docker
    dockerfilePath: ./Dockerfile
    plan: starter  # $7/month, always-on
    region: frankfurt  # Closest to Greece
    healthCheckPath: /api/health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: sw-portal-db
          property: connectionString
      - key: FLASK_ENV
        value: production
      - key: SECRET_KEY
        generateValue: true
      - key: JWT_SECRET_KEY
        generateValue: true
      - key: OPENAI_API_KEY
        sync: false  # Must be set manually in Render dashboard
      - key: FRONTEND_DIR
        value: /app/frontend/dist

databases:
  - name: sw-portal-db
    plan: starter  # $7/month, 1GB storage
    region: frankfurt
    databaseName: sw_portal
    user: sw_portal
    postgresMajorVersion: "16"
    ipAllowList: []  # Only internal access
```

**Note:** After deploying, you must manually enable the pgvector extension. Render's PostgreSQL supports it — go to the database dashboard > Shell tab and run:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

**Step 2:** Commit:

```bash
git add render.yaml
git commit -m "feat: add render.yaml Blueprint for one-click deployment

Defines web service (Docker, starter plan, Frankfurt region)
and PostgreSQL 16 database with auto-generated secrets.
OPENAI_API_KEY must be set manually in dashboard."
```

---

## Task 9: Handle pgvector extension on Render PostgreSQL

**Context:** Render's managed PostgreSQL supports pgvector, but the extension must be explicitly enabled. Our `db.create_all()` will fail trying to create the `FileChunk.embedding` column (Vector type) if the extension isn't present.

We add extension creation to the app startup.

**Files:**
- Modify: `backend/my_project/__init__.py` (inside `create_app()`, before `db.create_all()`)

**Step 1:** In `backend/my_project/__init__.py`, find the `db.create_all()` call (around line 99). Add pgvector extension creation before it. Replace:

```python
        # Create all tables
        db.create_all()
```

With:

```python
        # Enable pgvector extension (required for Vector columns)
        try:
            db.session.execute(db.text('CREATE EXTENSION IF NOT EXISTS vector'))
            db.session.commit()
        except Exception:
            db.session.rollback()  # Fails on SQLite (testing) — that's OK

        # Create all tables
        db.create_all()
```

**Step 2:** Run tests to verify it doesn't break SQLite testing:

```bash
python -m pytest tests/test_basic.py -v
```

Expected: All pass. The `except` block catches SQLite's lack of extension support.

**Step 3:** Commit:

```bash
git add backend/my_project/__init__.py
git commit -m "feat: auto-enable pgvector extension on app startup

Runs CREATE EXTENSION IF NOT EXISTS vector before creating tables.
Silently fails on SQLite (test environment) — no impact on tests."
```

---

## Task 10: Run full test suite and verify local Docker build

**Context:** Before pushing to Render, verify everything works.

**Step 1:** Run all backend tests:

```bash
python -m pytest tests/ -v
```

Expected: All tests pass.

**Step 2:** Build frontend to verify it works with new base path:

```bash
cd frontend && npx pnpm build
```

Expected: Build succeeds, outputs to `dist/`.

**Step 3:** Test the full Docker build:

```bash
docker build -t sw-portal .
```

Expected: Build completes successfully.

**Step 4:** (Optional) Run the Docker container and test:

```bash
docker run --rm -p 10000:10000 \
  -e DATABASE_URL=postgresql://sw_portal:sw_portal_dev@host.docker.internal:5432/sw_portal \
  -e SECRET_KEY=test-secret-key-that-is-32-bytes \
  -e JWT_SECRET_KEY=jwt-secret-key-that-is-32-bytes \
  sw-portal
```

Visit `http://localhost:10000` — should see the SW Portal frontend.
Visit `http://localhost:10000/api/health` — should return health JSON.

**Step 5:** Commit any remaining fixes:

```bash
git add -A
git commit -m "chore: verify deployment readiness — all tests pass, Docker builds"
```

---

## Task 11: Deploy to Render

**Context:** This is the actual deployment. You can either use the Blueprint (render.yaml) for automated setup, or manually create services in the Render dashboard.

### Option A: Blueprint Deploy (Recommended)

**Step 1:** Push the branch to GitHub:

```bash
git push origin revival/demo-prep
```

**Step 2:** Go to https://dashboard.render.com → **Blueprints** → **New Blueprint Instance**

**Step 3:** Connect to the GitHub repo, select the `revival/demo-prep` branch.

**Step 4:** Render will detect `render.yaml` and show the services to create:
- `sw-portal` (Web Service, Docker, Starter plan)
- `sw-portal-db` (PostgreSQL 16, Starter plan)

**Step 5:** Set the `OPENAI_API_KEY` environment variable manually in the web service settings.

**Step 6:** Click **Apply** — Render will create both services and deploy.

### Option B: Manual Setup

**Step 1:** Create PostgreSQL database:
- Render Dashboard → **New** → **PostgreSQL**
- Name: `sw-portal-db`
- Region: Frankfurt
- Plan: Starter ($7/month)
- Version: 16
- Copy the **Internal Connection String**

**Step 2:** Enable pgvector:
- Go to database → **Shell** tab
- Run: `CREATE EXTENSION IF NOT EXISTS vector;`

**Step 3:** Create Web Service:
- Render Dashboard → **New** → **Web Service**
- Connect to GitHub repo, branch `revival/demo-prep`
- Runtime: **Docker**
- Region: Frankfurt
- Plan: Starter ($7/month)

**Step 4:** Set environment variables:
- `DATABASE_URL` = (paste Internal Connection String from step 1)
- `SECRET_KEY` = (generate: `python -c "import secrets; print(secrets.token_hex(32))"`)
- `JWT_SECRET_KEY` = (generate: `python -c "import secrets; print(secrets.token_hex(32))"`)
- `OPENAI_API_KEY` = (your OpenAI API key)
- `FLASK_ENV` = `production`
- `FRONTEND_DIR` = `/app/frontend/dist`

**Step 5:** Deploy. Render will build the Docker image and start the service.

### Post-Deploy Verification

**Step 1:** Visit `https://sw-portal.onrender.com` (or your service URL)
- Should see the login page

**Step 2:** Login as `admin/admin123`
- Should redirect to home dashboard

**Step 3:** Test API health:
- Visit `https://sw-portal.onrender.com/api/health`
- Should return JSON health status

**Step 4:** Test AI chat (if OPENAI_API_KEY is set):
- Open the ChatWidget
- Ask a question
- Should get an AI response

---

## Post-Deployment Backlog (Not in scope)

These are nice-to-have improvements for after the demo:

1. **Custom domain** — Point `portal.swportal.gr` to Render
2. **SSL certificate** — Render provides free Let's Encrypt (automatic)
3. **Document ingestion on Render** — Run `ingest_documents.py` via Render Shell or a one-off job
4. **CI/CD** — Auto-deploy on push to `main`
5. **Health monitoring** — Render has built-in health checks (configured via `healthCheckPath`)
6. **Backup strategy** — Render PostgreSQL has automatic daily backups on paid plans
7. **Rate limiting** — Add Flask-Limiter for API protection
8. **Stronger auth** — Change default passwords, add registration controls
