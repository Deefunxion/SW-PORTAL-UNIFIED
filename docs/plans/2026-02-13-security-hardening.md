# Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close every CRITICAL and HIGH vulnerability identified in the SW Portal security audit — CORS lockdown, auth enforcement on all endpoints, rate limiting, security headers, safe credential seeding, audit logging, PII warnings, AI disclaimers, GDPR deletion, and Docker secrets.

**Architecture:** All backend changes in the existing Flask app factory + single Blueprint pattern. No new services. New dependencies: `Flask-Limiter` (rate limiting), no `Flask-Talisman` (manual headers to avoid HTTPS enforcement in dev). New model: `AuditLog`. Frontend changes limited to two components (AssistantPage, ForumPage). PII detection is regex-only — no spaCy dependency (the existing `pii_redactor.py` requires ML deps we're not installing).

**Tech Stack:** Flask 2.3, Flask-Limiter, Flask-JWT-Extended 4.6, SQLAlchemy, React 18, Vite 6, shadcn/ui.

---

## Task 1: Lock down CORS to configured origins

**Files:**
- Modify: `backend/my_project/__init__.py:44`
- Modify: `backend/config/__init__.py:29,67`
- Test: `tests/test_api/test_security.py` (create)

**Step 1: Write the failing test**

Create `tests/test_api/test_security.py`:

```python
import pytest


def test_cors_rejects_unknown_origin(client):
    """CORS should reject requests from unknown origins."""
    response = client.get(
        '/api/health',
        headers={'Origin': 'https://evil.example.com'}
    )
    # Access-Control-Allow-Origin should NOT be set to the evil origin
    acao = response.headers.get('Access-Control-Allow-Origin')
    assert acao != 'https://evil.example.com'


def test_cors_allows_configured_origin(client):
    """CORS should accept requests from configured origins."""
    response = client.get(
        '/api/health',
        headers={'Origin': 'http://localhost:5173'}
    )
    acao = response.headers.get('Access-Control-Allow-Origin')
    assert acao == 'http://localhost:5173'
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api/test_security.py -v`
Expected: `test_cors_rejects_unknown_origin` FAILS because `*` matches everything.

**Step 3: Implement the fix**

In `backend/my_project/__init__.py`, change line 44 from:
```python
CORS(app, origins="*")
```
to:
```python
CORS(app, origins=app.config.get('CORS_ORIGINS', ['http://localhost:5173']))
```

In `backend/config/__init__.py`, update the `ProductionConfig.CORS_ORIGINS` (line 67):
```python
CORS_ORIGINS = [o.strip() for o in os.getenv('ALLOWED_ORIGINS', '').split(',') if o.strip()]
```

Also add `CORS_ORIGINS` to `TestingConfig`:
```python
CORS_ORIGINS = ['http://localhost', 'http://localhost:5173']
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_api/test_security.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/test_api/test_security.py backend/my_project/__init__.py backend/config/__init__.py
git commit -m "fix(security): lock CORS to configured origins instead of wildcard"
```

---

## Task 2: Protect unprotected endpoints (users, register, folders, conversations, messages)

**Files:**
- Modify: `backend/my_project/routes.py` (lines 194, 257, 518, 562, 590)
- Test: `tests/test_api/test_security.py` (append)

**Step 1: Write the failing tests**

Append to `tests/test_api/test_security.py`:

```python
def test_get_users_requires_auth(client):
    """GET /api/auth/users must require JWT."""
    response = client.get('/api/auth/users')
    assert response.status_code == 401


def test_register_requires_admin(client, auth_headers):
    """POST /api/auth/register must require admin role."""
    # Regular user (testuser, role=guest) should be forbidden
    response = client.post('/api/auth/register', json={
        'username': 'newbie', 'email': 'new@example.com', 'password': 'pass123'
    }, headers=auth_headers)
    assert response.status_code == 403


def test_create_folder_requires_auth(client):
    """POST /api/folders/create must require JWT."""
    response = client.post('/api/folders/create', json={
        'name': 'test_folder'
    })
    assert response.status_code == 401


def test_create_conversation_requires_auth(client):
    """POST /api/conversations must require JWT."""
    response = client.post('/api/conversations', json={
        'participants': [1, 2], 'title': 'Test'
    })
    assert response.status_code == 401


def test_get_messages_requires_auth(client):
    """GET /api/conversations/<id>/messages must require JWT."""
    response = client.get('/api/conversations/1/messages')
    assert response.status_code == 401
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_api/test_security.py -v -k "requires"`
Expected: All 5 new tests FAIL (200 instead of 401/403)

**Step 3: Implement the fixes**

In `backend/my_project/routes.py`:

a) Add admin role check helper (after `get_user_permissions_list` function around line 248):
```python
def require_admin():
    """Check if current user is admin. Returns error response or None."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    return None
```

b) Protect `GET /api/auth/users` (line 257-261):
```python
@main_bp.route('/api/auth/users', methods=['GET'])
@jwt_required()
def get_users():
    """Get all users (admin only)"""
    admin_check = require_admin()
    if admin_check:
        return admin_check
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])
```

c) Protect `POST /api/auth/register` (line 194-222):
```python
@main_bp.route('/api/auth/register', methods=['POST'])
@jwt_required()
def register():
    """User registration endpoint (admin only)"""
    admin_check = require_admin()
    if admin_check:
        return admin_check
    # ... rest unchanged
```

d) Protect `POST /api/folders/create` (line 518):
```python
@main_bp.route('/api/folders/create', methods=['POST'])
@jwt_required()
def create_folder():
```

e) Protect `POST /api/conversations` (line 562):
```python
@main_bp.route('/api/conversations', methods=['POST'])
@jwt_required()
def create_conversation():
```

f) Protect `GET /api/conversations/<id>/messages` (line 590):
```python
@main_bp.route('/api/conversations/<int:conversation_id>/messages', methods=['GET'])
@jwt_required()
def get_messages(conversation_id):
```

**Step 4: Fix conftest.py**

The `auth_headers` fixture uses `/api/auth/register` which now requires admin. We need to update `conftest.py` to create users directly via the ORM instead:

In `conftest.py`, replace the `auth_headers` fixture:
```python
@pytest.fixture
def auth_headers(app, client):
    """Create test user via ORM and return JWT headers."""
    from my_project.models import User
    from my_project.extensions import db

    with app.app_context():
        user = User.query.filter_by(username='testuser').first()
        if not user:
            user = User(username='testuser', email='test@example.com', role='guest')
            user.set_password('testpass123')
            db.session.add(user)
            db.session.commit()

    response = client.post('/api/auth/login', json={
        'username': 'testuser',
        'password': 'testpass123'
    })
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}
```

Also add an `admin_headers` fixture:
```python
@pytest.fixture
def admin_headers(app, client):
    """Create admin user via ORM and return JWT headers."""
    from my_project.models import User
    from my_project.extensions import db

    with app.app_context():
        user = User.query.filter_by(username='testadmin').first()
        if not user:
            user = User(username='testadmin', email='admin@test.com', role='admin')
            user.set_password('adminpass123')
            db.session.add(user)
            db.session.commit()

    response = client.post('/api/auth/login', json={
        'username': 'testadmin',
        'password': 'adminpass123'
    })
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}
```

**Step 5: Run all tests**

Run: `python -m pytest tests/ -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/my_project/routes.py conftest.py tests/test_api/test_security.py
git commit -m "fix(security): protect all unprotected endpoints with JWT + admin checks

GET /api/auth/users now requires admin JWT.
POST /api/auth/register now requires admin JWT.
POST /api/folders/create now requires JWT.
POST /api/conversations now requires JWT.
GET /api/conversations/<id>/messages now requires JWT."
```

---

## Task 3: Add rate limiting to login and AI chat

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/my_project/__init__.py`
- Modify: `backend/my_project/routes.py`
- Test: `tests/test_api/test_security.py` (append)

**Step 1: Write the failing test**

Append to `tests/test_api/test_security.py`:

```python
def test_login_rate_limited(client):
    """Login should be rate-limited after too many failed attempts."""
    # Make 6 rapid failed login attempts (limit is 5/minute)
    for i in range(6):
        response = client.post('/api/auth/login', json={
            'username': 'nonexistent',
            'password': 'wrong'
        })
    # The 6th request should be rate-limited
    assert response.status_code == 429
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api/test_security.py::test_login_rate_limited -v`
Expected: FAIL (401 instead of 429, since no rate limiter exists)

**Step 3: Install Flask-Limiter**

Add to `backend/requirements.txt`:
```
# Rate Limiting
Flask-Limiter>=3.5.0
```

Run: `pip install Flask-Limiter`

**Step 4: Implement rate limiting**

In `backend/my_project/extensions.py`, add:
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri="memory://",
    default_limits=[]
)
```

In `backend/my_project/__init__.py`, after `db.init_app(app)`, add:
```python
from .extensions import limiter
limiter.init_app(app)
```

In `backend/my_project/routes.py`, import the limiter and apply to endpoints:
```python
from .extensions import limiter
```

On the login route:
```python
@main_bp.route('/api/auth/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
```

On the AI chat route:
```python
@main_bp.route('/api/chat', methods=['POST'])
@jwt_required()
@limiter.limit("20 per minute")
def ai_chat():
```

**Step 5: Run tests**

Run: `python -m pytest tests/test_api/test_security.py -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/requirements.txt backend/my_project/extensions.py backend/my_project/__init__.py backend/my_project/routes.py tests/test_api/test_security.py
git commit -m "feat(security): add rate limiting to login (5/min) and AI chat (20/min)"
```

---

## Task 4: Add security headers via after_request

**Files:**
- Modify: `backend/my_project/__init__.py`
- Test: `tests/test_api/test_security.py` (append)

**Step 1: Write the failing test**

Append to `tests/test_api/test_security.py`:

```python
def test_security_headers_present(client):
    """Responses should include security headers."""
    response = client.get('/api/health')
    assert response.headers.get('X-Content-Type-Options') == 'nosniff'
    assert response.headers.get('X-Frame-Options') == 'DENY'
    assert response.headers.get('X-XSS-Protection') == '1; mode=block'
    assert 'Referrer-Policy' in response.headers
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api/test_security.py::test_security_headers_present -v`
Expected: FAIL

**Step 3: Implement security headers**

In `backend/my_project/__init__.py`, before `return app` (around line 158), add:

```python
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        if not app.debug:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
            response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
        return response
```

**Step 4: Run tests**

Run: `python -m pytest tests/test_api/test_security.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/my_project/__init__.py tests/test_api/test_security.py
git commit -m "feat(security): add X-Frame-Options, X-Content-Type-Options, CSP, and other security headers"
```

---

## Task 5: Conditional demo credential seeding

**Files:**
- Modify: `backend/my_project/__init__.py:111-130`
- Modify: `backend/config/__init__.py`
- Test: `tests/test_api/test_security.py` (append)

**Step 1: Write the failing test**

Append to `tests/test_api/test_security.py`:

```python
def test_demo_users_not_seeded_in_production():
    """Demo users should not be seeded in production mode."""
    import os
    os.environ['FLASK_ENV'] = 'production'
    os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
    os.environ['SECRET_KEY'] = 'prod-secret-key-long-enough-for-hmac'
    os.environ['JWT_SECRET_KEY'] = 'prod-jwt-secret-key-long-enough-for-hmac'

    from my_project import create_app
    from my_project.extensions import db
    from my_project.models import User

    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(username='admin').first()
        assert admin is None, "Demo admin user should not exist in production"

    # Restore testing env
    os.environ['FLASK_ENV'] = 'testing'
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api/test_security.py::test_demo_users_not_seeded_in_production -v`
Expected: FAIL (admin user exists)

**Step 3: Implement conditional seeding**

In `backend/my_project/__init__.py`, wrap the user seeding block (lines 111-130) with a debug check:

```python
        # Seed demo data ONLY in development mode
        if app.debug:
            try:
                if User.query.count() == 0:
                    print("Seeding database with default users...")
                    default_users = [
                        {'username': 'admin', 'email': 'admin@portal.gr', 'password': 'admin123', 'role': 'admin'},
                        {'username': 'staff', 'email': 'staff@portal.gr', 'password': 'staff123', 'role': 'staff'},
                        {'username': 'guest', 'email': 'guest@portal.gr', 'password': 'guest123', 'role': 'guest'}
                    ]
                    for user_data in default_users:
                        new_user = User(
                            username=user_data['username'],
                            email=user_data['email'],
                            role=user_data['role']
                        )
                        new_user.set_password(user_data['password'])
                        db.session.add(new_user)
                    db.session.commit()
                    print("Default users created.")
            except Exception:
                db.session.rollback()
```

Also add `SEED_DEMO_PASSWORD` config variable documentation to `.env.example`:
```
# Demo credentials (development only — ignored in production)
SEED_ADMIN_PASSWORD=admin123
```

**Step 4: Run tests**

Run: `python -m pytest tests/test_api/test_security.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/my_project/__init__.py .env.example tests/test_api/test_security.py
git commit -m "fix(security): only seed demo users in development mode (app.debug=True)"
```

---

## Task 6: Add audit logging model and logging hooks

**Files:**
- Modify: `backend/my_project/models.py`
- Create: `backend/my_project/audit.py`
- Modify: `backend/my_project/routes.py`
- Test: `tests/test_api/test_security.py` (append)

**Step 1: Write the failing test**

Append to `tests/test_api/test_security.py`:

```python
def test_login_creates_audit_log(client, app):
    """Successful login should create an audit log entry."""
    # Ensure a user exists
    from my_project.models import User, AuditLog
    from my_project.extensions import db

    with app.app_context():
        user = User.query.filter_by(username='audituser').first()
        if not user:
            user = User(username='audituser', email='audit@test.com', role='guest')
            user.set_password('auditpass123')
            db.session.add(user)
            db.session.commit()

    client.post('/api/auth/login', json={
        'username': 'audituser',
        'password': 'auditpass123'
    })

    with app.app_context():
        logs = AuditLog.query.filter_by(action='login').all()
        assert len(logs) >= 1
        assert logs[-1].resource == 'auth'


def test_failed_login_creates_audit_log(client, app):
    """Failed login should also create an audit log entry."""
    from my_project.models import AuditLog

    client.post('/api/auth/login', json={
        'username': 'nonexistent',
        'password': 'wrongpass'
    })

    with app.app_context():
        logs = AuditLog.query.filter_by(action='login_failed').all()
        assert len(logs) >= 1
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api/test_security.py::test_login_creates_audit_log -v`
Expected: FAIL (AuditLog doesn't exist)

**Step 3: Create the AuditLog model**

Add to `backend/my_project/models.py` (at the end, before any closing comments):

```python
# ============================================================================
# AUDIT LOG MODEL
# ============================================================================

class AuditLog(db.Model):
    """Tracks security-relevant actions for compliance."""
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(100), nullable=False)  # login, login_failed, upload, delete, admin_action
    resource = db.Column(db.String(100))  # auth, file, discussion, user
    resource_id = db.Column(db.String(100))  # ID of the affected resource
    details = db.Column(db.Text)  # JSON string with extra context
    ip_address = db.Column(db.String(45))  # IPv4 or IPv6
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='audit_logs')
```

**Step 4: Create the audit helper module**

Create `backend/my_project/audit.py`:

```python
"""Audit logging helpers for security-relevant actions."""
from flask import request
from .extensions import db
from .models import AuditLog


def log_action(action, resource=None, resource_id=None, user_id=None, details=None):
    """Record an audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource=resource,
        resource_id=str(resource_id) if resource_id else None,
        details=details,
        ip_address=request.remote_addr if request else None,
    )
    db.session.add(entry)
    # Don't commit here — let the caller's transaction handle it,
    # or commit explicitly for fire-and-forget logging
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
```

**Step 5: Wire audit logging into routes**

In `backend/my_project/routes.py`, add import:
```python
from .audit import log_action
```

In the `login()` function, after the successful login commit (line ~181):
```python
        log_action('login', resource='auth', user_id=user.id)
```

And in the failed login branch (line ~191):
```python
        log_action('login_failed', resource='auth', details=f'username={username}')
```

In `upload_file()`, after the commit (line ~513):
```python
        log_action('upload', resource='file', resource_id=file_item.id, user_id=user_id)
```

**Step 6: Update model import in __init__.py**

In `backend/my_project/__init__.py`, update the model import line (around line 97) to include AuditLog:
```python
from .models import User, Category, Discussion, Post, FileItem, AuditLog
```

**Step 7: Run tests**

Run: `python -m pytest tests/test_api/test_security.py -v`
Expected: ALL PASS

**Step 8: Commit**

```bash
git add backend/my_project/models.py backend/my_project/audit.py backend/my_project/routes.py backend/my_project/__init__.py tests/test_api/test_security.py
git commit -m "feat(security): add AuditLog model and log login/upload actions"
```

---

## Task 7: Add AI hallucination disclaimer (backend + frontend)

**Files:**
- Modify: `backend/my_project/ai/copilot.py:131`
- Modify: `frontend/src/pages/AssistantPage.jsx`
- Test: `tests/test_api/test_security.py` (append)

**Step 1: Write the failing test**

Append to `tests/test_api/test_security.py`:

```python
def test_ai_reply_includes_disclaimer():
    """AI replies should include advisory disclaimer."""
    from my_project.ai.copilot import DISCLAIMER_TEXT
    assert 'ενδεικτικές' in DISCLAIMER_TEXT or 'ενδεικτικός' in DISCLAIMER_TEXT
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api/test_security.py::test_ai_reply_includes_disclaimer -v`
Expected: FAIL (DISCLAIMER_TEXT not defined)

**Step 3: Add disclaimer to copilot.py**

In `backend/my_project/ai/copilot.py`, add after the SYSTEM_PROMPT constant:

```python
DISCLAIMER_TEXT = (
    "\n\n---\n"
    "*Οι απαντήσεις του AI Βοηθού είναι ενδεικτικές και συμβουλευτικού χαρακτήρα. "
    "Ελέγξτε πάντα με την ισχύουσα νομοθεσία και τις επίσημες εγκυκλίους.*"
)
```

In the `get_chat_reply()` function, modify the return to append the disclaimer to every reply (around line 131):

```python
    return {
        "reply": reply + DISCLAIMER_TEXT,
        "sources": sources,
        "context_used": len(context_chunks) > 0,
        "chunks_found": len(context_chunks),
    }
```

**Step 4: Add persistent banner to AssistantPage**

In `frontend/src/pages/AssistantPage.jsx`, add an `AlertTriangle` import from lucide-react, and insert a disclaimer banner right after the `<header>` section (after line 113):

```jsx
      {/* AI Disclaimer Banner */}
      <div className="mb-6 sm:mb-8 bg-amber-50 border border-amber-200 rounded-xl px-4 sm:px-6 py-3 sm:py-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm sm:text-base text-amber-800 font-medium leading-relaxed">
          Οι απαντήσεις του AI Βοηθού είναι <strong>ενδεικτικές και συμβουλευτικού χαρακτήρα</strong>.
          Ελέγξτε πάντα με την ισχύουσα νομοθεσία και τις επίσημες εγκυκλίους.
        </p>
      </div>
```

**Step 5: Run tests**

Run: `python -m pytest tests/test_api/test_security.py::test_ai_reply_includes_disclaimer -v`
Expected: PASS

**Step 6: Commit**

```bash
git add backend/my_project/ai/copilot.py frontend/src/pages/AssistantPage.jsx tests/test_api/test_security.py
git commit -m "feat(compliance): add AI hallucination disclaimer to every response and frontend banner"
```

---

## Task 8: Add PII warning banner in forum post creation

**Files:**
- Modify: `frontend/src/pages/ForumPage.jsx`

**Step 1: Identify the forum post creation UI**

The forum creation UI is in `frontend/src/pages/ForumPage.jsx`. Look for the form/modal where users create new discussions or reply to posts. Add a warning banner inside the form.

**Step 2: Add PII warning banner**

In the create discussion form section of `ForumPage.jsx`, before the submit button, add:

```jsx
<div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 flex items-start gap-3 mb-4">
  <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
  <p className="text-sm text-orange-700">
    <strong>Προσοχή:</strong> Μην αναφέρετε ονόματα πολιτών, αριθμούς υποθέσεων ή άλλα προσωπικά δεδομένα
    στις δημοσιεύσεις του φόρουμ.
  </p>
</div>
```

Import `AlertTriangle` from `lucide-react` if not already imported.

**Step 3: Commit**

```bash
git add frontend/src/pages/ForumPage.jsx
git commit -m "feat(compliance): add PII warning banner to forum post creation form"
```

---

## Task 9: Add GDPR user deletion endpoint (admin-only)

**Files:**
- Modify: `backend/my_project/routes.py`
- Test: `tests/test_api/test_security.py` (append)

**Step 1: Write the failing test**

Append to `tests/test_api/test_security.py`:

```python
def test_delete_user_requires_admin(client, auth_headers):
    """DELETE /api/admin/users/<id> must require admin role."""
    response = client.delete('/api/admin/users/999', headers=auth_headers)
    assert response.status_code == 403


def test_delete_user_anonymizes_data(client, admin_headers, app):
    """Admin can anonymize a user's data (GDPR right to erasure)."""
    from my_project.models import User
    from my_project.extensions import db

    # Create a user to delete
    with app.app_context():
        user = User(username='to_delete', email='delete@test.com', role='guest')
        user.set_password('pass123')
        db.session.add(user)
        db.session.commit()
        user_id = user.id

    response = client.delete(f'/api/admin/users/{user_id}', headers=admin_headers)
    assert response.status_code == 200

    with app.app_context():
        user = User.query.get(user_id)
        assert user.username.startswith('deleted_')
        assert user.email.startswith('deleted_')
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_api/test_security.py::test_delete_user_anonymizes_data -v`
Expected: FAIL (404, route doesn't exist)

**Step 3: Implement the endpoint**

In `backend/my_project/routes.py`, add a new admin section:

```python
# ============================================================================
# ADMIN ROUTES
# ============================================================================

@main_bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def delete_user(user_id):
    """Anonymize a user's data (GDPR right to erasure). Admin only."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Don't allow deleting yourself
    current_user_id = int(get_jwt_identity())
    if user.id == current_user_id:
        return jsonify({'error': 'Cannot delete your own account'}), 400

    # Anonymize instead of hard delete to preserve referential integrity
    user.username = f'deleted_{user.id}'
    user.email = f'deleted_{user.id}@removed.local'
    user.password_hash = 'ANONYMIZED'
    user.presence_status = 'offline'

    # Anonymize profile if exists
    from .models import UserProfile
    profile = UserProfile.query.filter_by(user_id=user.id).first()
    if profile:
        profile.display_name = None
        profile.bio = None
        profile.location = None
        profile.website = None
        profile.avatar_url = None
        profile.phone = None
        profile.birth_date = None

    db.session.commit()

    log_action('user_deleted', resource='user', resource_id=user_id,
               user_id=current_user_id)

    return jsonify({'message': f'User {user_id} anonymized successfully'})
```

**Step 4: Run tests**

Run: `python -m pytest tests/test_api/test_security.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/my_project/routes.py tests/test_api/test_security.py
git commit -m "feat(gdpr): add admin-only user anonymization endpoint (right to erasure)"
```

---

## Task 10: Move Docker secrets to environment variables

**Files:**
- Modify: `docker-compose.yml`
- Modify: `.env.example`

**Step 1: Update docker-compose.yml**

Replace the hardcoded password with an env variable:

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    container_name: sw_portal_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-sw_portal}
      POSTGRES_USER: ${POSTGRES_USER:-sw_portal}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env}
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

**Step 2: Update .env.example**

Add:
```
# Docker (PostgreSQL)
POSTGRES_DB=sw_portal
POSTGRES_USER=sw_portal
POSTGRES_PASSWORD=sw_portal_dev
```

**Step 3: Create/update local .env**

Ensure the local `.env` file has `POSTGRES_PASSWORD=sw_portal_dev` so Docker Compose still works for developers.

**Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "fix(security): move Docker Postgres password to .env variable"
```

---

## Task 11: Add backup script for PostgreSQL

**Files:**
- Create: `scripts/backup.sh`

**Step 1: Create the backup script**

Create `scripts/backup.sh`:

```bash
#!/bin/bash
# SW Portal Database Backup Script
# Usage: ./scripts/backup.sh
# Cron:  0 2 * * * /path/to/scripts/backup.sh >> /var/log/sw_portal_backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_CONTAINER="${DB_CONTAINER:-sw_portal_db}"
DB_NAME="${POSTGRES_DB:-sw_portal}"
DB_USER="${POSTGRES_USER:-sw_portal}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/sw_portal_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"

echo "[$(date)] Backup saved to: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Clean up old backups
find "$BACKUP_DIR" -name "sw_portal_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Cleaned backups older than $RETENTION_DAYS days."
```

**Step 2: Make executable and add to .gitignore**

```bash
chmod +x scripts/backup.sh
```

Add `backups/` to `.gitignore`.

**Step 3: Commit**

```bash
git add scripts/backup.sh .gitignore
git commit -m "feat(ops): add PostgreSQL backup script with rotation"
```

---

## Task 12: Document AI data residency limitation

**Files:**
- Modify: `backend/my_project/ai/copilot.py` (add module-level docstring note)

**Step 1: Add data residency note**

At the top of `backend/my_project/ai/copilot.py`, update the module docstring:

```python
"""
Copilot service for SW Portal AI Assistant.
Context-aware chat using RAG over Greek social welfare documents.
Adapted from Academicon's copilot_service.py.

DATA RESIDENCY NOTE:
Document chunks are sent to OpenAI's API (US-based servers) for embedding
and chat completion. Only public legislation and official guidelines should
be stored in the knowledge base. Do NOT ingest documents containing citizen
PII or case-specific data. For on-premises deployment, the LLM client can
be swapped to a local Ollama instance by setting LLM_BASE_URL env var.
"""
```

**Step 2: Commit**

```bash
git add backend/my_project/ai/copilot.py
git commit -m "docs: add data residency warning to AI copilot module"
```

---

## Task 13: Run full test suite and verify all changes

**Step 1: Run all backend tests**

```bash
python -m pytest tests/ -v --tb=short
```

Expected: ALL PASS

**Step 2: Run frontend build check**

```bash
cd frontend && npx pnpm build
```

Expected: Build succeeds with no errors.

**Step 3: Commit any remaining fixes**

If any tests fail, fix them and commit:
```bash
git add -A
git commit -m "fix: address test failures from security hardening"
```

---

## Summary of changes

| # | Risk | Fix | Files |
|---|------|-----|-------|
| 1 | Open CORS | Lock to `CORS_ORIGINS` config | `__init__.py`, `config/__init__.py` |
| 2 | Unprotected endpoints | Add `@jwt_required()` + admin checks | `routes.py`, `conftest.py` |
| 3 | No rate limiting | Flask-Limiter on login (5/min), chat (20/min) | `routes.py`, `extensions.py`, `requirements.txt` |
| 4 | No security headers | `@app.after_request` headers | `__init__.py` |
| 5 | Demo credentials | Only seed when `app.debug` is True | `__init__.py` |
| 6 | No audit logging | `AuditLog` model + `log_action()` helper | `models.py`, `audit.py`, `routes.py` |
| 7 | AI hallucination | Disclaimer appended to replies + frontend banner | `copilot.py`, `AssistantPage.jsx` |
| 8 | PII in forum | Warning banner on post creation | `ForumPage.jsx` |
| 9 | No GDPR deletion | Admin endpoint to anonymize user data | `routes.py` |
| 10 | Docker secrets | `${POSTGRES_PASSWORD}` with .env | `docker-compose.yml`, `.env.example` |
| 11 | No backups | `scripts/backup.sh` with pg_dump + rotation | `scripts/backup.sh` |
| 12 | AI data residency | Docstring documentation | `copilot.py` |

**Not addressed (infrastructure-level, out of scope for code changes):**
- **#11 (SQLite):** PostgreSQL is already the default. SQLite only used in tests.
- **#14 (HTTPS):** Requires reverse proxy (nginx/Render handles this). Not a code change.
