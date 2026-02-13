import pytest


def test_protected_endpoint_requires_auth(client):
    """Endpoints must reject requests without JWT."""
    response = client.get('/api/auth/me')
    assert response.status_code == 401


def test_protected_endpoint_works_with_auth(client, auth_headers):
    """Endpoints must work with valid JWT."""
    response = client.get('/api/auth/me', headers=auth_headers)
    assert response.status_code == 200


def test_create_discussion_requires_auth(client):
    response = client.post('/api/discussions', json={
        'title': 'Test', 'content': 'Test', 'category_id': 1
    })
    assert response.status_code == 401


def test_ai_chat_requires_auth(client):
    response = client.post('/api/chat', json={'message': 'Hello'})
    assert response.status_code == 401


def test_get_notifications_requires_auth(client):
    response = client.get('/api/notifications')
    assert response.status_code == 401


def test_user_permissions_requires_auth(client):
    response = client.get('/api/user/permissions')
    assert response.status_code == 401
