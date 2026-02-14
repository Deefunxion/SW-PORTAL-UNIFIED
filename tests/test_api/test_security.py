"""Security tests for ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ — CORS, auth enforcement, rate limiting, headers, audit."""
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


def test_login_rate_limited(app):
    """Login should be rate-limited after too many failed attempts."""
    from my_project.extensions import limiter
    # Reset limiter storage to clear any counts from prior tests
    limiter.reset()
    # Use a fresh test client so no prior rate-limit state carries over
    with app.test_client() as fresh_client:
        # Make 6 rapid failed login attempts (limit is 5/minute)
        for i in range(6):
            response = fresh_client.post('/api/auth/login', json={
                'username': 'nonexistent',
                'password': 'wrong'
            })
        # The 6th request should be rate-limited
        assert response.status_code == 429


def test_security_headers_present(client):
    """Responses should include security headers."""
    response = client.get('/api/health')
    assert response.headers.get('X-Content-Type-Options') == 'nosniff'
    assert response.headers.get('X-Frame-Options') == 'DENY'
    assert response.headers.get('X-XSS-Protection') == '1; mode=block'
    assert 'Referrer-Policy' in response.headers


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


def test_login_creates_audit_log(client, app):
    """Successful login should create an audit log entry."""
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


def test_ai_reply_includes_disclaimer():
    """AI replies should include advisory disclaimer."""
    from my_project.ai.copilot import DISCLAIMER_TEXT
    assert 'ενδεικτικές' in DISCLAIMER_TEXT or 'ενδεικτικός' in DISCLAIMER_TEXT


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
        user = db.session.get(User, user_id)
        assert user.username.startswith('deleted_')
        assert user.email.startswith('deleted_')
