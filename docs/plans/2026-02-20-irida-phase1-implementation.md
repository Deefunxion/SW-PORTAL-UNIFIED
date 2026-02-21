# IRIDA Integration Phase 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable Social Advisors to send advisor reports to IRIDA directly from the Portal, using their own IRIDA credentials stored encrypted in their profile.

**Architecture:** Per-user encrypted credential storage (Fernet). New `IridaTransaction` model tracks every send. Backend routes handle credential management and the send flow. Frontend adds an IRIDA credentials section to ProfilePage and a "Κατάθεση σε ΙΡΙΔΑ" section to the advisor report view.

**Tech Stack:** Flask, SQLAlchemy, cryptography (Fernet), httpx, reportlab (PDF), React 18, shadcn/ui, Axios

**Design doc:** `docs/plans/2026-02-20-irida-integration-design.md`

---

### Task 1: Add `cryptography` dependency and encryption utilities

**Files:**
- Modify: `backend/requirements.txt:36` (add cryptography)
- Modify: `.env.example:26` (add IRIDA_ENCRYPTION_KEY and IRIDA_DEMO)
- Create: `backend/my_project/integrations/irida_crypto.py`
- Create: `tests/test_irida/test_crypto.py`
- Create: `tests/test_irida/__init__.py`

**Step 1: Write the failing test**

Create `tests/test_irida/__init__.py` (empty file) and `tests/test_irida/test_crypto.py`:

```python
"""Tests for IRIDA credential encryption."""
import os
import pytest

# Set a test encryption key before importing
os.environ['IRIDA_ENCRYPTION_KEY'] = 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXk='  # base64 of 32 bytes


class TestIridaCrypto:
    def test_encrypt_decrypt_roundtrip(self):
        from my_project.integrations.irida_crypto import encrypt_credential, decrypt_credential
        plaintext = 'my-secret-password'
        encrypted = encrypt_credential(plaintext)
        assert encrypted != plaintext
        assert decrypt_credential(encrypted) == plaintext

    def test_encrypt_produces_different_ciphertexts(self):
        from my_project.integrations.irida_crypto import encrypt_credential
        a = encrypt_credential('same')
        b = encrypt_credential('same')
        # Fernet uses random IV, so ciphertexts differ
        assert a != b

    def test_decrypt_bad_data_raises(self):
        from my_project.integrations.irida_crypto import decrypt_credential
        with pytest.raises(Exception):
            decrypt_credential('not-valid-fernet-token')

    def test_missing_key_raises(self):
        """If IRIDA_ENCRYPTION_KEY is unset, operations should raise."""
        from my_project.integrations import irida_crypto
        original = os.environ.get('IRIDA_ENCRYPTION_KEY')
        try:
            os.environ.pop('IRIDA_ENCRYPTION_KEY', None)
            # Force re-read of key
            irida_crypto._fernet = None
            with pytest.raises(RuntimeError, match='IRIDA_ENCRYPTION_KEY'):
                irida_crypto.encrypt_credential('test')
        finally:
            if original:
                os.environ['IRIDA_ENCRYPTION_KEY'] = original
                irida_crypto._fernet = None
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_irida/test_crypto.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'my_project.integrations.irida_crypto'`

**Step 3: Install cryptography and create the module**

Add to `backend/requirements.txt` after the Utilities section:

```
# Encryption
cryptography>=42.0.0
```

Run: `pip install cryptography`

Create `backend/my_project/integrations/irida_crypto.py`:

```python
"""Fernet encryption for IRIDA credentials stored in user profiles.

Uses IRIDA_ENCRYPTION_KEY env var (base64-encoded 32-byte key).
If the key is missing, auto-generates one and prints a warning.
"""
import os
import base64
import logging
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

_fernet = None


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet

    key = os.environ.get('IRIDA_ENCRYPTION_KEY')
    if not key:
        raise RuntimeError(
            'IRIDA_ENCRYPTION_KEY is not set. '
            'Generate one with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
        )

    _fernet = Fernet(key.encode() if isinstance(key, str) else key)
    return _fernet


def encrypt_credential(plaintext: str) -> str:
    """Encrypt a credential string. Returns base64-encoded ciphertext."""
    f = _get_fernet()
    return f.encrypt(plaintext.encode('utf-8')).decode('utf-8')


def decrypt_credential(ciphertext: str) -> str:
    """Decrypt a credential string. Returns plaintext."""
    f = _get_fernet()
    return f.decrypt(ciphertext.encode('utf-8')).decode('utf-8')


def generate_key() -> str:
    """Generate a new Fernet key. Utility for .env setup."""
    return Fernet.generate_key().decode('utf-8')
```

Update `.env.example` — add after existing IRIDA vars:

```
IRIDA_DEMO=false
IRIDA_ENCRYPTION_KEY=
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_irida/test_crypto.py -v`
Expected: 4 passed

**Step 5: Commit**

```bash
git add backend/requirements.txt backend/my_project/integrations/irida_crypto.py tests/test_irida/ .env.example
git commit -m "feat(irida): add Fernet encryption utilities for IRIDA credentials"
```

---

### Task 2: Add IRIDA credential fields to User model

**Files:**
- Modify: `backend/my_project/models.py:18-49` (User class)
- Modify: `backend/my_project/__init__.py:142-171` (auto-migration list)
- Create: `tests/test_irida/test_user_irida_fields.py`

**Step 1: Write the failing test**

Create `tests/test_irida/test_user_irida_fields.py`:

```python
"""Tests for User model IRIDA fields."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXk=')


class TestUserIridaFields:
    def test_user_has_irida_fields(self, app):
        with app.app_context():
            from my_project.models import User
            user = User(username='irida_test', email='irida@test.com', role='staff')
            user.set_password('pass123')
            assert user.irida_username is None
            assert user.irida_password is None
            assert user.irida_x_profile is None
            assert user.irida_base_url is None

    def test_user_to_dict_excludes_irida_password(self, app):
        with app.app_context():
            from my_project.models import User
            user = User(username='irida_test2', email='irida2@test.com', role='staff')
            user.set_password('pass123')
            user.irida_username = 'encrypted_username'
            user.irida_password = 'encrypted_password'
            d = user.to_dict()
            assert 'irida_password' not in d
            assert 'irida_username' not in d
            # But irida_configured flag should be present
            assert 'irida_configured' in d

    def test_to_dict_irida_configured_flag(self, app):
        with app.app_context():
            from my_project.models import User
            user = User(username='irida_test3', email='irida3@test.com', role='staff')
            user.set_password('pass123')
            d = user.to_dict()
            assert d['irida_configured'] is False

            user.irida_username = 'enc_user'
            user.irida_password = 'enc_pass'
            d = user.to_dict()
            assert d['irida_configured'] is True
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_irida/test_user_irida_fields.py -v`
Expected: FAIL — `AttributeError: ... has no attribute 'irida_username'`

**Step 3: Add the fields to User model**

In `backend/my_project/models.py`, add after line 28 (`peripheral_unit`):

```python
    # IRIDA integration — encrypted credentials (nullable)
    irida_username = db.Column(db.Text, nullable=True)
    irida_password = db.Column(db.Text, nullable=True)
    irida_x_profile = db.Column(db.String(50), nullable=True)
    irida_base_url = db.Column(db.String(200), nullable=True)
```

Update `to_dict()` in User model to include the configured flag but **never** expose credentials:

```python
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'presence_status': self.presence_status,
            'role': self.role,
            'peripheral_unit': self.peripheral_unit,
            'irida_configured': bool(self.irida_username and self.irida_password),
        }
```

Add auto-migration entries in `backend/my_project/__init__.py` — append to the `_migrate_columns` list (after line 170):

```python
            # IRIDA per-user credentials (Phase 1)
            ('users', 'irida_username', 'TEXT'),
            ('users', 'irida_password', 'TEXT'),
            ('users', 'irida_x_profile', 'VARCHAR(50)'),
            ('users', 'irida_base_url', 'VARCHAR(200)'),
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_irida/test_user_irida_fields.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
git add backend/my_project/models.py backend/my_project/__init__.py tests/test_irida/test_user_irida_fields.py
git commit -m "feat(irida): add encrypted IRIDA credential fields to User model"
```

---

### Task 3: Create IridaTransaction model

**Files:**
- Create: `backend/my_project/integrations/models.py`
- Modify: `backend/my_project/__init__.py:129` (import the new model)
- Create: `tests/test_irida/test_transaction_model.py`

**Step 1: Write the failing test**

Create `tests/test_irida/test_transaction_model.py`:

```python
"""Tests for IridaTransaction model."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXk=')
import json


class TestIridaTransaction:
    def test_create_outbound_transaction(self, app):
        with app.app_context():
            from my_project.integrations.models import IridaTransaction
            from my_project.extensions import db

            tx = IridaTransaction(
                direction='outbound',
                status='sent',
                source_type='advisor_report',
                source_id=1,
                irida_reg_no='52/2026',
                subject='Αναφορά ελέγχου δομής',
                sender='Κ. Σύμβουλος',
                recipients_json=json.dumps(['org123']),
                sent_by_id=None,  # No FK constraint in SQLite test
            )
            db.session.add(tx)
            db.session.commit()

            assert tx.id is not None
            assert tx.direction == 'outbound'
            assert tx.irida_reg_no == '52/2026'

    def test_to_dict(self, app):
        with app.app_context():
            from my_project.integrations.models import IridaTransaction
            from my_project.extensions import db

            tx = IridaTransaction(
                direction='outbound',
                status='sent',
                source_type='advisor_report',
                source_id=42,
                irida_reg_no='99/2026',
                subject='Test',
                sender='Sender',
                recipients_json=json.dumps(['r1']),
            )
            db.session.add(tx)
            db.session.commit()

            d = tx.to_dict()
            assert d['direction'] == 'outbound'
            assert d['status'] == 'sent'
            assert d['source_type'] == 'advisor_report'
            assert d['source_id'] == 42
            assert d['irida_reg_no'] == '99/2026'
            assert d['recipients'] == ['r1']

    def test_failed_transaction_stores_error(self, app):
        with app.app_context():
            from my_project.integrations.models import IridaTransaction
            from my_project.extensions import db

            tx = IridaTransaction(
                direction='outbound',
                status='failed',
                source_type='advisor_report',
                source_id=1,
                error_message='ΙΡΙΔΑ: Timeout',
            )
            db.session.add(tx)
            db.session.commit()

            assert tx.status == 'failed'
            assert tx.error_message == 'ΙΡΙΔΑ: Timeout'
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_irida/test_transaction_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'my_project.integrations.models'`

**Step 3: Create the model and register it**

Create `backend/my_project/integrations/models.py`:

```python
"""Models for IRIDA integration tracking."""
import json
from datetime import datetime
from ..extensions import db


class IridaTransaction(db.Model):
    __tablename__ = 'irida_transactions'

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Direction & status
    direction = db.Column(db.String(10))     # 'outbound' | 'inbound'
    status = db.Column(db.String(20))        # 'pending' | 'sent' | 'failed'

    # Link to source record (polymorphic)
    source_type = db.Column(db.String(50))   # 'advisor_report', 'sanction_decision', etc.
    source_id = db.Column(db.Integer)

    # IRIDA response
    irida_reg_no = db.Column(db.String(50))
    irida_document_id = db.Column(db.String(100))

    # What was sent
    recipients_json = db.Column(db.Text)
    subject = db.Column(db.String(500))
    sender = db.Column(db.String(200))

    # Who sent it
    sent_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    sent_by = db.relationship('User', backref='irida_transactions')

    # Error handling
    error_message = db.Column(db.Text, nullable=True)

    # Inbound: stored file
    file_path = db.Column(db.String(500), nullable=True)

    def to_dict(self):
        recipients = []
        if self.recipients_json:
            try:
                recipients = json.loads(self.recipients_json)
            except (json.JSONDecodeError, TypeError):
                pass

        return {
            'id': self.id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'direction': self.direction,
            'status': self.status,
            'source_type': self.source_type,
            'source_id': self.source_id,
            'irida_reg_no': self.irida_reg_no,
            'irida_document_id': self.irida_document_id,
            'recipients': recipients,
            'subject': self.subject,
            'sender': self.sender,
            'sent_by_id': self.sent_by_id,
            'error_message': self.error_message,
        }
```

In `backend/my_project/__init__.py`, add model import after line 129 (after `DocumentAuditLog` import):

```python
        from .integrations.models import IridaTransaction
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_irida/test_transaction_model.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
git add backend/my_project/integrations/models.py backend/my_project/__init__.py tests/test_irida/test_transaction_model.py
git commit -m "feat(irida): add IridaTransaction model for tracking IRIDA sends"
```

---

### Task 4: Add per-user auth functions to irida_client.py

**Files:**
- Modify: `backend/my_project/integrations/irida_client.py:72-158` (add new functions)
- Create: `tests/test_irida/test_client_per_user.py`

**Step 1: Write the failing test**

Create `tests/test_irida/test_client_per_user.py`:

```python
"""Tests for per-user IRIDA authentication functions."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXk=')
import pytest
from unittest.mock import patch, MagicMock


class TestPerUserAuth:
    def test_authenticate_user_success(self):
        from my_project.integrations.irida_client import authenticate_user

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = 'SomeTokenValue'
        mock_resp.raise_for_status = MagicMock()

        # Mock json to raise ValueError (plain text response)
        mock_resp.json.side_effect = ValueError

        with patch('my_project.integrations.irida_client.httpx.post',
                   return_value=mock_resp):
            token = authenticate_user(
                'user@gov.gr', 'pass123',
                base_url='https://dev.iridacloud.gov.gr/iris'
            )
            assert token == 'SomeTokenValue'

    def test_authenticate_user_bad_credentials(self):
        from my_project.integrations.irida_client import authenticate_user

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = 'invalid_username_or_password'
        mock_resp.raise_for_status = MagicMock()

        with patch('my_project.integrations.irida_client.httpx.post',
                   return_value=mock_resp):
            with pytest.raises(RuntimeError, match='Λάθος username'):
                authenticate_user(
                    'bad@gov.gr', 'wrong',
                    base_url='https://dev.iridacloud.gov.gr/iris'
                )

    def test_send_document_as_user_calls_httpx(self):
        from my_project.integrations.irida_client import send_document_as_user

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {'data': [{'rootId': '123', 'regNo': '10/2026'}]}
        mock_resp.raise_for_status = MagicMock()

        with patch('my_project.integrations.irida_client.httpx.post',
                   return_value=mock_resp):
            result = send_document_as_user(
                token='mytoken',
                x_profile='31712-12',
                base_url='https://dev.iridacloud.gov.gr/iris',
                subject='Test',
                registration_number='ΑΝΕΥ',
                sender='Portal',
                recipients=['org123'],
                files=[('test.pdf', b'%PDF-1.4', 'application/pdf')],
                demo=True,
            )
            assert result['data'][0]['regNo'] == '10/2026'
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_irida/test_client_per_user.py -v`
Expected: FAIL — `ImportError: cannot import name 'authenticate_user'`

**Step 3: Add per-user functions to irida_client.py**

Add these functions after the existing `reset_cache()` function (after line 166) in `backend/my_project/integrations/irida_client.py`:

```python
# ---------------------------------------------------------------------------
# Per-user authentication (Phase 1 — each advisor uses own credentials)
# ---------------------------------------------------------------------------

def authenticate_user(username, password, base_url=None):
    """Authenticate a specific user to IRIDA. Returns token string.

    Unlike _authenticate(), this does NOT cache the token — each user
    gets a fresh token per session.
    """
    cfg = _get_config()
    base = base_url or cfg['base_url']
    prefix = _common_prefix()

    resp = httpx.post(
        f'{base}/api/v2/{prefix}/token',
        data={'username': username, 'password': password},
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        timeout=30,
    )
    resp.raise_for_status()

    body = resp.text.strip()
    if body == 'invalid_username_or_password':
        raise RuntimeError(
            'ΙΡΙΔΑ: Λάθος username ή password. '
            'Ελέγξτε τα στοιχεία σύνδεσης στο προφίλ σας.')

    try:
        data = resp.json()
        token = data['access_token']
    except (ValueError, KeyError):
        token = body

    if not token:
        raise RuntimeError(f'IRIDA: Empty token in response: {body[:100]}')

    return token


def send_document_as_user(token, x_profile, base_url, subject,
                          registration_number, sender, recipients, files,
                          demo=False):
    """Send a document using a specific user's token.

    Args:
        token:                User's IRIDA token (from authenticate_user)
        x_profile:            User's x-profile string
        base_url:             IRIDA base URL
        subject:              Document subject line
        registration_number:  Protocol number or 'ΑΝΕΥ'
        sender:               Sender name
        recipients:           List of organisation IDs
        files:                List of (filename, bytes, content_type) tuples
        demo:                 If True, use demo field names (camelCase)
    """
    prefix = 'external-demo' if demo else 'external'
    url = f'{base_url}/api/v2/{prefix}'

    if demo:
        keys = ('subject', 'registrationNumber', 'sender',
                'recipients', 'file')
    else:
        keys = ('Subject', 'RegistrationNumber', 'Sender',
                'Recipients', 'Files')

    multipart_fields = []
    multipart_fields.append((keys[0], (None, subject)))
    multipart_fields.append((keys[1], (None, registration_number)))
    multipart_fields.append((keys[2], (None, sender)))
    for r in recipients:
        multipart_fields.append((keys[3], (None, r)))
    for fname, fbytes, ftype in files:
        multipart_fields.append((keys[4], (fname, fbytes, ftype)))

    headers = {
        'Authorization': f'Bearer {token}',
        'x-profile': x_profile,
    }

    resp = httpx.post(url, headers=headers, files=multipart_fields, timeout=120)
    resp.raise_for_status()

    result = resp.json()
    logger.info('ΙΡΙΔΑ (per-user): Document sent to %d recipient(s) — %s',
                len(recipients), result)
    return result
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_irida/test_client_per_user.py -v`
Expected: 3 passed

**Step 5: Commit**

```bash
git add backend/my_project/integrations/irida_client.py tests/test_irida/test_client_per_user.py
git commit -m "feat(irida): add per-user authenticate and send functions"
```

---

### Task 5: Profile IRIDA routes (save/test/delete credentials)

**Files:**
- Modify: `backend/my_project/oversight/routes.py` (add profile IRIDA endpoints)
- Create: `tests/test_irida/test_profile_routes.py`

**Step 1: Write the failing test**

Create `tests/test_irida/test_profile_routes.py`:

```python
"""Tests for /api/profile/irida routes."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXk=')


class TestProfileIridaRoutes:
    def test_get_irida_profile_unconfigured(self, client, auth_headers):
        resp = client.get('/api/profile/irida', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['configured'] is False
        assert data.get('username') is None

    def test_save_irida_credentials(self, client, auth_headers):
        resp = client.post('/api/profile/irida', headers=auth_headers,
                           json={
                               'username': 'testuser@gov.gr',
                               'password': 'testpass',
                           })
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['configured'] is True
        assert data['username'] == 'te******@gov.gr'  # masked

    def test_get_irida_profile_after_save(self, client, auth_headers):
        # Save first
        client.post('/api/profile/irida', headers=auth_headers,
                    json={'username': 'user@gov.gr', 'password': 'pass'})
        # Get
        resp = client.get('/api/profile/irida', headers=auth_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['configured'] is True
        assert 'pass' not in data.get('username', '')

    def test_delete_irida_credentials(self, client, auth_headers):
        # Save first
        client.post('/api/profile/irida', headers=auth_headers,
                    json={'username': 'user@gov.gr', 'password': 'pass'})
        # Delete
        resp = client.delete('/api/profile/irida', headers=auth_headers)
        assert resp.status_code == 200
        # Verify deleted
        resp = client.get('/api/profile/irida', headers=auth_headers)
        assert resp.get_json()['configured'] is False

    def test_save_without_username_fails(self, client, auth_headers):
        resp = client.post('/api/profile/irida', headers=auth_headers,
                           json={'password': 'testpass'})
        assert resp.status_code == 400
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_irida/test_profile_routes.py -v`
Expected: FAIL — 404 on `/api/profile/irida`

**Step 3: Implement the routes**

Add to `backend/my_project/oversight/routes.py` after the existing imports at the top:

```python
from ..integrations.irida_crypto import encrypt_credential, decrypt_credential
```

Add these routes after the `remove_user_role` endpoint (after line 191):

```python
# --- IRIDA Profile (per-user credentials) ---

def _mask_username(username):
    """Mask a username for display: 'user@gov.gr' → 'us****@gov.gr'."""
    if not username or '@' not in username:
        return username[:2] + '****' if username and len(username) > 2 else '****'
    local, domain = username.rsplit('@', 1)
    visible = min(2, len(local))
    return local[:visible] + '******' + '@' + domain


@oversight_bp.route('/api/profile/irida', methods=['GET'])
@jwt_required()
def get_irida_profile():
    """Get current user's IRIDA connection status (never exposes password)."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)

    if user.irida_username and user.irida_password:
        try:
            plain_username = decrypt_credential(user.irida_username)
        except Exception:
            plain_username = '(encrypted)'
        return jsonify({
            'configured': True,
            'username': _mask_username(plain_username),
            'x_profile': user.irida_x_profile,
            'base_url': user.irida_base_url,
        }), 200

    return jsonify({'configured': False}), 200


@oversight_bp.route('/api/profile/irida', methods=['POST'])
@jwt_required()
def save_irida_credentials():
    """Save encrypted IRIDA credentials for the current user."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username και password απαιτούνται'}), 400

    user.irida_username = encrypt_credential(username)
    user.irida_password = encrypt_credential(password)
    user.irida_x_profile = data.get('x_profile') or user.irida_x_profile
    user.irida_base_url = data.get('base_url') or user.irida_base_url

    db.session.commit()
    return jsonify({
        'configured': True,
        'username': _mask_username(username),
    }), 200


@oversight_bp.route('/api/profile/irida/test', methods=['POST'])
@jwt_required()
def test_irida_connection():
    """Test IRIDA connection with user's credentials. Returns profiles on success."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    # Use provided credentials or stored ones
    username = data.get('username')
    password = data.get('password')

    if not username and user.irida_username:
        try:
            username = decrypt_credential(user.irida_username)
            password = decrypt_credential(user.irida_password)
        except Exception:
            return jsonify({'error': 'Δεν ήταν δυνατή η αποκρυπτογράφηση'}), 500

    if not username or not password:
        return jsonify({'error': 'Δεν υπάρχουν στοιχεία σύνδεσης'}), 400

    from ..integrations.irida_client import authenticate_user, get_mode
    mode = get_mode()
    base_url = user.irida_base_url or mode.get('base_url')

    try:
        token = authenticate_user(username, password, base_url=base_url)
        # Fetch profiles with the user's token
        import httpx
        from ..integrations.irida_client import _api_prefix
        prefix = _api_prefix()
        resp = httpx.get(
            f'{base_url}/api/v2/{prefix}/profiles',
            headers={
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json',
            },
            timeout=30,
        )
        resp.raise_for_status()
        profiles = resp.json()

        # Auto-set x_profile if not already set
        if profiles and not user.irida_x_profile:
            user.irida_x_profile = profiles[0].get('xProfile')
            db.session.commit()

        return jsonify({
            'success': True,
            'profiles': profiles,
        }), 200

    except RuntimeError as e:
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        return jsonify({'error': f'Σφάλμα σύνδεσης: {str(e)}'}), 502


@oversight_bp.route('/api/profile/irida', methods=['DELETE'])
@jwt_required()
def delete_irida_credentials():
    """Remove stored IRIDA credentials for the current user."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)

    user.irida_username = None
    user.irida_password = None
    user.irida_x_profile = None
    user.irida_base_url = None
    db.session.commit()

    return jsonify({'configured': False}), 200
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_irida/test_profile_routes.py -v`
Expected: 5 passed

**Step 5: Commit**

```bash
git add backend/my_project/oversight/routes.py tests/test_irida/test_profile_routes.py
git commit -m "feat(irida): add /api/profile/irida routes for credential management"
```

---

### Task 6: Send advisor report to IRIDA route

**Files:**
- Modify: `backend/my_project/oversight/routes.py` (add send-to-irida endpoint)
- Create: `tests/test_irida/test_send_report.py`

**Step 1: Write the failing test**

Create `tests/test_irida/test_send_report.py`:

```python
"""Tests for POST /api/advisor-reports/<id>/send-to-irida."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', 'dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleXk=')
from unittest.mock import patch, MagicMock
from datetime import date


def _create_structure_and_report(app, author_id):
    """Helper: create a structure + approved advisor report."""
    from my_project.registry.models import Structure, StructureType
    from my_project.oversight.models import SocialAdvisorReport
    from my_project.extensions import db

    with app.app_context():
        # Ensure structure type exists
        st = StructureType.query.first()
        if not st:
            st = StructureType(name='Test Type', code='TST')
            db.session.add(st)
            db.session.flush()

        s = Structure(
            name='Δομή Τεστ', code='TST001', type_id=st.id,
            representative='Test Rep', status='active',
        )
        db.session.add(s)
        db.session.flush()

        report = SocialAdvisorReport(
            structure_id=s.id,
            author_id=author_id,
            drafted_date=date.today(),
            type='regular',
            assessment='Test assessment',
            status='approved',
        )
        db.session.add(report)
        db.session.commit()
        return s.id, report.id


class TestSendToIrida:
    def test_send_without_irida_credentials_returns_400(self, app, client, auth_headers):
        _, report_id = _create_structure_and_report(app, author_id=1)
        resp = client.post(
            f'/api/advisor-reports/{report_id}/send-to-irida',
            headers=auth_headers,
            json={'recipients': ['org1']},
        )
        # Should fail because user has no IRIDA credentials
        assert resp.status_code == 400
        assert 'ΙΡΙΔΑ' in resp.get_json()['error'] or 'credentials' in resp.get_json()['error'].lower()

    def test_send_without_recipients_returns_400(self, app, client, auth_headers):
        _, report_id = _create_structure_and_report(app, author_id=1)
        resp = client.post(
            f'/api/advisor-reports/{report_id}/send-to-irida',
            headers=auth_headers,
            json={},
        )
        assert resp.status_code == 400

    def test_send_nonexistent_report_returns_404(self, client, auth_headers):
        resp = client.post(
            '/api/advisor-reports/99999/send-to-irida',
            headers=auth_headers,
            json={'recipients': ['org1']},
        )
        assert resp.status_code == 404
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_irida/test_send_report.py -v`
Expected: FAIL — 404/405 because the route doesn't exist yet

**Step 3: Implement the send route**

Add to `backend/my_project/oversight/routes.py`, after the IRIDA profile routes:

```python
# --- Send Advisor Report to ΙΡΙΔΑ ---

@oversight_bp.route('/api/advisor-reports/<int:report_id>/send-to-irida', methods=['POST'])
@jwt_required()
def send_advisor_report_to_irida(report_id):
    """Send an approved advisor report to ΙΡΙΔΑ as Υπηρεσιακό Σημείωμα."""
    import json as _json
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)

    report = SocialAdvisorReport.query.get_or_404(report_id)

    # Validate report status
    if report.status not in ('submitted', 'approved'):
        return jsonify({'error': 'Μόνο εγκεκριμένες αναφορές μπορούν να '
                        'σταλούν στο ΙΡΙΔΑ'}), 400

    # Validate request body
    data = request.get_json() or {}
    recipients = data.get('recipients', [])
    if not recipients:
        return jsonify({'error': 'Απαιτούνται αποδέκτες (recipients)'}), 400

    # Check IRIDA credentials
    if not user.irida_username or not user.irida_password:
        return jsonify({
            'error': 'Δεν έχετε ρυθμίσει σύνδεση ΙΡΙΔΑ. '
                     'Μεταβείτε στο Προφίλ → Σύνδεση ΙΡΙΔΑ.'
        }), 400

    from ..integrations.irida_crypto import decrypt_credential
    from ..integrations.irida_client import (
        authenticate_user, send_document_as_user, get_mode
    )
    from ..integrations.models import IridaTransaction

    try:
        username = decrypt_credential(user.irida_username)
        password = decrypt_credential(user.irida_password)
    except Exception:
        return jsonify({'error': 'Σφάλμα αποκρυπτογράφησης. '
                        'Αποθηκεύστε ξανά τα στοιχεία ΙΡΙΔΑ.'}), 500

    mode = get_mode()
    base_url = user.irida_base_url or mode.get('base_url')
    x_profile = user.irida_x_profile or ''

    # Build subject from report + structure
    structure = report.structure
    subject_override = data.get('subject')
    subject = subject_override or (
        f'Αναφορά Κοιν. Συμβούλου — {structure.name}'
        if structure else f'Αναφορά Κοιν. Συμβούλου #{report.id}'
    )

    # Generate PDF from the report
    from .pdf_reports import generate_advisor_report_pdf
    try:
        pdf_bytes = generate_advisor_report_pdf(report)
    except Exception:
        # Fallback: send a simple text file if PDF generation fails
        pdf_bytes = f'Αναφορά #{report.id}\n{report.assessment}'.encode('utf-8')

    filename = f'advisor_report_{report.id}.pdf'

    # Create pending transaction
    tx = IridaTransaction(
        direction='outbound',
        status='pending',
        source_type='advisor_report',
        source_id=report.id,
        subject=subject,
        sender=user.username,
        recipients_json=_json.dumps(recipients),
        sent_by_id=user_id,
    )
    db.session.add(tx)
    db.session.flush()

    try:
        token = authenticate_user(username, password, base_url=base_url)

        # Auto-fetch x_profile if missing
        if not x_profile:
            import httpx as _httpx
            from ..integrations.irida_client import _api_prefix
            prefix = _api_prefix()
            prof_resp = _httpx.get(
                f'{base_url}/api/v2/{prefix}/profiles',
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json',
                },
                timeout=30,
            )
            if prof_resp.status_code == 200:
                profiles = prof_resp.json()
                if profiles:
                    x_profile = profiles[0].get('xProfile', '')
                    user.irida_x_profile = x_profile

        result = send_document_as_user(
            token=token,
            x_profile=x_profile,
            base_url=base_url,
            subject=subject,
            registration_number='ΑΝΕΥ',
            sender=user.username,
            recipients=recipients,
            files=[(filename, pdf_bytes, 'application/pdf')],
            demo=mode.get('demo', False),
        )

        # Extract protocol number from response
        irida_data = result.get('data', result) if isinstance(result, dict) else result
        if isinstance(irida_data, list) and irida_data:
            tx.irida_reg_no = irida_data[0].get('regNo')
            tx.irida_document_id = str(irida_data[0].get('rootId', ''))

        tx.status = 'sent'
        db.session.commit()

        return jsonify({
            'transaction': tx.to_dict(),
            'message': f'Η αναφορά στάλθηκε στο ΙΡΙΔΑ'
                       f'{" — Αρ.Πρωτ: " + tx.irida_reg_no if tx.irida_reg_no else ""}',
        }), 200

    except RuntimeError as e:
        tx.status = 'failed'
        tx.error_message = str(e)
        db.session.commit()
        return jsonify({'error': str(e), 'transaction': tx.to_dict()}), 502

    except Exception as e:
        tx.status = 'failed'
        tx.error_message = str(e)
        db.session.commit()
        return jsonify({'error': f'Σφάλμα ΙΡΙΔΑ: {str(e)}',
                        'transaction': tx.to_dict()}), 502
```

Also create a minimal PDF helper. Create `backend/my_project/oversight/pdf_reports.py`:

```python
"""PDF generation for oversight reports (advisor reports → IRIDA)."""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os


def _register_fonts():
    """Register Greek-capable fonts."""
    for name, filename in [('Arial', 'arial.ttf'), ('Arial-Bold', 'arialbd.ttf')]:
        for d in ['C:/Windows/Fonts', '/usr/share/fonts/truetype/msttcorefonts',
                   '/usr/share/fonts/truetype/dejavu', '/usr/share/fonts']:
            path = os.path.join(d, filename)
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                    return True
                except Exception:
                    pass
    return False


def generate_advisor_report_pdf(report):
    """Generate a PDF for an advisor report. Returns bytes."""
    has_arial = _register_fonts()
    base_font = 'Arial' if has_arial else 'Helvetica'
    bold_font = 'Arial-Bold' if has_arial else 'Helvetica-Bold'

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            leftMargin=2.5*cm, rightMargin=2.5*cm,
                            topMargin=2.5*cm, bottomMargin=2.5*cm)

    styles = {
        'title': ParagraphStyle('Title', fontName=bold_font, fontSize=14,
                                leading=18, alignment=TA_CENTER, spaceAfter=12),
        'subtitle': ParagraphStyle('Subtitle', fontName=base_font, fontSize=10,
                                   leading=13, alignment=TA_CENTER, spaceAfter=20),
        'heading': ParagraphStyle('Heading', fontName=bold_font, fontSize=11,
                                  leading=14, spaceBefore=12, spaceAfter=6),
        'body': ParagraphStyle('Body', fontName=base_font, fontSize=10,
                               leading=13, alignment=TA_JUSTIFY, spaceAfter=6),
    }

    story = []
    structure = report.structure

    story.append(Paragraph('ΑΝΑΦΟΡΑ ΚΟΙΝΩΝΙΚΟΥ ΣΥΜΒΟΥΛΟΥ', styles['title']))
    story.append(Paragraph(
        f'Δομή: {structure.name if structure else "—"} | '
        f'Ημ/νία: {report.drafted_date}',
        styles['subtitle']))

    story.append(Paragraph('Αξιολόγηση', styles['heading']))
    # Strip HTML tags for PDF (simple approach)
    import re
    clean_assessment = re.sub('<[^<]+?>', '', report.assessment or '')
    story.append(Paragraph(clean_assessment or '—', styles['body']))

    if report.recommendations:
        story.append(Paragraph('Συστάσεις / Προτάσεις', styles['heading']))
        clean_recs = re.sub('<[^<]+?>', '', report.recommendations)
        story.append(Paragraph(clean_recs or '—', styles['body']))

    story.append(Spacer(1, 40))
    author = report.author
    story.append(Paragraph(
        f'Συντάκτης: {author.username if author else "—"}',
        styles['body']))

    doc.build(story)
    return buffer.getvalue()
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_irida/test_send_report.py -v`
Expected: 3 passed

**Step 5: Run ALL tests to check for regressions**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All existing tests still pass

**Step 6: Commit**

```bash
git add backend/my_project/oversight/routes.py backend/my_project/oversight/pdf_reports.py tests/test_irida/test_send_report.py
git commit -m "feat(irida): add send advisor report to IRIDA endpoint with PDF generation"
```

---

### Task 7: Frontend — ProfilePage IRIDA credentials section

**Files:**
- Modify: `frontend/src/pages/ProfilePage.jsx`

**Step 1: Add IridaProfileCard component**

In `frontend/src/pages/ProfilePage.jsx`, add the following imports to the existing import block (after line 18, add `Link2, Unlink, TestTube2, Loader2` to the lucide-react imports):

```jsx
import {
  User, Mail, Shield, Calendar, Key, Save, AlertCircle, CheckCircle,
  Link2, Unlink, TestTube2, Loader2
} from 'lucide-react';
```

Add a new component **inside** the same file, before the `ProfilePage` component:

```jsx
function IridaProfileCard() {
  const [iridaUsername, setIridaUsername] = useState('');
  const [iridaPassword, setIridaPassword] = useState('');
  const [iridaStatus, setIridaStatus] = useState(null); // { configured, username }
  const [iridaLoading, setIridaLoading] = useState(true);
  const [iridaSaving, setIridaSaving] = useState(false);
  const [iridaTesting, setIridaTesting] = useState(false);
  const [iridaMessage, setIridaMessage] = useState({ type: '', text: '' });
  const [iridaProfiles, setIridaProfiles] = useState([]);

  useEffect(() => {
    loadIridaStatus();
  }, []);

  const loadIridaStatus = async () => {
    try {
      const { data } = await api.get('/api/profile/irida');
      setIridaStatus(data);
    } catch {
      setIridaStatus({ configured: false });
    } finally {
      setIridaLoading(false);
    }
  };

  const handleSave = async () => {
    if (!iridaUsername || !iridaPassword) {
      setIridaMessage({ type: 'error', text: 'Συμπληρώστε username και password.' });
      return;
    }
    setIridaSaving(true);
    setIridaMessage({ type: '', text: '' });
    try {
      const { data } = await api.post('/api/profile/irida', {
        username: iridaUsername,
        password: iridaPassword,
      });
      setIridaStatus(data);
      setIridaPassword('');
      setIridaMessage({ type: 'success', text: 'Τα στοιχεία αποθηκεύτηκαν.' });
    } catch (err) {
      setIridaMessage({
        type: 'error',
        text: err.response?.data?.error || 'Σφάλμα αποθήκευσης.',
      });
    } finally {
      setIridaSaving(false);
    }
  };

  const handleTest = async () => {
    setIridaTesting(true);
    setIridaMessage({ type: '', text: '' });
    setIridaProfiles([]);
    try {
      const payload = {};
      if (iridaUsername) payload.username = iridaUsername;
      if (iridaPassword) payload.password = iridaPassword;
      const { data } = await api.post('/api/profile/irida/test', payload);
      if (data.success) {
        setIridaProfiles(data.profiles || []);
        setIridaMessage({ type: 'success', text: 'Σύνδεση επιτυχής!' });
      } else {
        setIridaMessage({ type: 'error', text: data.error || 'Αποτυχία σύνδεσης.' });
      }
    } catch (err) {
      setIridaMessage({
        type: 'error',
        text: err.response?.data?.error || 'Σφάλμα σύνδεσης.',
      });
    } finally {
      setIridaTesting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete('/api/profile/irida');
      setIridaStatus({ configured: false });
      setIridaUsername('');
      setIridaPassword('');
      setIridaProfiles([]);
      setIridaMessage({ type: 'success', text: 'Τα στοιχεία ΙΡΙΔΑ αφαιρέθηκαν.' });
    } catch {
      setIridaMessage({ type: 'error', text: 'Σφάλμα κατά τη διαγραφή.' });
    }
  };

  if (iridaLoading) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Link2 className="w-5 h-5" />
          <span>Σύνδεση ΙΡΙΔΑ</span>
        </CardTitle>
        <CardDescription>
          Αποθηκεύστε τα στοιχεία σύνδεσής σας στο ΙΡΙΔΑ για αποστολή εγγράφων.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {iridaMessage.text && (
          <Alert className={iridaMessage.type === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}>
            {iridaMessage.type === 'error' ? (
              <AlertCircle className="h-4 w-4 text-red-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
            <AlertDescription className={iridaMessage.type === 'error' ? 'text-red-800' : 'text-green-800'}>
              {iridaMessage.text}
            </AlertDescription>
          </Alert>
        )}

        {iridaStatus?.configured && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
            <span className="text-green-800">
              Συνδεδεμένο — {iridaStatus.username}
            </span>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="irida-username">Username ΙΡΙΔΑ</Label>
            <Input
              id="irida-username"
              value={iridaUsername}
              onChange={(e) => setIridaUsername(e.target.value)}
              placeholder={iridaStatus?.configured ? '(αποθηκευμένο)' : 'user@gov.gr'}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="irida-password">Password ΙΡΙΔΑ</Label>
            <Input
              id="irida-password"
              type="password"
              value={iridaPassword}
              onChange={(e) => setIridaPassword(e.target.value)}
              placeholder={iridaStatus?.configured ? '(αποθηκευμένο)' : 'Εισάγετε κωδικό'}
            />
          </div>
        </div>

        {iridaProfiles.length > 0 && (
          <div className="p-3 bg-[#f5f2ec] rounded-lg text-sm space-y-1">
            <p className="font-medium text-[#2a2520]">Προφίλ ΙΡΙΔΑ:</p>
            {iridaProfiles.map((p, i) => (
              <p key={i} className="text-[#6b6560]">
                {p.positionName} / {p.dutyName} [{p.xProfile}]
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={iridaTesting}
            className="min-h-[44px]"
          >
            {iridaTesting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <TestTube2 className="w-4 h-4 mr-2" />}
            Δοκιμή σύνδεσης
          </Button>
          <Button
            onClick={handleSave}
            disabled={iridaSaving}
            className="min-h-[44px] bg-[#1a3aa3] hover:bg-[#152e82] text-white"
          >
            {iridaSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Αποθήκευση
          </Button>
          {iridaStatus?.configured && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              className="min-h-[44px] text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Unlink className="w-4 h-4 mr-2" />
              Αποσύνδεση
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

Then add `<IridaProfileCard />` and `CardDescription` import in the main ProfilePage component — insert it between the two existing Cards (after the "Στοιχεία Χρήστη" card, before "Ενημέρωση Προφίλ" card, around line 200).

Add `CardDescription` to the Card import:
```jsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
```

In the JSX, after `</Card>` (line 199) and before `{/* Update Profile Form */}` (line 201), insert:

```jsx
        {/* IRIDA Connection */}
        <IridaProfileCard />
```

**Step 2: Manual test**

Run frontend: `npx pnpm dev`
1. Login as any user
2. Navigate to Profile page
3. See "Σύνδεση ΙΡΙΔΑ" card between the two existing cards
4. Try "Δοκιμή σύνδεσης" without credentials → error message
5. Enter credentials → "Αποθήκευση" → "Δοκιμή σύνδεσης" → profiles shown

**Step 3: Commit**

```bash
git add frontend/src/pages/ProfilePage.jsx
git commit -m "feat(irida): add IRIDA credentials section to ProfilePage"
```

---

### Task 8: Frontend — AdvisorReportPage IRIDA send section

**Files:**
- Create: `frontend/src/features/registry/components/IridaSendSection.jsx`
- Modify: `frontend/src/features/registry/pages/AdvisorReportPage.jsx`
- Modify: `frontend/src/features/registry/lib/registryApi.js` (add IRIDA API methods)

**Step 1: Add IRIDA API methods to registryApi.js**

In `frontend/src/features/registry/lib/registryApi.js`, add to the `oversightApi` object (after `iridaExport` on line 88):

```javascript
  sendToIrida: (reportId, data) => api.post(
    `/api/advisor-reports/${reportId}/send-to-irida`, data
  ),
  getIridaTransactions: (sourceType, sourceId) => api.get(
    `/api/irida/transactions`, { params: { source_type: sourceType, source_id: sourceId } }
  ),
```

Also add a new `iridaApi` export:

```javascript
export const iridaApi = {
  status: () => api.get('/api/irida/status'),
  roots: () => api.get('/api/irida/roots'),
  profileStatus: () => api.get('/api/profile/irida'),
};
```

**Step 2: Create IridaSendSection component**

Create `frontend/src/features/registry/components/IridaSendSection.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import { Alert, AlertDescription } from '@/components/ui/alert.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Send, Loader2, CheckCircle, AlertCircle, ExternalLink, Link2
} from 'lucide-react';
import { toast } from 'sonner';
import { oversightApi, iridaApi } from '../lib/registryApi';

export default function IridaSendSection({ report, structureName }) {
  const [roots, setRoots] = useState([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [subject, setSubject] = useState('');
  const [sending, setSending] = useState(false);
  const [transaction, setTransaction] = useState(null);
  const [iridaConfigured, setIridaConfigured] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // Check if user has IRIDA credentials
        const { data: profile } = await iridaApi.profileStatus();
        setIridaConfigured(profile.configured);

        if (profile.configured) {
          // Fetch organisations for recipient dropdown
          const { data: orgs } = await iridaApi.roots();
          const items = Array.isArray(orgs) ? orgs : (orgs.data || []);
          setRoots(items);
        }
      } catch {
        setIridaConfigured(false);
      } finally {
        setLoading(false);
      }
    };
    init();

    // Auto-generate subject
    setSubject(
      `Αναφορά Κοιν. Συμβούλου — ${structureName || 'Δομή'}`
    );
  }, [structureName]);

  const handleSend = async () => {
    if (!selectedRecipient) {
      toast.error('Επιλέξτε αποδέκτη.');
      return;
    }
    setSending(true);
    try {
      const { data } = await oversightApi.sendToIrida(report.id, {
        recipients: [selectedRecipient],
        subject,
      });
      setTransaction(data.transaction);
      toast.success(data.message || 'Η αναφορά στάλθηκε στο ΙΡΙΔΑ!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα αποστολής.');
    } finally {
      setSending(false);
    }
  };

  // Don't render for non-approved reports
  if (!report || !['submitted', 'approved'].includes(report.status)) {
    return null;
  }

  if (loading) return null;

  // Already sent — show success badge
  if (transaction?.status === 'sent') {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-800">
                Κατατέθηκε στο ΙΡΙΔΑ
              </p>
              <p className="text-sm text-green-700">
                {transaction.irida_reg_no && `Αρ.Πρωτ: ${transaction.irida_reg_no} | `}
                {new Date(transaction.created_at).toLocaleString('el-GR')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User has no IRIDA credentials
  if (!iridaConfigured) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-amber-800">
                Ρυθμίστε τη σύνδεση ΙΡΙΔΑ στο{' '}
                <a href="/profile" className="underline font-medium">
                  προφίλ σας
                </a>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Send form
  return (
    <Card className="border-[#e8e2d8]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-[#2a2520]">
          <Link2 className="w-5 h-5" />
          Κατάθεση σε ΙΡΙΔΑ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label>Αποδέκτης</Label>
          <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
            <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
              <SelectValue placeholder="Επιλέξτε οργανισμό..." />
            </SelectTrigger>
            <SelectContent>
              {roots.map((r) => (
                <SelectItem
                  key={r.id || r.Id}
                  value={String(r.id || r.Id)}
                >
                  {r.description || r.Description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>Θέμα</Label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="border-[#e8e2d8]"
          />
        </div>

        <div className="text-sm text-[#8a8580]">
          Τύπος: Υπηρεσιακό Σημείωμα
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !selectedRecipient}
          className="w-full bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px]"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Αποστολή σε ΙΡΙΔΑ
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Integrate into AdvisorReportPage**

Modify `frontend/src/features/registry/pages/AdvisorReportPage.jsx` to show the IRIDA section when viewing an existing report.

Replace the entire file content:

```jsx
import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { structuresApi, oversightApi } from '../lib/registryApi';
import AdvisorReportForm from '../components/AdvisorReportForm';
import IridaSendSection from '../components/IridaSendSection';

export default function AdvisorReportPage() {
  const { structureId, reportId } = useParams();
  const navigate = useNavigate();
  const [structure, setStructure] = useState(null);
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: s } = await structuresApi.get(structureId);
        setStructure(s);
        if (reportId) {
          const { data: r } = await oversightApi.getAdvisorReport(reportId);
          setReport(r);
        }
      } catch {
        toast.error('Σφάλμα φόρτωσης.');
        navigate('/registry');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [structureId, reportId, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        to={`/registry/${structureId}`}
        className="inline-flex items-center text-[#1a3aa3] hover:text-[#152e82] text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Επιστροφή στη δομή
      </Link>

      <div className="mb-6">
        <h1
          className="text-3xl font-bold text-[#2a2520]"
          style={{ fontFamily: "'Literata', serif" }}
        >
          {reportId ? 'Επεξεργασία Αναφοράς' : 'Νέα Αναφορά Κοιν. Συμβούλου'}
        </h1>
        {structure && (
          <p className="text-[#6b6560] mt-1">
            Δομή: {structure.name}
          </p>
        )}
      </div>

      {/* IRIDA send section — only for existing approved/submitted reports */}
      {report && ['submitted', 'approved'].includes(report.status) && (
        <div className="mb-6">
          <IridaSendSection report={report} structureName={structure?.name} />
        </div>
      )}

      <AdvisorReportForm
        structureId={structureId}
        structureName={structure?.name}
        report={report}
        onSuccess={() => navigate(`/registry/${structureId}`)}
      />
    </div>
  );
}
```

**Step 4: Manual test**

1. Run backend + frontend
2. Create an advisor report for a structure (auto-approved status)
3. Navigate to edit the report
4. See "Κατάθεση σε ΙΡΙΔΑ" section at top
5. If no IRIDA credentials → amber warning with link to profile
6. After configuring credentials → dropdown with IRIDA organisations
7. Select recipient, click "Αποστολή σε ΙΡΙΔΑ"
8. Green badge appears with protocol number

**Step 5: Commit**

```bash
git add frontend/src/features/registry/components/IridaSendSection.jsx frontend/src/features/registry/pages/AdvisorReportPage.jsx frontend/src/features/registry/lib/registryApi.js
git commit -m "feat(irida): add IRIDA send section to advisor report page"
```

---

### Task 9: Add IRIDA_ENCRYPTION_KEY to .env and update .env.example

**Files:**
- Modify: `.env` (add IRIDA_ENCRYPTION_KEY — generate one)
- Modify: `.env.example` (add IRIDA_ENCRYPTION_KEY, IRIDA_DEMO, clean up unused vars)

**Step 1: Generate a Fernet key**

Run: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`

Copy the output.

**Step 2: Add to .env**

Add to the `.env` file (in the IRIDA section):

```
IRIDA_ENCRYPTION_KEY=<paste generated key>
```

**Step 3: Clean up .env.example**

Update the IRIDA section of `.env.example` to match current reality:

```
# ΙΡΙΔΑ Integration (External API v2.2)
IRIDA_BASE_URL=https://dev.iridacloud.gov.gr/iris
IRIDA_USERNAME=
IRIDA_PASSWORD=
IRIDA_X_PROFILE=
IRIDA_DEMO=false
IRIDA_ENCRYPTION_KEY=
```

Remove the unused `IRIDA_CLIENT_ID` and `IRIDA_CLIENT_SECRET` lines.

**Step 4: Commit**

```bash
git add .env.example
git commit -m "chore(irida): update .env.example with encryption key and demo flag"
```

**Note:** Do NOT commit `.env` — it contains real credentials and should be in `.gitignore`.

---

### Task 10: End-to-end testing with demo mode

**Files:**
- Modify: `backend/scripts/test_irida_live.py` (add IRIDA profile + send test)

**Step 1: Extend the live test script**

Add these steps to `backend/scripts/test_irida_live.py` after Step 6:

```python
    # Step 7: Save IRIDA credentials in profile
    print("\n7. Saving IRIDA credentials in profile...")
    resp = httpx.post(f'{BASE}/api/profile/irida', headers=headers,
                      json={'username': 'demo@demo.gr', 'password': 'Demo κωδικός'},
                      timeout=10)
    if resp.status_code == 200:
        print(f"   OK - {resp.json()}")
    else:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")

    # Step 8: Test IRIDA connection
    print("\n8. Testing IRIDA connection...")
    resp = httpx.post(f'{BASE}/api/profile/irida/test', headers=headers,
                      json={}, timeout=15)
    if resp.status_code == 200:
        data = resp.json()
        print(f"   OK - {len(data.get('profiles', []))} profile(s)")
    else:
        print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")

    # Step 9: Create a test advisor report
    print("\n9. Creating test advisor report...")
    # Get first structure
    resp = httpx.get(f'{BASE}/api/structures', headers=headers, timeout=10)
    structures = resp.json() if resp.status_code == 200 else []
    if isinstance(structures, dict):
        structures = structures.get('data', structures.get('structures', []))
    if structures:
        sid = structures[0].get('id')
        import datetime
        form_data = {
            'type': 'regular',
            'drafted_date': datetime.date.today().isoformat(),
            'assessment': 'Δοκιμαστική αξιολόγηση για ΙΡΙΔΑ test',
        }
        resp = httpx.post(f'{BASE}/api/structures/{sid}/advisor-reports',
                          headers=headers, data=form_data, timeout=10)
        if resp.status_code == 201:
            report = resp.json()
            report_id = report['id']
            print(f"   OK - report #{report_id} (status: {report['status']})")

            # Step 10: Send to IRIDA
            print("\n10. Sending advisor report to ΙΡΙΔΑ...")
            # Get first org as recipient
            resp = httpx.get(f'{BASE}/api/irida/roots', headers=headers, timeout=15)
            if resp.status_code == 200:
                roots = resp.json()
                items = roots if isinstance(roots, list) else roots.get('data', [])
                if items:
                    recipient_id = str(items[0].get('id') or items[0].get('Id'))
                    resp = httpx.post(
                        f'{BASE}/api/advisor-reports/{report_id}/send-to-irida',
                        headers=headers,
                        json={'recipients': [recipient_id]},
                        timeout=30,
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        tx = data.get('transaction', {})
                        print(f"   OK - {data.get('message')}")
                        print(f"   Transaction: {tx.get('status')} | "
                              f"Reg: {tx.get('irida_reg_no')}")
                    else:
                        print(f"   FAILED ({resp.status_code}): "
                              f"{resp.text[:300]}")
                else:
                    print("   SKIP - no organisations available")
            else:
                print(f"   SKIP - couldn't fetch roots: {resp.status_code}")
        else:
            print(f"   FAILED ({resp.status_code}): {resp.text[:200]}")
    else:
        print("   SKIP - no structures in database")
```

**Step 2: Run the full integration test**

Ensure:
1. Docker is running (PostgreSQL)
2. Backend is running with `IRIDA_DEMO=true` in `.env`
3. `IRIDA_ENCRYPTION_KEY` is set in `.env`

Run: `python backend/scripts/test_irida_live.py`
Expected: All 10 steps pass, Step 10 shows protocol number from IRIDA demo

**Step 3: Run all backend tests**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All tests pass (including new `tests/test_irida/` tests)

**Step 4: Commit**

```bash
git add backend/scripts/test_irida_live.py
git commit -m "test(irida): extend live test with profile save, connection test, and send flow"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Encryption utilities | `irida_crypto.py`, `requirements.txt`, `.env.example` |
| 2 | User model IRIDA fields | `models.py`, `__init__.py` |
| 3 | IridaTransaction model | `integrations/models.py`, `__init__.py` |
| 4 | Per-user auth in irida_client | `irida_client.py` |
| 5 | Profile IRIDA routes | `oversight/routes.py` |
| 6 | Send advisor report route | `oversight/routes.py`, `pdf_reports.py` |
| 7 | Frontend: ProfilePage | `ProfilePage.jsx` |
| 8 | Frontend: AdvisorReportPage | `IridaSendSection.jsx`, `AdvisorReportPage.jsx`, `registryApi.js` |
| 9 | .env setup | `.env`, `.env.example` |
| 10 | End-to-end test | `test_irida_live.py` |
