# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## SW Portal Architecture

The SW Portal is a Greek government application for social workers that combines document management, forum discussions, and AI assistance. It follows a modern Flask + React architecture with full-stack separation.

### Core Application Structure

**Backend (Flask Application Factory Pattern):**
- `backend/my_project/` - Main Flask application using factory pattern
- `backend/my_project/__init__.py` - Application factory with database seeding and configuration
- `backend/my_project/routes.py` - API endpoints for files, forum, AI chat, authentication
- `backend/my_project/models.py` - SQLAlchemy models (User, Category, Discussion, Post, FileItem, etc.)
- `backend/my_project/extensions.py` - Flask extensions (SQLAlchemy, Celery)
- `backend/app.py` - Main entry point that creates and runs the Flask app

**Frontend (React + Vite + shadcn/ui):**
- `frontend/src/pages/` - Main application pages (HomePage, ApothecaryPage, AssistantPage, ForumPage)
- `frontend/src/components/ui/` - shadcn/ui component system with Tailwind CSS
- `frontend/src/components/` - Custom components (FolderTree, DropZone, PostThread, etc.)
- `frontend/src/contexts/AuthContext.jsx` - Authentication state management
- `frontend/src/lib/` - Utilities (API client, auth helpers, toast notifications)

### Key Technical Decisions

**Authentication:** JWT-based with Flask-JWT-Extended, stored in localStorage
**Database:** SQLite for development, designed for PostgreSQL in production  
**API:** RESTful endpoints with Flask-RESTX for documentation
**File Management:** Physical files in `content/` directory with database metadata
**AI Integration:** OpenAI API + ChromaDB for vector search (in progress)
**Background Tasks:** Celery + Redis for document processing pipeline
**UI System:** shadcn/ui components with Tailwind CSS, official Greek government colors
**State Management:** React Context for auth, local state for components

### Content Directory Structure

The `content/` directory mirrors the Greek government document organization:
- `ΑΠΟΦΑΣΕΙΣ_ΑΔΕΙΟΔΟΤΗΣΗΣ/` - License decisions (KAA, KDAP, KEFI, MFE, SYD)
- `ΝΟΜΟΘΕΣΙΑ_ΚΟΙΝΩΝΙΚΗΣ_ΜΕΡΙΜΝΑΣ/` - Social welfare legislation
- `ΕΚΘΕΣΕΙΣ_ΕΛΕΓΧΩΝ/` - Inspection reports
- `ΕΝΤΥΠΑ_ΑΙΤΗΣΕΩΝ/` - Application forms
- `ΑΠΟΦΑΣΕΙΣ_ΣΥΓΚΡΟΤΗΣΗΣ_ΕΠΙΤΡΟΠΩΝ_ΚΑΙ_ΚΟΙΝΩΝΙΚΟΥ_ΣΥΜΒΟΥΛΟΥ/` - Committee decisions
- `ΕΚΠΑΙΔΕΥΤΙΚΟ_ΥΛΙΚΟ/` - Training materials

## Development Commands

### Backend Development
```bash
cd backend
python app.py                    # Start Flask development server (localhost:5000)
python -c "from my_project import create_app; create_app()"  # Test app creation
```

### Frontend Development  
```bash
cd frontend
npm run dev                      # Start Vite development server (localhost:5173)
npm run build                    # Build for production
npm run lint                     # Run ESLint
npm run start                    # Run both backend and frontend concurrently
npm run deploy                   # Deploy to GitHub Pages
```

### Testing
```bash
python scripts/run-tests.py                    # Run all tests
python scripts/run-tests.py --basic            # Basic functionality tests only
python scripts/run-tests.py --api --verbose    # API endpoint tests with verbose output
python scripts/run-tests.py --coverage         # Generate coverage report
```

### Individual Test Commands
```bash
cd backend
python -m pytest ../tests/test_basic.py::test_database_creation -v       # Test specific function
python -m pytest ../tests/test_api/ -v                                   # All API tests
python -m pytest -m "api" -v                                            # Tests marked as "api"
python -m pytest --watch                                                # Watch mode for continuous testing
python scripts/run-tests.py --watch                                     # Alternative watch mode
```

### Database Management
```bash
cd backend
python create_db.py             # Create/reset database with seed data
rm sw_portal_dev.db             # Delete database file
```

### Development Setup
```bash
python scripts/setup-dev.py     # Automated development environment setup
```

## AI/ML Pipeline Architecture (In Progress)

The application is designed for a sophisticated document processing pipeline:

1. **Document Ingestion** - unstructured library for parsing PDFs, DOCX, etc.
2. **OCR Processing** - Extract text from scanned documents  
3. **PII Redaction** - spaCy + Greek BERT-NER models for sensitive data removal
4. **Vectorization** - sentence-transformers for ChromaDB storage
5. **RAG System** - Retrieval-Augmented Generation with OpenAI API
6. **Background Processing** - Celery tasks for async document pipeline

Current dependencies include transformers, torch, sentence-transformers, chromadb, spacy, celery, and redis.

## UI Design System

The application uses a human-centered design optimized for government workers 30+ years old:

**Typography:** 20-22px base font sizes, up to text-7xl for headers
**Spacing:** Generous padding (px-8 py-12 containers, min-h-[60px] buttons)  
**Colors:** Official Greek government palette - Navy #1e3a8a, Royal Blue #2563eb, Teal #0891b2
**Accessibility:** Large click targets (48px+ height), high contrast, clear hierarchy
**Components:** shadcn/ui with extensive customization for government use

Key pages follow this pattern:
- **ApothecaryPage** - File management with category-based navigation
- **HomePage** - Dashboard with large stats cards and quick actions  
- **AssistantPage** - AI chat interface with suggested questions
- **ForumPage** - Discussion threads with real-time features

## Configuration Management

**Environment Files:**
- `.env.example` - Template for environment variables
- `backend/config/` - Environment-specific configuration classes
- `pytest.ini` - Test configuration with markers

**Key Configuration:**
- Database: SQLite for development (`sw_portal_dev.db`)
- Upload folder: `../content` relative to backend
- Celery: Redis broker for background tasks
- CORS: Enabled for all origins in development
- Package Manager: pnpm for frontend (configured in package.json)
- Legacy Config: `backend/config.py` imports from `backend/config/` directory

## Development Workflow

1. **Setup:** Run `python scripts/setup-dev.py` for automated setup
2. **Development:** Backend on :5000, Frontend on :5173  
3. **Testing:** Use `python scripts/run-tests.py --basic` for quick validation
4. **Debugging:** Check database with `rm backend/sw_portal_dev.db && python backend/create_db.py`

The application follows modern React patterns with hooks, context for state management, and proper component separation. Backend uses Flask application factory pattern with blueprint registration and extension initialization.

## Testing Strategy

**Test Markers:** unit, integration, slow, api, auth
**Test Structure:** Basic functionality tests in `test_basic.py`, API tests in `test_api/`
**Coverage:** HTML and terminal reports available with `--coverage` flag
**Performance:** Optimized for 8GB RAM environments with `--basic` flag for essential tests only
**Continuous Testing:** Watch mode available via `python scripts/run-tests.py --watch`

## Package Management

**Frontend:** Uses pnpm as package manager (specified in package.json)
**Backend:** Standard pip with requirements.txt
**Dependencies:** Full AI/ML stack including transformers, torch, chromadb for document processing

## Environment Configuration

Critical environment variables (copy from `.env.example`):
- `FLASK_ENV` - Environment mode (development/production)
- `SECRET_KEY` & `JWT_SECRET_KEY` - Security keys
- `DATABASE_URL` - Database connection
- `OPENAI_API_KEY` - AI service integration
- `CELERY_BROKER_URL` - Redis for background tasks