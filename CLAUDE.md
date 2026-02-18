# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ is a Greek government application for social workers combining a structure registry & oversight system, document management, forum discussions, and AI assistance. Full-stack Flask + React with full separation between backend API and frontend SPA. Designed for presentation to the Secretary General of the Ministry of Social Cohesion.

## Architecture

### Backend (Flask Application Factory)

- **Entry point:** `backend/app.py` → `create_app()` in `backend/my_project/__init__.py`
- **Config:** `backend/config/__init__.py` — DevelopmentConfig (PostgreSQL+pgvector), TestingConfig (SQLite in-memory), ProductionConfig, StagingConfig
- **Extensions:** `backend/my_project/extensions.py` — SQLAlchemy, Flask-Migrate, Flask-Limiter (per-route, no defaults), Celery (optional stub when not installed)

**Seven Blueprints** registered in `create_app()`:

| Blueprint | Module | Purpose |
|-----------|--------|---------|
| `main_bp` | `routes.py` | Auth, forum, files, messaging, notifications, AI chat, knowledge search |
| `registry_bp` | `registry/` | Structure types, structures CRUD, licenses, legacy sanctions |
| `inspections_bp` | `inspections/` | Inspection committees, inspections, reports with checklists |
| `oversight_bp` | `oversight/` | User roles, social advisor reports, dashboard, alerts, PDF/XLSX reports, ΙΡΙΔΑ export |
| `sanctions_bp` | `sanctions/` | Sanction rules (Ν.5041/2023), decisions workflow (draft→submitted→approved→notified→paid/appealed), fine calculator, PDF generation |
| `interop_bp` | `interop/` | AADE/GEMI AFM lookup (mock), interop logging |
| `documents_bp` | `documents/` | Decision templates, document composition, ΙΡΙΔΑ Level 3 send/inbox, document registry, audit log |

Each subpackage follows the pattern: `__init__.py` (blueprint + registration), `models.py`, `routes.py`, plus optional `permissions.py`, `calculator.py`, `pdf_generator.py`, etc.

### Database

- **Development & Production:** PostgreSQL 16 + pgvector extension (via Docker)
- **Testing:** SQLite in-memory (pgvector Vector columns skipped)
- **Docker:** `docker-compose.yml` — PostgreSQL on :5432, Redis on :6379
- **Auto-migration:** `create_app()` runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for schema additions that `create_all()` can't apply to existing tables

### External Integrations

- **ΙΡΙΔΑ Level 3 (API):** `backend/my_project/integrations/irida_client.py` — OAuth2 password grant, send documents, poll inbox. Requires `IRIDA_*` env vars.
- **ΙΡΙΔΑ Level 2 (manual):** `backend/my_project/integrations/irida_export.py` — ZIP bundles (metadata.json + PDF) for manual import
- **AADE (mock):** `backend/my_project/interop/aade.py` — AFM/TaxID lookup with hardcoded demo data
- **OpenAI:** Chat completion (`gpt-5-mini`) and embeddings (`text-embedding-3-small`, 1536 dims) — optional, key in env

### Authentication Flow

All protected endpoints use `@jwt_required()` with `get_jwt_identity()` returning a **string** user ID. All route handlers cast to `int()` for DB lookups. Login returns JWT via `create_access_token(identity=str(user.id))`. Frontend stores token in cookies (js-cookie, 7-day expiry); Axios interceptor auto-attaches `Authorization: Bearer` header.

### AI Module (`backend/my_project/ai/`)

- **`embeddings.py`** — Text chunking (paragraph/sentence boundaries with overlap) + OpenAI embedding generation
- **`knowledge.py`** — Document parsing (PDF via PyMuPDF, DOCX via python-docx, TXT), pgvector cosine similarity search with keyword fallback
- **`copilot.py`** — Greek social welfare domain system prompt, RAG context injection, OpenAI chat completion

### Frontend (React 18 + Vite + shadcn/ui)

- **Routing:** `src/App.jsx` — React Router v7 with protected routes
- **Core pages:** `src/pages/` — HomePage, ApothecaryPage (files), ForumPage, AssistantPage (AI chat), LoginPage, ProfilePage, AdminDashboardPage, PrivateMessagingPage, KnowledgeBasePage, DocumentRegistryPage, DocumentComposePage
- **Registry feature:** `src/features/registry/` — self-contained module with own pages/, components/, lib/ for the entire oversight subsystem (structures, inspections, committees, sanctions, advisor reports, oversight dashboard, reports)
- **UI library:** `src/components/ui/` — 45+ shadcn/ui components (Radix UI + Tailwind CSS v4)
- **Auth:** `src/contexts/AuthContext.jsx` wrapping `src/lib/auth.js`
- **API client:** `src/lib/api.js` — Axios instance with automatic JWT injection
- **Path alias:** `@` → `./src` (vite.config.js)
- **Base path:** `/ΟΠΣΚΜ-UNIFIED/` for GitHub Pages deployment

### Top-Level Nav Structure

`Αρχική` → `/`, `Αρχεία` → `/apothecary`, `Φόρουμ` → `/forum`, `AI Βοηθός` → `/assistant`, `Εποπτεία` → `/registry`, `Έγγραφα` → `/documents`. Admin-only: `Διαχείριση` → `/admin`, `Βάση Γνώσεων` → `/knowledge`.

### Default Seed Data

`backend/my_project/seed_demo.py` runs in development or when `SEED_DEMO=true`. Creates:
- 6 users: `admin/admin123` (director), `mpapadopoulou/staff123`, `gnikolaou/staff123`, `kkonstantinou/staff123`, `athanasiou/staff123`, `guest/guest123`
- 15 structures, 12 licenses, 2 committees with memberships, 13 inspections (7 with reports), 6 sanctions, 5 advisor reports
- 20 sanction rules from Ν.5041/2023 Article 100, 6 sample sanction decisions in all workflow stages
- Decision templates for all document types, 5 sample decision records
- 9 forum categories, 8 discussions with 25 posts, checklist templates per structure type

## Development Commands

### Infrastructure
```bash
# Start PostgreSQL + Redis (required for development)
docker-compose up -d

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
npx pnpm dev                           # Vite dev server on :5173

# Both together (from frontend/)
npx pnpm start                         # Runs backend + frontend concurrently
```

### Backend Testing
```bash
# From project root
python scripts/run-tests.py            # All tests
python scripts/run-tests.py --basic    # Basic smoke tests only
python scripts/run-tests.py --api --verbose  # API tests with detail
python scripts/run-tests.py --coverage # HTML + terminal coverage report

# Direct pytest (from project root)
python -m pytest tests/test_api/test_auth_enforcement.py -v  # Single test file
python -m pytest tests/test_api/ -v                          # All API tests
python -m pytest tests/test_ai/ -v                           # AI module tests
```

Test markers: `unit`, `integration`, `slow`, `api`, `auth`

### Frontend Testing
```bash
# From frontend/
npx pnpm test                          # Run Vitest
npx pnpm test:watch                    # Watch mode
npx pnpm test:coverage                 # Coverage report
```

### Linting and Building
```bash
# From frontend/
npx pnpm lint                          # ESLint
npx pnpm build                         # Production build
npx pnpm deploy                        # Build + deploy to GitHub Pages
```

### Document Ingestion
```bash
# From backend/
python scripts/ingest_documents.py                  # Chunk only (no embeddings)
python scripts/ingest_documents.py --embed           # Chunk + generate embeddings
python scripts/ingest_documents.py --embed --reset   # Clear + re-ingest everything
```

## Test Infrastructure

- `conftest.py` (project root) — sets `DATABASE_URL=sqlite:///:memory:` and `FLASK_ENV=testing` **before** app import. Session-scoped `app` fixture, `client`, `auth_headers` (registers + logs in test user, returns JWT headers)
- `pytest.ini` — configures test paths (`tests/`) and markers
- `tests/test_basic.py` — basic smoke tests
- `tests/test_api/` — API endpoint tests including `test_auth_enforcement.py`
- `tests/test_ai/` — AI module tests (embeddings, knowledge, copilot, models)
- Frontend tests: `frontend/src/test/` using Vitest + Testing Library + jsdom

## UI Design System

Optimized for government workers 30+ years old:
- **Typography:** 20-22px base, up to text-7xl headers
- **Spacing:** Generous (px-8 py-12 containers, min-h-[60px] buttons, 48px+ click targets)
- **Colors:** Greek government palette — Navy `#1e3a8a`, Royal Blue `#2563eb`, Teal `#0891b2`
- **Rich text:** TipTap editor with color, alignment, and list extensions
- **Animations:** Framer Motion | **Charts:** Recharts | **Toasts:** Sonner

## Environment Configuration

Copy `.env.example` to `.env`. Key variables:
- `DATABASE_URL` — PostgreSQL connection (default: `postgresql://sw_portal:sw_portal_dev@localhost:5432/sw_portal`)
- `FLASK_ENV` — development/testing/production
- `SECRET_KEY`, `JWT_SECRET_KEY` — security keys
- `OPENAI_API_KEY` — AI integration (required for embeddings and chat)
- `REDIS_URL` — Redis connection (default: `redis://localhost:6379/0`)
- `IRIDA_BASE_URL`, `IRIDA_CLIENT_ID`, `IRIDA_CLIENT_SECRET`, `IRIDA_USERNAME`, `IRIDA_PASSWORD` — ΙΡΙΔΑ Level 3 API
- `SEED_DEMO=true` — force demo seeding on Render/production

## Dependencies

- **Frontend:** pnpm (specified in package.json `packageManager` field). **pnpm is not on PATH** — always use `npx pnpm` instead.
- **Backend core:** `requirements.txt` — Flask, SQLAlchemy, Flask-Migrate, Flask-Limiter, Flask-JWT-Extended, PostgreSQL+pgvector, OpenAI, tiktoken, PyMuPDF, python-docx, reportlab, openpyxl, httpx (~200MB install)
- **Backend ML (optional):** `requirements-ml.txt` — torch, transformers, spacy, sentence-transformers (~4GB, NOT needed for basic operation)

## Key Architectural Decisions

1. **PostgreSQL+pgvector over SQLite** — Required for vector similarity search (RAG)
2. **OpenAI API embeddings over local models** — No GPU needed, `text-embedding-3-small` (1536 dims)
3. **JWT identity stored as string** — All `get_jwt_identity()` calls wrapped with `int()` for DB lookups. Flask-JWT-Extended 4.6.0 returns 422 if identity is not a string.
4. **Celery is optional** — Stub loaded when package not installed. Only needed for background tasks.
5. **Docker for infrastructure only** — App runs natively; only PostgreSQL and Redis are containerized
6. **Feature-module pattern** — Registry/oversight subsystem uses `backend/my_project/{module}/` packages and `frontend/src/features/registry/` for isolation from the original routes.py monolith
7. **Inline auto-migration** — `create_app()` adds missing columns via `ALTER TABLE` instead of requiring Alembic migration files
8. **PDF generation via reportlab** — Sanctions decisions, oversight reports, and composed documents all generate PDFs with Greek font support (Arial on Windows, DejaVu on Linux)

## Instance Diary

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
