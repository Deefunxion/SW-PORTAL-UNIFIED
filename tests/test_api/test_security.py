"""Security tests for SW Portal — CORS, auth enforcement, rate limiting, headers, audit."""
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
