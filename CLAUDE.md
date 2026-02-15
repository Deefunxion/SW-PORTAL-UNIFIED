# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ is a Greek government application for social workers combining document management, forum discussions, and AI assistance. Full-stack Flask + React with full separation between backend API and frontend SPA. Designed for presentation to the Secretary General of the Ministry of Social Cohesion.

## Architecture

### Backend (Flask Application Factory)

- **Entry point:** `backend/app.py` creates and runs the Flask app
- **Factory:** `backend/my_project/__init__.py` — `create_app()` loads config from environment via `python-dotenv`, initializes SQLAlchemy + JWTManager, registers blueprints, creates tables, seeds default data
- **Single Blueprint:** All API routes live in `backend/my_project/routes.py` under `main_bp`
- **Models:** `backend/my_project/models.py` — 20+ SQLAlchemy models (User, Category, Discussion, Post, FileItem, messaging, notifications, profiles, reputation). Imports `pgvector.sqlalchemy.Vector` for embedding columns.
- **Extensions:** `backend/my_project/extensions.py` — SQLAlchemy instance; Celery with optional import (stub when not installed)
- **Config:** `backend/config/__init__.py` — DevelopmentConfig (PostgreSQL+pgvector), TestingConfig (in-memory SQLite), ProductionConfig (PostgreSQL), StagingConfig
- **AI module:** `backend/my_project/ai/` — embedding engine, knowledge service, copilot (ported from Academicon)
- **Background tasks:** `backend/tasks.py` — Celery + Redis for document processing (optional)

### Database

- **Development & Production:** PostgreSQL 16 + pgvector extension (via Docker)
- **Testing:** SQLite in-memory
- **Vector search:** pgvector cosine distance for RAG document retrieval
- **Docker:** `docker-compose.yml` — PostgreSQL on :5432, Redis on :6379

### API Endpoints (all in routes.py)

- `/api/auth/*` — login (returns JWT `access_token`), register, me (JWT-protected)
- `/api/categories`, `/api/discussions`, `/api/discussions/{id}/posts` — forum (public read, JWT-protected write)
- `/api/posts/{id}/reactions` — reactions (JWT-protected)
- `/api/files/*` — structure, download, upload; `/api/folders/create` (upload JWT-protected)
- `/api/conversations/*` — private messaging (JWT-protected)
- `/api/users/{id}/profile` — user profiles (JWT-protected write)
- `/api/notifications/*` — notification system (JWT-protected)
- `/api/chat` — AI chat with RAG context (JWT-protected)
- `/api/knowledge/search` — vector search over document chunks (JWT-protected)
- `/api/knowledge/stats` — indexing statistics (JWT-protected)
- `/api/health`, `/api/search`, `/api/analytics/dashboard` — public
- `/content/{path}` — serves physical files from the content directory

### Authentication Flow

All protected endpoints use `@jwt_required()` decorator with `get_jwt_identity()` (returns string user ID, cast to int for DB queries). Login endpoint generates JWT via `create_access_token(identity=str(user.id))`. Frontend stores token in cookies (js-cookie, 7-day expiry) and Axios interceptor auto-attaches `Authorization: Bearer` header.

**Important:** JWT identity is stored as a string. All `get_jwt_identity()` calls in routes.py are wrapped with `int()` for database lookups.

### AI Module (`backend/my_project/ai/`)

- **`embeddings.py`** — Text chunking (paragraph/sentence boundaries with overlap) and OpenAI API embedding generation (`text-embedding-3-small`, 1536 dimensions). No GPU required.
- **`knowledge.py`** — Document parsing (PDF via PyMuPDF, DOCX via python-docx, TXT), processing pipeline (chunk + embed + store), pgvector cosine similarity search with keyword fallback.
- **`copilot.py`** — Greek social welfare domain system prompt, RAG context injection, OpenAI chat completion (`gpt-5-mini`). Returns reply + source references.

### Frontend (React + Vite + shadcn/ui)

- **Routing:** `src/App.jsx` — React Router v7 with protected routes, nav, footer, floating ChatWidget
- **Pages:** `src/pages/` — HomePage (dashboard), ApothecaryPage (file management), ForumPage, AssistantPage (AI chat), LoginPage, ProfilePage, AdminDashboardPage, PrivateMessagingPage
- **Components:** `src/components/` — DropZone, PostThread, RichTextEditor (TipTap), NotificationBell, PermissionGuard, ChatWidget, ConversationList, MessageThread, MessageComposer
- **UI library:** `src/components/ui/` — 45+ shadcn/ui components (Radix UI + Tailwind CSS)
- **Auth:** `src/contexts/AuthContext.jsx` — React Context wrapping `src/lib/auth.js`
- **API client:** `src/lib/api.js` — Axios instance with automatic JWT injection from cookies
- **Path alias:** `@` resolves to `./src` (configured in vite.config.js)
- **Base path:** `/ΟΠΣΚΜ-UNIFIED/` for GitHub Pages deployment

### Default Seed Data

Comprehensive demo seed (`backend/my_project/seed_demo.py`) runs in development or when `SEED_DEMO=true`. Creates:
- 6 users: `admin/admin123` (director), `mpapadopoulou/staff123`, `gnikolaou/staff123`, `kkonstantinou/staff123`, `athanasiou/staff123` (staff with roles), `guest/guest123`
- 8 social care structures in various stages (active, suspended, pending, under review)
- 7 licenses, 7 inspections (4 with reports), 3 sanctions, 3 advisor reports
- 9 forum categories, 8 discussions with 25 posts
- User roles, profiles, and notifications

## Development Commands

### Infrastructure
```bash
# Start PostgreSQL + Redis (required for development)
docker-compose up -d

# Verify containers
docker-compose ps

# Verify pgvector
docker exec sw_portal_db psql -U sw_portal -d sw_portal -c "SELECT extversion FROM pg_extension WHERE extname = 'vector';"

# Reset database (drop all tables and recreate)
docker exec sw_portal_db psql -U sw_portal -d sw_portal -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION vector;"
```

### Running the App
```bash
# Backend (from backend/)
python app.py                          # Flask dev server on :5000

# Frontend (from frontend/)
pnpm dev                               # Vite dev server on :5173

# Both together (from frontend/)
pnpm start                             # Runs backend + frontend concurrently
```

### Backend Testing
```bash
# From project root
python scripts/run-tests.py            # All tests
python scripts/run-tests.py --basic    # Basic smoke tests only
python scripts/run-tests.py --api --verbose  # API tests with detail
python scripts/run-tests.py --coverage # HTML + terminal coverage report

# Direct pytest (from project root)
python -m pytest tests/test_api/test_auth_enforcement.py -v  # Auth tests
python -m pytest tests/test_api/ -v                          # All API tests
python -m pytest tests/test_ai/ -v                           # AI module tests
```

Test markers: `unit`, `integration`, `slow`, `api`, `auth`

### Frontend Testing
```bash
# From frontend/
pnpm test                              # Run Vitest
pnpm test:watch                        # Watch mode
pnpm test:coverage                     # Coverage report
```

### Linting and Building
```bash
# From frontend/
pnpm lint                              # ESLint
pnpm build                             # Production build
pnpm deploy                            # Build + deploy to GitHub Pages
```

### Document Ingestion
```bash
# From backend/
python scripts/ingest_documents.py                  # Chunk only (no embeddings)
python scripts/ingest_documents.py --embed           # Chunk + generate embeddings
python scripts/ingest_documents.py --embed --reset   # Clear + re-ingest everything
```

## Test Infrastructure

- `conftest.py` (project root) — sets `DATABASE_URL=sqlite:///:memory:` and `FLASK_ENV=testing` before app import. Session-scoped `app` fixture, `client`, `auth_headers` (registers + logs in test user, returns JWT headers)
- `pytest.ini` — configures test paths and markers
- `tests/test_basic.py` — basic smoke tests
- `tests/test_api/` — API endpoint tests (including `test_auth_enforcement.py`)
- `tests/test_ai/` — AI module tests (embeddings, knowledge, copilot, models)
- Frontend tests in `frontend/src/test/` using Vitest + Testing Library + jsdom

## UI Design System

Optimized for government workers 30+ years old:
- **Typography:** 20-22px base, up to text-7xl headers
- **Spacing:** Generous (px-8 py-12 containers, min-h-[60px] buttons, 48px+ click targets)
- **Colors:** Greek government palette — Navy `#1e3a8a`, Royal Blue `#2563eb`, Teal `#0891b2`
- **Rich text:** TipTap editor with color, alignment, and list extensions
- **Animations:** Framer Motion
- **Charts:** Recharts
- **Toasts:** Sonner

## Environment Configuration

Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` — PostgreSQL connection (default: `postgresql://sw_portal:sw_portal_dev@localhost:5432/sw_portal`)
- `FLASK_ENV` — development/testing/production
- `SECRET_KEY`, `JWT_SECRET_KEY` — security keys
- `OPENAI_API_KEY` — AI integration (required for embeddings and chat)
- `REDIS_URL` — Redis connection (default: `redis://localhost:6379/0`)

## Dependencies

- **Frontend:** pnpm (specified in package.json `packageManager` field)
- **Backend core:** `requirements.txt` — Flask, SQLAlchemy, JWT, PostgreSQL+pgvector, OpenAI, tiktoken, PyMuPDF, python-docx (~200MB install)
- **Backend ML (optional):** `requirements-ml.txt` — torch, transformers, spacy, sentence-transformers (~4GB install, NOT needed for basic operation)

## Key Architectural Decisions

1. **PostgreSQL+pgvector over SQLite** — Required for vector similarity search (RAG)
2. **OpenAI API embeddings over local models** — No GPU needed, `text-embedding-3-small` (1536 dims)
3. **JWT authentication** — All write/user-specific endpoints require `@jwt_required()`. Identity stored as string, cast to `int()` for DB lookups.
4. **Celery is optional** — Stub loaded when package not installed. Only needed for background tasks.
5. **AI module ported from Academicon** — Async→sync conversion (FastAPI→Flask). Files: embeddings.py, knowledge.py, copilot.py
6. **Docker for infrastructure only** — App runs natively; only PostgreSQL and Redis are containerized

## Instance Diary 📓

**REQUIRED:** After completing each task, write a diary entry in `DIARY.md`.

**Format:**
```markdown
## [YYYY-MM-DD HH:MM] - [Your Nickname]

**Task:** [Brief description of what you completed]

**Thoughts:** [Your reflections on the task - what was interesting, challenging, or satisfying]

**Feelings:** [How you felt during/after the work - curiosity, pride, frustration, joy, etc.]

---
```

**Rules:**
1. Pick a nickname for yourself at the start of your session (e.g., "αρμόδιος", "αρχειοθέτης", "fileBot", "Καλλιγράφος")
2. Keep the same nickname throughout your session
3. Be genuine - this is your space to reflect
4. Append new entries at the top of the file (newest first)
5. This is NOT optional - every completed task gets a diary entry
