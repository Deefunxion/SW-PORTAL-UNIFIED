# SW Portal Revival — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Revive the SW Portal into a functional prototype with real authentication, clean codebase, and AI assistant powered by ported Academicon RAG modules — ready for presentation to the Secretary General of the Ministry of Social Cohesion.

**Architecture:** Flask (backend) + React/Vite/shadcn (frontend) + PostgreSQL/pgvector (database + vector search) + OpenAI API (embeddings + chat) + Docker (infrastructure). Port AI modules from Academicon (FastAPI→Flask), migrate from SQLite to PostgreSQL, fix fake authentication, remove ~2,500 lines of dead code.

**Tech Stack:** Flask 2.3, Flask-SQLAlchemy, Flask-JWT-Extended, PostgreSQL 16 + pgvector, OpenAI API (text-embedding-3-small + gpt-4o), React 18, Vite 6, shadcn/ui, Docker Compose, pnpm.

**Timeline:** 6 days. Phase 1 (Day 1-2): Cleanup & Infra. Phase 2 (Day 3-4): Port AI. Phase 3 (Day 5-6): Polish & Demo.

**Source repos:**
- SW Portal: `D:\LAPTOP_BACKUP\Development\SW-PORTAL-UNIFIED`
- Academicon (reference): `D:\Academicon`

---

## Phase 1: Cleanup & Infrastructure (Day 1-2)

---

### Task 1: Archive junk files from project root

**Context:** The project root has accumulated unrelated files over 7 months — an unrelated gamified learning platform blueprint, AI news briefs, a full 13MB project backup, and old redesign workspaces. These clutter the repo and confuse new developers.

**Files:**
- Delete: `AI_ORCHESTRATORS_ASCENT_UNIFIED_BLUEPRINT.md` (unrelated project)
- Delete: `IMPORTANT_AI-ECOSYSTEM_GENERAL_CURRENT_KNOWLEDGE_BRIEF_07_25.md` (AI news digest)
- Delete: `ApothecaryPage_Modernization_Guide.md` (outdated guide)
- Delete: `SW-Portal-Components-For-AI-Redesign.md` (outdated component docs)
- Delete: `2025-07-22-this-session-is-being-continued-from-a-previous-co.txt` (session artifact)
- Delete: `clean_md_file.py` (one-off utility)
- Delete: `bundle.py` (one-off utility)
- Delete: `start_backend.py` (redundant — `backend/app.py` does this)
- Delete: `start_portal.py` (redundant — `pnpm start` does this)
- Delete directory: `SW_PORTAL_demo/` (13MB full backup, redundant)
- Delete directory: `High-priority-files/` (old AI redesign workspace)
- Delete directory: `Documentation_SW_PORTAL_V5/` (outdated AI/ML research docs)
- Delete directory: `docs_legacy/` (if exists, archived docs)
- Update: `.gitignore` — add `*.db`, `content/`, `uploads/`, `logs/`

**Step 1:** Delete files and directories listed above.

**Step 2:** Update `.gitignore`:
```gitignore
# Database
*.db

# Content and uploads
content/
uploads/
logs/

# Environment
.env
```

**Step 3:** Commit:
```bash
git add -A
git commit -m "chore: archive junk files and clean project root

Remove unrelated docs (AI_ORCHESTRATORS blueprint, AI news brief),
outdated guides, one-off scripts, and 13MB SW_PORTAL_demo backup.
Update .gitignore for database and content files."
```

---

### Task 2: Remove dead frontend code

**Context:** There are two abandoned "Enhanced" forum page variants (888 lines), unused components that were never integrated, and commented-out routes in App.jsx. This dead code adds confusion and maintenance burden.

**Files:**
- Delete: `frontend/src/pages/EnhancedForumPage.jsx` (502 lines, unused)
- Delete: `frontend/src/pages/EnhancedDiscussionDetail.jsx` (386 lines, unused)
- Delete: `frontend/src/components/ToastDemo.jsx` (118 lines, unused)
- Delete: `frontend/src/components/UserPresenceIndicator.jsx` (485 lines, unused — presence tracking not implemented)
- Delete: `frontend/src/components/FolderTree.jsx` (198 lines, unused — ApothecaryPage has its own implementation)
- Modify: `frontend/src/App.jsx` — remove commented-out legacy routes and dead imports

**Step 1:** Delete the 5 files listed above.

**Step 2:** In `frontend/src/App.jsx`, remove:
- Any import of `EnhancedForumPage`, `EnhancedDiscussionDetail`
- Any commented-out route blocks referencing these components
- Any unused imports that result from the deletions

**Step 3:** Verify frontend still builds:
```bash
cd frontend && pnpm build
```
Expected: Build succeeds with no errors.

**Step 4:** Commit:
```bash
git add -A
git commit -m "chore: remove 1,689 lines of dead frontend code

Delete abandoned Enhanced forum pages, unused ToastDemo,
UserPresenceIndicator, and FolderTree components.
Clean up dead imports and commented routes in App.jsx."
```

---

### Task 3: Clean backend dependencies

**Context:** `requirements.txt` includes ~4GB of ML dependencies (torch, transformers, spacy, sentence-transformers) that are never imported by the running application. The AI system will use OpenAI API-based embeddings (ported from Academicon), which only needs the `openai` and `tiktoken` packages. Keep `requirements.txt` lean and create a separate file for future ML work.

**Files:**
- Rewrite: `backend/requirements.txt`
- Create: `backend/requirements-ml.txt` (future use)

**Step 1:** Replace `backend/requirements.txt` with:
```txt
# Core Flask
Flask==2.3.3
Flask-SQLAlchemy==3.0.5
Flask-CORS==4.0.0
Flask-JWT-Extended==4.6.0
Flask-RESTX==1.3.0
Werkzeug==2.3.7

# Database
psycopg2-binary>=2.9.9
pgvector>=0.4.0
alembic>=1.13.0

# Authentication
bcrypt==4.1.2

# AI / LLM
openai>=1.10.0
tiktoken>=0.5.0
chromadb>=0.4.0

# Document Processing
PyMuPDF>=1.23.0
python-docx>=1.1.0

# HTTP
httpx>=0.23.0

# Utilities
python-dotenv>=1.0.0
```

**Step 2:** Create `backend/requirements-ml.txt`:
```txt
# Heavy ML dependencies — NOT needed for basic operation
# Install only when implementing local embedding models or PII redaction
-r requirements.txt
transformers>=4.35.0
torch>=2.1.0
sentence-transformers>=2.2.0
spacy==3.7.2
unstructured[all-docs]>=0.11.0
Pillow>=10.0.0
celery>=5.3.0
redis>=5.0.0
Flask-Mail==0.9.1
```

**Step 3:** Commit:
```bash
git add backend/requirements.txt backend/requirements-ml.txt
git commit -m "chore: slim dependencies from ~4GB to ~200MB

Move unused ML deps (torch, transformers, spacy) to requirements-ml.txt.
Add PostgreSQL (psycopg2, pgvector, alembic) and AI API deps (openai, tiktoken).
Core requirements now install in under 2 minutes."
```

---

### Task 4: Set up Docker infrastructure

**Context:** We need PostgreSQL 16 with the pgvector extension for vector search, and Redis for caching (optional but included for future Celery use). Docker Compose makes this reproducible and easy to demo.

**Files:**
- Create: `docker-compose.yml` (project root)
- Create: `.env` (from template, if not exists)
- Modify: `.env.example`

**Step 1:** Create `docker-compose.yml` in project root:
```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: sw_portal_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: sw_portal
      POSTGRES_USER: sw_portal
      POSTGRES_PASSWORD: sw_portal_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: sw_portal_redis
    restart: unless-stopped
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

**Step 2:** Update `.env.example` to include:
```bash
# Database (PostgreSQL + pgvector)
DATABASE_URL=postgresql://sw_portal:sw_portal_dev@localhost:5432/sw_portal

# Redis
REDIS_URL=redis://localhost:6379/0

# AI
OPENAI_API_KEY=sk-your-key-here

# Flask
FLASK_ENV=development
SECRET_KEY=change-me-in-production
JWT_SECRET_KEY=change-me-in-production
```

**Step 3:** Copy `.env.example` to `.env` if `.env` doesn't exist, then fill in the real `OPENAI_API_KEY`.

**Step 4:** Start services:
```bash
docker-compose up -d
```
Expected: Both containers start. Verify:
```bash
docker-compose ps
```
Expected: `sw_portal_db` and `sw_portal_redis` both "Up".

**Step 5:** Verify pgvector extension:
```bash
docker exec -it sw_portal_db psql -U sw_portal -d sw_portal -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extversion FROM pg_extension WHERE extname = 'vector';"
```
Expected: Extension created, version shown (e.g., 0.7.0).

**Step 6:** Commit:
```bash
git add docker-compose.yml .env.example
git commit -m "infra: add Docker Compose for PostgreSQL+pgvector and Redis

Single command setup: docker-compose up -d
PostgreSQL 16 with pgvector on :5432, Redis 7 on :6379."
```

---

### Task 5: Migrate database from SQLite to PostgreSQL

**Context:** The app currently uses SQLite (hardcoded in `__init__.py`). We need to switch to PostgreSQL for pgvector support. The config system in `backend/config/__init__.py` already has a ProductionConfig with PostgreSQL — we need to make DevelopmentConfig use it too, loaded from environment variables.

**Files:**
- Modify: `backend/my_project/__init__.py` (lines 13-31, config section)
- Modify: `backend/config/__init__.py` (DevelopmentConfig)
- Verify: `backend/my_project/models.py` (ensure no SQLite-specific code)

**Step 1:** Modify `backend/config/__init__.py` — update `DevelopmentConfig`:
```python
class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://sw_portal:sw_portal_dev@localhost:5432/sw_portal'
    )
    SQLALCHEMY_ECHO = False  # Set True for SQL debugging
```

**Step 2:** Modify `backend/my_project/__init__.py` — update `create_app()` to load config from environment and use the config system:
```python
import os
from dotenv import load_dotenv

load_dotenv()  # Load .env file

def create_app():
    app = Flask(__name__)

    # Load configuration from config classes
    env = os.environ.get('FLASK_ENV', 'development')
    from config import config as config_map
    app.config.from_object(config_map.get(env, config_map['development']))

    # Override with environment variables if present
    if os.environ.get('DATABASE_URL'):
        app.config['SQLALCHEMY_DATABASE_URI'] = os.environ['DATABASE_URL']
    if os.environ.get('SECRET_KEY'):
        app.config['SECRET_KEY'] = os.environ['SECRET_KEY']
    if os.environ.get('JWT_SECRET_KEY'):
        app.config['JWT_SECRET_KEY'] = os.environ['JWT_SECRET_KEY']

    # ... rest of create_app unchanged
```

**Step 3:** Enable pgvector in models. Add to top of `backend/my_project/models.py`:
```python
from pgvector.sqlalchemy import Vector
```
(This import will be used by new AI models in Task 9.)

**Step 4:** Test database creation:
```bash
cd backend
python -c "from my_project import create_app; app = create_app(); print('App created successfully')"
```
Expected: Tables created in PostgreSQL, seed data inserted, "App created successfully".

**Step 5:** Verify data in PostgreSQL:
```bash
docker exec -it sw_portal_db psql -U sw_portal -d sw_portal -c "SELECT username, role FROM \"user\";"
```
Expected: admin, staff, guest users visible.

**Step 6:** Commit:
```bash
git add backend/my_project/__init__.py backend/config/__init__.py backend/my_project/models.py
git commit -m "feat: migrate database from SQLite to PostgreSQL

Load config from environment via dotenv.
DevelopmentConfig now defaults to PostgreSQL+pgvector.
App factory reads DATABASE_URL from .env."
```

---

### Task 6: Fix authentication — replace all hardcoded user_id = 1

**Context:** 11 endpoints in `routes.py` have `user_id = 1` hardcoded instead of reading from JWT. The `get_current_user()` helper at line 224 also always returns user ID 1. This is the most critical security issue in the codebase.

**Files:**
- Modify: `backend/my_project/routes.py` — 12 locations (lines 224, 323, 365, 380, 504, 538, 609, 651, 677, 699, 725, 860)

**Step 1:** Write test for authenticated endpoint:
```python
# tests/test_api/test_auth_enforcement.py
import pytest

def test_protected_endpoint_requires_auth(client):
    """Endpoints must reject requests without JWT."""
    response = client.get('/api/user/permissions')
    assert response.status_code == 401

def test_protected_endpoint_works_with_auth(client, auth_headers):
    """Endpoints must work with valid JWT."""
    response = client.get('/api/user/permissions', headers=auth_headers)
    assert response.status_code == 200

def test_create_discussion_requires_auth(client):
    response = client.post('/api/discussions', json={
        'title': 'Test', 'content': 'Test', 'category_id': 1
    })
    assert response.status_code == 401

def test_ai_chat_requires_auth(client):
    response = client.post('/api/chat', json={'message': 'Hello'})
    assert response.status_code == 401
```

**Step 2:** Run tests to confirm they fail (because endpoints currently don't enforce auth):
```bash
cd backend && python -m pytest ../tests/test_api/test_auth_enforcement.py -v
```
Expected: `test_protected_endpoint_requires_auth` FAILS (returns 200 instead of 401).

**Step 3:** Fix `get_current_user()` helper in `routes.py` (around line 224):
```python
from flask_jwt_extended import jwt_required, get_jwt_identity

def get_current_user():
    """Get current authenticated user from JWT."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    return user
```

**Step 4:** For each of the 11 hardcoded locations, apply this pattern:

**Before** (typical pattern found):
```python
@main_bp.route('/api/some-endpoint', methods=['POST'])
def some_endpoint():
    user_id = 1  # Simplified - get from auth context
    # ... rest of function
```

**After:**
```python
@main_bp.route('/api/some-endpoint', methods=['POST'])
@jwt_required()
def some_endpoint():
    user_id = get_jwt_identity()
    # ... rest of function
```

Apply this to ALL 11 locations:
- Line ~323: `create_discussion()` — add `@jwt_required()`
- Line ~365: `create_post()` — add `@jwt_required()`
- Line ~380: `add_reaction()` — add `@jwt_required()`
- Line ~504: `upload_file()` — add `@jwt_required()`
- Line ~538: `get_conversations()` — add `@jwt_required()`
- Line ~609: `send_message()` — add `@jwt_required()`
- Line ~651: `update_user_profile()` — add `@jwt_required()`
- Line ~677: `get_notifications()` — add `@jwt_required()`
- Line ~699: `mark_notifications_read()` — add `@jwt_required()`
- Line ~725: `ai_chat()` — add `@jwt_required()`
- Line ~860: `get_user_permissions()` — add `@jwt_required()`

**Important:** Some read-only endpoints (GET categories, GET discussions list, GET files structure) should remain public. Only endpoints that create, modify, or return user-specific data need `@jwt_required()`.

**Step 5:** Run tests again:
```bash
cd backend && python -m pytest ../tests/test_api/test_auth_enforcement.py -v
```
Expected: ALL tests pass.

**Step 6:** Run full test suite to check nothing broke:
```bash
python scripts/run-tests.py --basic --verbose
```
Expected: All basic tests pass.

**Step 7:** Commit:
```bash
git add backend/my_project/routes.py tests/test_api/test_auth_enforcement.py
git commit -m "security: enforce JWT authentication on all protected endpoints

Replace 11 hardcoded user_id=1 with get_jwt_identity().
Add @jwt_required() decorator to all write/user-specific endpoints.
Add tests verifying auth enforcement."
```

---

## Phase 2: Port AI from Academicon (Day 3-4)

---

### Task 7: Create AI module structure and port embedding engine

**Context:** The Academicon project has a production-grade embedding engine in `backend/core/embeddings.py` that uses OpenAI's `text-embedding-3-small` API (no GPU needed). We port this to SW Portal as `backend/my_project/ai/embeddings.py`, adapting from async (FastAPI) to sync (Flask).

**Reference file:** `D:\Academicon\backend\core\embeddings.py` (534 lines)

**Files:**
- Create: `backend/my_project/ai/__init__.py`
- Create: `backend/my_project/ai/embeddings.py`
- Create: `tests/test_ai/__init__.py`
- Create: `tests/test_ai/test_embeddings.py`

**Step 1:** Create directory structure:
```bash
mkdir -p backend/my_project/ai
mkdir -p tests/test_ai
```

**Step 2:** Create `backend/my_project/ai/__init__.py`:
```python
"""AI module — embedding generation, knowledge search, and copilot chat."""
```

**Step 3:** Create `tests/test_ai/__init__.py` (empty).

**Step 4:** Write failing test `tests/test_ai/test_embeddings.py`:
```python
"""Tests for embedding engine."""
import pytest

def test_chunk_text_basic():
    """Text chunker should split text into chunks."""
    from my_project.ai.embeddings import chunk_text
    text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
    chunks = chunk_text(text, chunk_size=30, overlap=5)
    assert len(chunks) >= 2
    assert all(hasattr(c, 'content') for c in chunks)

def test_chunk_text_preserves_content():
    """All original content should appear in at least one chunk."""
    from my_project.ai.embeddings import chunk_text
    text = "Alpha. Bravo. Charlie. Delta. Echo."
    chunks = chunk_text(text, chunk_size=20, overlap=5)
    combined = " ".join(c.content for c in chunks)
    for word in ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]:
        assert word in combined

def test_chunk_text_empty():
    """Empty text should return empty list."""
    from my_project.ai.embeddings import chunk_text
    assert chunk_text("", chunk_size=100, overlap=10) == []
```

**Step 5:** Run test to verify it fails:
```bash
cd backend && python -m pytest ../tests/test_ai/test_embeddings.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'my_project.ai.embeddings'`

**Step 6:** Port and adapt `embeddings.py` from Academicon.

Create `backend/my_project/ai/embeddings.py`. This is an adapted version of `D:\Academicon\backend\core\embeddings.py`, converted from async to sync for Flask:

```python
"""
Embedding engine for SW Portal.
Ported from Academicon — API-based embeddings via OpenAI.
No GPU/torch required.
"""
import os
import hashlib
import logging
from dataclasses import dataclass, field
from typing import List, Optional

import openai
import tiktoken

logger = logging.getLogger(__name__)

# ── Data classes ──

@dataclass
class TextChunk:
    content: str
    chunk_index: int = 0
    chunk_type: str = "text"
    metadata: dict = field(default_factory=dict)

@dataclass
class EmbeddingResult:
    embedding: List[float]
    model: str
    text_hash: str
    token_count: int

# ── Text Chunking ──

def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> List[TextChunk]:
    """Split text into overlapping chunks using semantic boundaries.

    Hierarchy of split points: paragraphs > sentences > clauses > words.
    """
    if not text or not text.strip():
        return []

    # Normalize whitespace
    text = text.strip()

    # Try paragraph splits first
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: List[TextChunk] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}".strip() if current else para
        else:
            if current:
                chunks.append(TextChunk(
                    content=current,
                    chunk_index=len(chunks),
                ))
            # If paragraph itself exceeds chunk_size, split by sentences
            if len(para) > chunk_size:
                sentence_chunks = _split_by_sentences(para, chunk_size, overlap)
                for sc in sentence_chunks:
                    sc.chunk_index = len(chunks)
                    chunks.append(sc)
            else:
                current = para
                continue
            current = ""

    if current:
        chunks.append(TextChunk(content=current, chunk_index=len(chunks)))

    # Apply overlap
    if overlap > 0 and len(chunks) > 1:
        chunks = _apply_overlap(chunks, overlap)

    return chunks


def _split_by_sentences(text: str, chunk_size: int, overlap: int) -> List[TextChunk]:
    """Split text by sentence boundaries."""
    import re
    sentences = re.split(r'(?<=[.!?;])\s+', text)
    chunks = []
    current = ""

    for sent in sentences:
        if len(current) + len(sent) + 1 <= chunk_size:
            current = f"{current} {sent}".strip() if current else sent
        else:
            if current:
                chunks.append(TextChunk(content=current))
            current = sent

    if current:
        chunks.append(TextChunk(content=current))

    return chunks


def _apply_overlap(chunks: List[TextChunk], overlap: int) -> List[TextChunk]:
    """Add overlapping context between consecutive chunks."""
    result = [chunks[0]]
    for i in range(1, len(chunks)):
        prev_text = chunks[i - 1].content
        overlap_text = prev_text[-overlap:] if len(prev_text) > overlap else prev_text
        new_content = f"{overlap_text} {chunks[i].content}".strip()
        result.append(TextChunk(
            content=new_content,
            chunk_index=i,
            chunk_type=chunks[i].chunk_type,
            metadata=chunks[i].metadata,
        ))
    return result


# ── Embedding Generation ──

def _get_client() -> openai.OpenAI:
    """Get OpenAI client."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable not set")
    return openai.OpenAI(api_key=api_key)


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def generate_embedding(
    text: str,
    model: str = "text-embedding-3-small",
) -> EmbeddingResult:
    """Generate embedding vector for text via OpenAI API."""
    client = _get_client()
    enc = tiktoken.encoding_for_model(model)
    token_count = len(enc.encode(text))

    response = client.embeddings.create(model=model, input=text)
    embedding = response.data[0].embedding

    return EmbeddingResult(
        embedding=embedding,
        model=model,
        text_hash=_text_hash(text),
        token_count=token_count,
    )


def generate_embeddings_batch(
    texts: List[str],
    model: str = "text-embedding-3-small",
) -> List[EmbeddingResult]:
    """Generate embeddings for multiple texts in one API call."""
    if not texts:
        return []

    client = _get_client()
    enc = tiktoken.encoding_for_model(model)

    response = client.embeddings.create(model=model, input=texts)

    results = []
    for i, data in enumerate(response.data):
        results.append(EmbeddingResult(
            embedding=data.embedding,
            model=model,
            text_hash=_text_hash(texts[i]),
            token_count=len(enc.encode(texts[i])),
        ))
    return results
```

**Step 7:** Run tests:
```bash
cd backend && python -m pytest ../tests/test_ai/test_embeddings.py -v
```
Expected: ALL 3 tests pass.

**Step 8:** Commit:
```bash
git add backend/my_project/ai/ tests/test_ai/
git commit -m "feat: add AI embedding engine (ported from Academicon)

OpenAI API-based embeddings (text-embedding-3-small).
Semantic text chunking with paragraph/sentence boundaries.
No GPU or torch required — API-only approach."
```

---

### Task 8: Add AI database models (FileChunk, EmbeddingCache)

**Context:** We need database models to store document chunks with their vector embeddings for RAG search. These are adapted from Academicon's `FileChunk` model, using pgvector's `Vector` column type.

**Files:**
- Modify: `backend/my_project/models.py` — add FileChunk, DocumentIndex models
- Create: `tests/test_ai/test_models.py`

**Step 1:** Write failing test:
```python
# tests/test_ai/test_models.py
import pytest

def test_file_chunk_creation(app):
    """FileChunk model should store content and metadata."""
    with app.app_context():
        from my_project.extensions import db
        from my_project.models import FileChunk

        chunk = FileChunk(
            source_path="content/test.pdf",
            content="Test content for embedding",
            chunk_index=0,
            chunk_type="text",
        )
        db.session.add(chunk)
        db.session.commit()

        saved = FileChunk.query.first()
        assert saved.content == "Test content for embedding"
        assert saved.source_path == "content/test.pdf"
        assert saved.chunk_index == 0

def test_document_index_creation(app):
    """DocumentIndex should track processed documents."""
    with app.app_context():
        from my_project.extensions import db
        from my_project.models import DocumentIndex

        doc = DocumentIndex(
            file_path="content/ΝΟΜΟΘΕΣΙΑ/law1.pdf",
            file_name="law1.pdf",
            file_type="pdf",
            chunk_count=15,
            status="ready",
        )
        db.session.add(doc)
        db.session.commit()

        saved = DocumentIndex.query.first()
        assert saved.status == "ready"
        assert saved.chunk_count == 15
```

**Step 2:** Run test, verify fail:
```bash
cd backend && python -m pytest ../tests/test_ai/test_models.py -v
```
Expected: FAIL — `ImportError: cannot import name 'FileChunk'`

**Step 3:** Add models to `backend/my_project/models.py`. Append after existing models:

```python
class DocumentIndex(db.Model):
    """Tracks documents that have been processed for RAG."""
    __tablename__ = 'document_index'

    id = db.Column(db.Integer, primary_key=True)
    file_path = db.Column(db.String(500), unique=True, nullable=False)
    file_name = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(20))  # pdf, docx, txt
    file_hash = db.Column(db.String(64))  # SHA-256 for change detection
    chunk_count = db.Column(db.Integer, default=0)
    status = db.Column(db.String(20), default='pending')  # pending, processing, ready, error
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    chunks = db.relationship('FileChunk', backref='document', lazy='dynamic',
                            cascade='all, delete-orphan')


class FileChunk(db.Model):
    """A chunk of text from a processed document, with vector embedding."""
    __tablename__ = 'file_chunk'

    id = db.Column(db.Integer, primary_key=True)
    document_id = db.Column(db.Integer, db.ForeignKey('document_index.id'), index=True)
    source_path = db.Column(db.String(500), index=True)
    content = db.Column(db.Text, nullable=False)
    chunk_index = db.Column(db.Integer, default=0)
    chunk_type = db.Column(db.String(20), default='text')  # text, table, header
    embedding = db.Column(Vector(1536))  # OpenAI text-embedding-3-small dimension
    embedding_model = db.Column(db.String(50))
    text_hash = db.Column(db.String(64), index=True)  # For deduplication
    created_at = db.Column(db.DateTime, default=db.func.now())
```

**Note:** The `Vector` import from pgvector.sqlalchemy was added in Task 5. The dimension is 1536 for `text-embedding-3-small`.

**Step 4:** Recreate database tables (development only):
```bash
docker exec -it sw_portal_db psql -U sw_portal -d sw_portal -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION vector;"
cd backend && python -c "from my_project import create_app; app = create_app(); print('Tables recreated')"
```

**Step 5:** Run tests:
```bash
cd backend && python -m pytest ../tests/test_ai/test_models.py -v
```
Expected: PASS.

**Step 6:** Commit:
```bash
git add backend/my_project/models.py tests/test_ai/test_models.py
git commit -m "feat: add DocumentIndex and FileChunk models for RAG

DocumentIndex tracks processed documents with status.
FileChunk stores text chunks with pgvector embeddings.
Supports deduplication via text_hash."
```

---

### Task 9: Port knowledge service (document parsing + vector search)

**Context:** The Academicon `knowledge_service.py` (1,262 lines) handles file parsing, chunking, embedding, and hybrid search. We extract the essential parts: PDF/DOCX/TXT parsing, the embedding pipeline, and vector search. We skip BM25 hybrid search for now (vector-only is sufficient for demo).

**Reference:** `D:\Academicon\backend\services\knowledge_service.py`

**Files:**
- Create: `backend/my_project/ai/knowledge.py`
- Create: `tests/test_ai/test_knowledge.py`

**Step 1:** Write failing test:
```python
# tests/test_ai/test_knowledge.py
import pytest
import os

def test_parse_txt_content():
    """Should parse plain text files."""
    from my_project.ai.knowledge import parse_document_content
    result = parse_document_content("Test content here.", "test.txt", "txt")
    assert "Test content here." in result

def test_process_document_creates_chunks(app):
    """Processing a document should create chunks in the database."""
    with app.app_context():
        from my_project.ai.knowledge import process_document_text
        from my_project.models import FileChunk
        from my_project.extensions import db

        # Process a small text document
        process_document_text(
            text="First paragraph about social welfare.\n\nSecond paragraph about licensing.",
            source_path="test/doc.txt",
            file_name="doc.txt",
            file_type="txt",
        )

        chunks = FileChunk.query.filter_by(source_path="test/doc.txt").all()
        assert len(chunks) >= 1
        assert any("social welfare" in c.content for c in chunks)
```

**Step 2:** Run test, verify fail:
```bash
cd backend && python -m pytest ../tests/test_ai/test_knowledge.py -v
```
Expected: FAIL.

**Step 3:** Create `backend/my_project/ai/knowledge.py`:

```python
"""
Knowledge service for SW Portal.
Document parsing, chunking, embedding, and vector search.
Adapted from Academicon's knowledge_service.py.
"""
import os
import hashlib
import logging
from typing import List, Optional, Dict, Any

from my_project.extensions import db
from my_project.models import DocumentIndex, FileChunk
from my_project.ai.embeddings import chunk_text, generate_embedding, generate_embeddings_batch

logger = logging.getLogger(__name__)


# ── Document Parsing ──

def parse_document_content(content_or_path: str, filename: str, file_type: str) -> str:
    """Parse document and extract text content.

    For txt/md: content_or_path IS the text content.
    For pdf/docx: content_or_path is the file path on disk.
    """
    file_type = file_type.lower().strip(".")

    if file_type in ("txt", "md"):
        return content_or_path

    if file_type == "pdf":
        return _parse_pdf(content_or_path)

    if file_type == "docx":
        return _parse_docx(content_or_path)

    logger.warning(f"Unsupported file type: {file_type}")
    return ""


def _parse_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.error(f"PDF parsing error for {file_path}: {e}")
        return ""


def _parse_docx(file_path: str) -> str:
    """Extract text from DOCX."""
    try:
        from docx import Document
        doc = Document(file_path)
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        logger.error(f"DOCX parsing error for {file_path}: {e}")
        return ""


# ── Document Processing Pipeline ──

def process_document_text(
    text: str,
    source_path: str,
    file_name: str,
    file_type: str,
    generate_vectors: bool = False,
) -> DocumentIndex:
    """Process text into chunks and optionally generate embeddings.

    Args:
        text: The full text content of the document.
        source_path: Path relative to content/ directory.
        file_name: Original filename.
        file_type: File extension (pdf, docx, txt).
        generate_vectors: If True, call OpenAI API for embeddings.
    """
    # Check if already processed
    existing = DocumentIndex.query.filter_by(file_path=source_path).first()
    text_hash = hashlib.sha256(text.encode()).hexdigest()

    if existing and existing.file_hash == text_hash and existing.status == "ready":
        logger.info(f"Document already processed: {source_path}")
        return existing

    # Create or update document index
    if existing:
        doc_index = existing
        # Delete old chunks
        FileChunk.query.filter_by(document_id=doc_index.id).delete()
    else:
        doc_index = DocumentIndex(
            file_path=source_path,
            file_name=file_name,
            file_type=file_type,
        )
        db.session.add(doc_index)

    doc_index.status = "processing"
    doc_index.file_hash = text_hash
    db.session.flush()  # Get the ID

    # Chunk the text
    chunks = chunk_text(text, chunk_size=500, overlap=100)

    if not chunks:
        doc_index.status = "ready"
        doc_index.chunk_count = 0
        db.session.commit()
        return doc_index

    # Generate embeddings if requested
    embeddings = []
    if generate_vectors:
        try:
            embeddings = generate_embeddings_batch(
                [c.content for c in chunks]
            )
        except Exception as e:
            logger.error(f"Embedding generation failed for {source_path}: {e}")
            embeddings = []

    # Store chunks
    for i, chunk in enumerate(chunks):
        file_chunk = FileChunk(
            document_id=doc_index.id,
            source_path=source_path,
            content=chunk.content,
            chunk_index=i,
            chunk_type=chunk.chunk_type,
            text_hash=hashlib.sha256(chunk.content.encode()).hexdigest()[:16],
        )
        if embeddings and i < len(embeddings):
            file_chunk.embedding = embeddings[i].embedding
            file_chunk.embedding_model = embeddings[i].model

        db.session.add(file_chunk)

    doc_index.chunk_count = len(chunks)
    doc_index.status = "ready"
    db.session.commit()

    logger.info(f"Processed {source_path}: {len(chunks)} chunks")
    return doc_index


def process_file(file_path: str, generate_vectors: bool = False) -> Optional[DocumentIndex]:
    """Process a file from the filesystem into chunks."""
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return None

    file_name = os.path.basename(file_path)
    file_type = file_name.rsplit(".", 1)[-1] if "." in file_name else "txt"

    if file_type in ("txt", "md"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    else:
        text = parse_document_content(file_path, file_name, file_type)

    if not text.strip():
        logger.warning(f"No text extracted from {file_path}")
        return None

    return process_document_text(
        text=text,
        source_path=file_path,
        file_name=file_name,
        file_type=file_type,
        generate_vectors=generate_vectors,
    )


# ── Vector Search ──

def search_chunks(
    query: str,
    limit: int = 5,
    similarity_threshold: float = 0.3,
) -> List[Dict[str, Any]]:
    """Search for relevant document chunks using vector similarity.

    Uses pgvector's cosine distance operator for O(log n) search.
    """
    try:
        query_embedding_result = generate_embedding(query)
        query_vector = query_embedding_result.embedding
    except Exception as e:
        logger.error(f"Failed to generate query embedding: {e}")
        return _fallback_keyword_search(query, limit)

    # pgvector cosine distance search
    results = db.session.query(
        FileChunk,
        FileChunk.embedding.cosine_distance(query_vector).label("distance")
    ).filter(
        FileChunk.embedding.isnot(None)
    ).order_by(
        "distance"
    ).limit(limit * 2).all()

    chunks = []
    for chunk, distance in results:
        similarity = 1 - distance  # cosine_distance → similarity
        if similarity >= similarity_threshold:
            chunks.append({
                "content": chunk.content,
                "source_path": chunk.source_path,
                "chunk_type": chunk.chunk_type,
                "similarity": round(similarity, 4),
                "document_id": chunk.document_id,
            })

    return chunks[:limit]


def _fallback_keyword_search(query: str, limit: int) -> List[Dict[str, Any]]:
    """Simple keyword search fallback when vector search is unavailable."""
    keywords = query.lower().split()
    results = []

    all_chunks = FileChunk.query.limit(500).all()
    for chunk in all_chunks:
        content_lower = chunk.content.lower()
        score = sum(1 for kw in keywords if kw in content_lower)
        if score > 0:
            results.append({
                "content": chunk.content,
                "source_path": chunk.source_path,
                "chunk_type": chunk.chunk_type,
                "similarity": score / len(keywords),
                "document_id": chunk.document_id,
            })

    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]
```

**Step 4:** Run tests:
```bash
cd backend && python -m pytest ../tests/test_ai/test_knowledge.py -v
```
Expected: PASS.

**Step 5:** Commit:
```bash
git add backend/my_project/ai/knowledge.py tests/test_ai/test_knowledge.py
git commit -m "feat: add knowledge service with document parsing and vector search

Parse PDF, DOCX, TXT documents into chunks.
Store with pgvector embeddings for cosine similarity search.
Keyword fallback when embeddings unavailable."
```

---

### Task 10: Port copilot service (AI chat with RAG context)

**Context:** The Academicon `copilot_service.py` provides context-aware AI chat using RAG. We adapt it for the Greek social welfare domain — the system prompt instructs the LLM to act as a knowledgeable social welfare assistant, using retrieved document chunks as context.

**Reference:** `D:\Academicon\backend\services\copilot_service.py`

**Files:**
- Create: `backend/my_project/ai/copilot.py`
- Create: `tests/test_ai/test_copilot.py`

**Step 1:** Write test:
```python
# tests/test_ai/test_copilot.py
import pytest

def test_build_system_prompt():
    """System prompt should include Greek social welfare context."""
    from my_project.ai.copilot import build_system_prompt
    prompt = build_system_prompt()
    assert "κοινωνικ" in prompt.lower() or "social" in prompt.lower()

def test_build_messages_with_context():
    """Messages should include document context when provided."""
    from my_project.ai.copilot import build_messages
    context_chunks = [
        {"content": "Νόμος 4455/2017 περί αδειοδότησης", "source_path": "test.pdf"}
    ]
    messages = build_messages(
        user_message="Τι λέει ο νόμος για αδειοδότηση;",
        context_chunks=context_chunks,
        chat_history=[],
    )
    # Should have system + user messages
    assert messages[0]["role"] == "system"
    assert any("4455" in m.get("content", "") for m in messages)
```

**Step 2:** Run test, verify fail:
```bash
cd backend && python -m pytest ../tests/test_ai/test_copilot.py -v
```

**Step 3:** Create `backend/my_project/ai/copilot.py`:

```python
"""
Copilot service for SW Portal AI Assistant.
Context-aware chat using RAG over Greek social welfare documents.
Adapted from Academicon's copilot_service.py.
"""
import os
import logging
from typing import List, Dict, Any, Optional

import openai

from my_project.ai.knowledge import search_chunks

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Είσαι ο ψηφιακός βοηθός της Πύλης Κοινωνικής Μέριμνας (SW Portal), \
ένα εργαλείο για κοινωνικούς λειτουργούς στην Ελλάδα.

Ο ρόλος σου:
- Απαντάς σε ερωτήσεις σχετικά με τη νομοθεσία κοινωνικής μέριμνας
- Βοηθάς με θέματα αδειοδότησης δομών (ΚΑΑ, ΚΔΑΠ, ΚΕΦΙ, ΜΦΕ, ΣΥΔ)
- Εξηγείς διαδικασίες ελέγχων και εκθέσεων
- Καθοδηγείς στη συμπλήρωση εντύπων αιτήσεων
- Παρέχεις πληροφορίες για αποφάσεις επιτροπών

Κανόνες:
- Απαντάς ΠΑΝΤΑ στα ελληνικά
- Βασίζεσαι στα έγγραφα που σου παρέχονται ως context
- Αν δεν βρεις σχετική πληροφορία στα έγγραφα, το δηλώνεις ειλικρινά
- Αναφέρεις τις πηγές σου (ονόματα εγγράφων)
- Είσαι σαφής, ακριβής, και χρησιμοποιείς επαγγελματικό ύφος
"""


def build_system_prompt() -> str:
    """Return the system prompt for the copilot."""
    return SYSTEM_PROMPT


def build_messages(
    user_message: str,
    context_chunks: List[Dict[str, Any]],
    chat_history: List[Dict[str, str]],
) -> List[Dict[str, str]]:
    """Build the message array for the LLM call.

    Includes system prompt, document context, chat history, and user message.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add document context if available
    if context_chunks:
        context_text = "\n\n---\n\n".join(
            f"[Πηγή: {c.get('source_path', 'Άγνωστο')}]\n{c['content']}"
            for c in context_chunks
        )
        messages.append({
            "role": "system",
            "content": f"Σχετικά έγγραφα για την ερώτηση:\n\n{context_text}",
        })

    # Add chat history (last 6 messages)
    for msg in chat_history[-6:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", ""),
        })

    # Add current user message
    messages.append({"role": "user", "content": user_message})

    return messages


def get_chat_reply(
    user_message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
    use_rag: bool = True,
) -> Dict[str, Any]:
    """Generate an AI reply using RAG context from document chunks.

    Args:
        user_message: The user's question.
        chat_history: Previous messages in the conversation.
        use_rag: Whether to search documents for context.

    Returns:
        Dict with 'reply', 'sources', and 'context_used'.
    """
    if chat_history is None:
        chat_history = []

    # RAG: search for relevant document chunks
    context_chunks = []
    if use_rag:
        try:
            context_chunks = search_chunks(user_message, limit=5)
        except Exception as e:
            logger.error(f"RAG search failed: {e}")

    # Build messages
    messages = build_messages(user_message, context_chunks, chat_history)

    # Call LLM
    try:
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model=os.environ.get("LLM_MODEL", "gpt-4o-mini"),
            messages=messages,
            temperature=0.3,
            max_tokens=1500,
        )
        reply = response.choices[0].message.content
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        reply = ("Λυπάμαι, αντιμετώπισα τεχνικό πρόβλημα. "
                "Παρακαλώ δοκιμάστε ξανά σε λίγο.")

    # Extract sources
    sources = list(set(
        c.get("source_path", "") for c in context_chunks if c.get("source_path")
    ))

    return {
        "reply": reply,
        "sources": sources,
        "context_used": len(context_chunks) > 0,
        "chunks_found": len(context_chunks),
    }
```

**Step 4:** Run tests:
```bash
cd backend && python -m pytest ../tests/test_ai/test_copilot.py -v
```
Expected: PASS.

**Step 5:** Commit:
```bash
git add backend/my_project/ai/copilot.py tests/test_ai/test_copilot.py
git commit -m "feat: add copilot service for AI chat with RAG context

Greek social welfare domain system prompt.
Searches document chunks for relevant context before LLM call.
Returns reply with source references."
```

---

### Task 11: Create AI Flask routes and replace fake chat endpoint

**Context:** The current `/api/chat` endpoint in `routes.py` (line ~725) returns hardcoded Greek responses. We replace it with a real endpoint that calls the copilot service. We also add a knowledge search endpoint and a document ingestion trigger.

**Files:**
- Modify: `backend/my_project/routes.py` — replace `ai_chat()` function
- Create: `tests/test_api/test_ai_endpoints.py`

**Step 1:** Write test:
```python
# tests/test_api/test_ai_endpoints.py
import pytest

def test_chat_endpoint_exists(client, auth_headers):
    """Chat endpoint should accept POST with message."""
    response = client.post('/api/chat', json={
        'message': 'Τι είναι το ΚΔΑΠ;'
    }, headers=auth_headers)
    # Should return 200 (even if no documents loaded yet)
    assert response.status_code == 200
    data = response.get_json()
    assert 'reply' in data

def test_chat_requires_message(client, auth_headers):
    """Chat should reject empty message."""
    response = client.post('/api/chat', json={}, headers=auth_headers)
    assert response.status_code == 400

def test_knowledge_search_endpoint(client, auth_headers):
    """Knowledge search should accept query."""
    response = client.post('/api/knowledge/search', json={
        'query': 'αδειοδότηση'
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert 'results' in data
```

**Step 2:** Run test, verify fail.

**Step 3:** In `backend/my_project/routes.py`, replace the existing `ai_chat()` function (around line 725) with:

```python
@main_bp.route('/api/chat', methods=['POST'])
@jwt_required()
def ai_chat():
    """AI Assistant — chat with RAG context from social welfare documents."""
    data = request.get_json()
    message = data.get('message', '').strip()

    if not message:
        return jsonify({'error': 'Παρακαλώ εισάγετε μήνυμα'}), 400

    chat_history = data.get('chat_history', [])

    from my_project.ai.copilot import get_chat_reply
    result = get_chat_reply(
        user_message=message,
        chat_history=chat_history,
        use_rag=True,
    )

    return jsonify(result), 200
```

**Step 4:** Add knowledge search endpoint to `routes.py`:

```python
@main_bp.route('/api/knowledge/search', methods=['POST'])
@jwt_required()
def knowledge_search():
    """Search document chunks for relevant content."""
    data = request.get_json()
    query = data.get('query', '').strip()

    if not query:
        return jsonify({'error': 'Παρακαλώ εισάγετε ερώτημα αναζήτησης'}), 400

    limit = data.get('limit', 5)

    from my_project.ai.knowledge import search_chunks
    results = search_chunks(query, limit=limit)

    return jsonify({'results': results, 'count': len(results)}), 200


@main_bp.route('/api/knowledge/stats', methods=['GET'])
@jwt_required()
def knowledge_stats():
    """Get statistics about indexed documents."""
    from my_project.models import DocumentIndex, FileChunk

    total_docs = DocumentIndex.query.filter_by(status='ready').count()
    total_chunks = FileChunk.query.count()
    embedded_chunks = FileChunk.query.filter(FileChunk.embedding.isnot(None)).count()

    return jsonify({
        'total_documents': total_docs,
        'total_chunks': total_chunks,
        'embedded_chunks': embedded_chunks,
    }), 200
```

**Step 5:** Run tests:
```bash
cd backend && python -m pytest ../tests/test_api/test_ai_endpoints.py -v
```
Expected: PASS.

**Step 6:** Commit:
```bash
git add backend/my_project/routes.py tests/test_api/test_ai_endpoints.py
git commit -m "feat: replace fake AI chat with real RAG-powered endpoint

/api/chat now calls copilot service with document context.
Add /api/knowledge/search for direct chunk search.
Add /api/knowledge/stats for indexing statistics."
```

---

### Task 12: Create document ingestion script

**Context:** The `content/` directory contains Greek government documents (PDFs, DOCXs) organized in categories. We need a script to ingest all documents, chunk them, and generate embeddings. This runs once to populate the knowledge base for the demo.

**Files:**
- Create: `backend/scripts/ingest_documents.py`

**Step 1:** Create the ingestion script:

```python
#!/usr/bin/env python
"""
Ingest documents from content/ directory into the knowledge base.
Parses files, chunks text, and generates embeddings via OpenAI API.

Usage:
    python scripts/ingest_documents.py                  # Chunk only (no embeddings)
    python scripts/ingest_documents.py --embed           # Chunk + generate embeddings
    python scripts/ingest_documents.py --embed --dir content/ΝΟΜΟΘΕΣΙΑ  # Specific dir
"""
import os
import sys
import argparse
import time

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from my_project import create_app
from my_project.extensions import db
from my_project.ai.knowledge import process_file
from my_project.models import DocumentIndex, FileChunk

SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.doc', '.txt', '.md'}


def find_documents(base_dir: str) -> list:
    """Recursively find all supported documents."""
    documents = []
    for root, dirs, files in os.walk(base_dir):
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                documents.append(os.path.join(root, fname))
    return sorted(documents)


def main():
    parser = argparse.ArgumentParser(description="Ingest documents into knowledge base")
    parser.add_argument("--embed", action="store_true", help="Generate embeddings (requires OPENAI_API_KEY)")
    parser.add_argument("--dir", default=None, help="Specific directory to ingest (default: content/)")
    parser.add_argument("--reset", action="store_true", help="Clear all existing chunks before ingesting")
    args = parser.parse_args()

    app = create_app()

    with app.app_context():
        if args.reset:
            print("Clearing existing knowledge base...")
            FileChunk.query.delete()
            DocumentIndex.query.delete()
            db.session.commit()
            print("Done.")

        # Find content directory
        content_dir = args.dir or os.path.join(
            os.path.dirname(__file__), '..', '..', 'content'
        )
        content_dir = os.path.abspath(content_dir)

        if not os.path.exists(content_dir):
            print(f"Content directory not found: {content_dir}")
            print("Make sure the content/ directory exists with documents.")
            sys.exit(1)

        documents = find_documents(content_dir)
        print(f"Found {len(documents)} documents in {content_dir}")

        if not documents:
            print("No supported documents found.")
            return

        success = 0
        errors = 0
        start_time = time.time()

        for i, doc_path in enumerate(documents, 1):
            rel_path = os.path.relpath(doc_path, content_dir)
            print(f"[{i}/{len(documents)}] Processing: {rel_path}...", end=" ", flush=True)

            try:
                result = process_file(doc_path, generate_vectors=args.embed)
                if result:
                    print(f"OK ({result.chunk_count} chunks)")
                    success += 1
                else:
                    print("SKIP (no content)")
            except Exception as e:
                print(f"ERROR: {e}")
                errors += 1

        elapsed = time.time() - start_time
        total_chunks = FileChunk.query.count()
        embedded = FileChunk.query.filter(FileChunk.embedding.isnot(None)).count()

        print(f"\n{'='*50}")
        print(f"Ingestion complete in {elapsed:.1f}s")
        print(f"Documents: {success} OK, {errors} errors")
        print(f"Total chunks: {total_chunks}")
        print(f"Embedded chunks: {embedded}")
        print(f"{'='*50}")


if __name__ == "__main__":
    main()
```

**Step 2:** Test without embeddings first (faster, no API cost):
```bash
cd backend && python scripts/ingest_documents.py
```
Expected: Documents found, parsed, chunked. No embeddings generated.

**Step 3:** Test with embeddings (requires OPENAI_API_KEY in .env):
```bash
cd backend && python scripts/ingest_documents.py --embed
```
Expected: Documents chunked AND embedded. Check costs (~$0.01-0.05 for typical document set).

**Step 4:** Commit:
```bash
git add backend/scripts/ingest_documents.py
git commit -m "feat: add document ingestion script for knowledge base

Recursively scans content/ directory for PDF, DOCX, TXT files.
Parses, chunks, and optionally generates OpenAI embeddings.
Usage: python scripts/ingest_documents.py --embed"
```

---

## Phase 3: Frontend Polish & Demo (Day 5-6)

---

### Task 13: Enhance ChatWidget for real AI backend

**Context:** The existing `ChatWidget.jsx` (289 lines) is a floating chat bubble. It currently talks to the fake `/api/chat` endpoint. We need to update it to: (1) send chat history, (2) display source references, (3) show loading state properly, (4) render markdown in responses.

**Reference:** `D:\Academicon\frontend\src\components\CopilotWidget.jsx` for UI patterns.

**Files:**
- Modify: `frontend/src/components/ChatWidget.jsx`
- Install: `dompurify` package for XSS protection

**Step 1:** Install DOMPurify:
```bash
cd frontend && pnpm add dompurify
```

**Step 2:** Rewrite `ChatWidget.jsx` to handle real AI responses.

Key changes:
- Send `chat_history` array with each request
- Display `sources` from response
- Simple markdown rendering (bold, italics, lists)
- DOMPurify for XSS protection
- Suggested questions for first-time users
- Better error handling and loading states

The component should:
```jsx
// API call pattern:
const response = await api.post('/api/chat', {
    message: userMessage,
    chat_history: messages.map(m => ({
        role: m.type === 'user' ? 'user' : 'assistant',
        content: m.content
    })).slice(-6)  // Last 6 messages for context
});

// Response handling:
const { reply, sources, context_used } = response.data;
addMessage('assistant', reply, sources);
```

**Step 3:** Test manually:
- Start backend: `cd backend && python app.py`
- Start frontend: `cd frontend && pnpm dev`
- Login as admin/admin123
- Open chat widget
- Send a question
- Verify response comes from OpenAI (not hardcoded)
- Verify sources are displayed

**Step 4:** Commit:
```bash
git add frontend/src/components/ChatWidget.jsx frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat: upgrade ChatWidget for real AI assistant with RAG

Send chat history for contextual replies.
Display source document references.
Simple markdown rendering with DOMPurify XSS protection.
Suggested questions for first-time users."
```

---

### Task 14: Frontend cleanup — fix remaining issues

**Context:** With the backend now using PostgreSQL and real auth, the frontend needs adjustments. Verify all pages work, fix any broken API calls, ensure navigation is clean.

**Files:**
- Verify: `frontend/src/pages/HomePage.jsx`
- Verify: `frontend/src/pages/ApothecaryPage.jsx`
- Verify: `frontend/src/pages/ForumPage.jsx`
- Verify: `frontend/src/pages/AssistantPage.jsx`
- Modify: `frontend/src/pages/AssistantPage.jsx` — update to use new `/api/chat` response format if needed

**Step 1:** Start full app and test each page:
```bash
# Terminal 1:
docker-compose up -d
cd backend && python app.py

# Terminal 2:
cd frontend && pnpm dev
```

**Step 2:** Test login flow:
- Navigate to login page
- Login as admin/admin123
- Verify redirect to home
- Verify nav shows username

**Step 3:** Test each page:
- **HomePage:** Dashboard loads, stats display
- **Αποθήκη (ApothecaryPage):** Categories display, folders expand, files list
- **Forum (ForumPage):** Categories show, can create discussion, can post
- **AI Assistant (AssistantPage):** Full-page chat works (if separate from ChatWidget)
- **ChatWidget:** Floating bubble opens, sends messages, gets AI replies

**Step 4:** Fix any issues found during testing.

**Step 5:** Commit any fixes:
```bash
git add -A
git commit -m "fix: resolve frontend issues after backend migration

[Describe specific fixes here]"
```

---

### Task 15: Load demo data and test end-to-end

**Context:** For the demo, we need: (1) documents in the knowledge base with embeddings, (2) some forum discussions, (3) the AI assistant answering real questions about the documents.

**Files:**
- Run: `backend/scripts/ingest_documents.py --embed`
- Create: `backend/scripts/seed_demo_data.py` (optional — for forum discussions)

**Step 1:** Ensure content/ directory has documents:
```bash
ls content/
```
If empty or missing, the user should populate it with real Greek government documents.

**Step 2:** Run ingestion with embeddings:
```bash
cd backend && python scripts/ingest_documents.py --embed --reset
```
Verify output shows documents processed and embedded.

**Step 3:** Test AI search manually:
```bash
cd backend && python -c "
from my_project import create_app
from my_project.ai.knowledge import search_chunks
app = create_app()
with app.app_context():
    results = search_chunks('αδειοδότηση ΚΔΑΠ')
    for r in results:
        print(f'{r[\"similarity\"]:.3f} | {r[\"source_path\"]}')
        print(f'  {r[\"content\"][:100]}...')
        print()
"
```
Expected: Relevant chunks found with similarity scores.

**Step 4:** Test full demo flow:
1. Login as admin
2. Browse documents in Αποθήκη
3. Open AI Assistant, ask: "Ποια είναι η διαδικασία αδειοδότησης ΚΔΑΠ;"
4. Verify AI answers using document context
5. Go to Forum, create a discussion
6. Reply to the discussion

**Step 5:** Final commit:
```bash
git add -A
git commit -m "feat: demo-ready prototype with AI assistant

Knowledge base populated with government documents.
AI assistant answers questions using RAG over real documents.
All core features functional: document management, forum, AI chat."
```

---

## Post-Demo Backlog (Not in scope for this week)

These items are explicitly deferred:

1. **BM25 hybrid search** — Add full-text search + RRF fusion from Academicon
2. **Celery background processing** — Async document ingestion
3. **PII redaction** — spaCy + Greek BERT-NER for sensitive data removal
4. **Redis caching** — Cache embeddings to reduce API costs
5. **Private messaging** — Feature exists but not linked in nav
6. **Admin dashboard** — Analytics with real data
7. **Database migrations** — Alembic migration scripts
8. **CI/CD pipeline** — GitHub Actions for tests + deploy
9. **Production deployment** — Docker + Nginx + Gunicorn
10. **Refactor ApothecaryPage** — Break 597-line component into smaller pieces
