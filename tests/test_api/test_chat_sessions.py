"""Tests for chat session persistence API."""
import pytest


def test_create_chat_session(client, auth_headers):
    """POST /api/chat/sessions should create a new session."""
    resp = client.post('/api/chat/sessions', json={
        'title': 'Ερώτηση αδειοδότησης'
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.get_json()
    assert 'id' in data
    assert data['title'] == 'Ερώτηση αδειοδότησης'


def test_list_chat_sessions(client, auth_headers):
    """GET /api/chat/sessions should return user's sessions."""
    # Create two sessions
    client.post('/api/chat/sessions', json={'title': 'Session 1'}, headers=auth_headers)
    client.post('/api/chat/sessions', json={'title': 'Session 2'}, headers=auth_headers)

    resp = client.get('/api/chat/sessions', headers=auth_headers)
    assert resp.status_code == 200
    sessions = resp.get_json()
    # Should have at least the 2 we just created (may have more from other tests)
    titles = [s['title'] for s in sessions]
    assert 'Session 1' in titles
    assert 'Session 2' in titles


def test_get_session_messages(client, auth_headers):
    """GET /api/chat/sessions/<id>/messages should return messages."""
    # Create session
    resp = client.post('/api/chat/sessions', json={'title': 'Test'}, headers=auth_headers)
    session_id = resp.get_json()['id']

    # Get messages (empty initially)
    resp = client.get(f'/api/chat/sessions/{session_id}/messages', headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_delete_chat_session(client, auth_headers):
    """DELETE /api/chat/sessions/<id> should delete session."""
    resp = client.post('/api/chat/sessions', json={'title': 'To Delete'}, headers=auth_headers)
    session_id = resp.get_json()['id']

    resp = client.delete(f'/api/chat/sessions/{session_id}', headers=auth_headers)
    assert resp.status_code == 200

    # Should be gone
    resp = client.get(f'/api/chat/sessions/{session_id}/messages', headers=auth_headers)
    assert resp.status_code == 404


def test_chat_stores_messages_in_session(client, auth_headers):
    """POST /api/chat with session_id should persist messages."""
    # Create session
    resp = client.post('/api/chat/sessions', json={'title': 'Persistence Test'}, headers=auth_headers)
    session_id = resp.get_json()['id']

    # Send a chat message with session_id (will fail without OPENAI_API_KEY,
    # but messages should still be stored before the LLM call)
    resp = client.post('/api/chat', json={
        'message': 'Τι είναι ΚΔΑΠ;',
        'session_id': session_id,
        'chat_history': []
    }, headers=auth_headers)
    # Even if LLM fails, we get 200 with an error reply
    assert resp.status_code == 200

    # Verify messages were stored
    resp = client.get(f'/api/chat/sessions/{session_id}/messages', headers=auth_headers)
    messages = resp.get_json()
    assert len(messages) >= 1  # At least the user message
    assert any(m['content'] == 'Τι είναι ΚΔΑΠ;' for m in messages)


def test_session_belongs_to_user(client, auth_headers, app):
    """Users should not access other users' sessions."""
    # Create session as testuser
    resp = client.post('/api/chat/sessions', json={'title': 'Private'}, headers=auth_headers)
    session_id = resp.get_json()['id']

    # Create a second user
    from my_project.models import User
    from my_project.extensions import db
    with app.app_context():
        user2 = User.query.filter_by(username='otheruser').first()
        if not user2:
            user2 = User(username='otheruser', email='other@example.com', role='guest')
            user2.set_password('otherpass123')
            db.session.add(user2)
            db.session.commit()

    # Login as second user
    resp = client.post('/api/auth/login', json={
        'username': 'otheruser', 'password': 'otherpass123'
    })
    other_headers = {'Authorization': f'Bearer {resp.get_json()["access_token"]}'}

    # Try to access first user's session
    resp = client.get(f'/api/chat/sessions/{session_id}/messages', headers=other_headers)
    assert resp.status_code == 404  # Not found (not 403 — don't leak existence)


def test_chat_rate_limit_from_config(app):
    """Rate limit should be configurable via app config."""
    with app.app_context():
        # Testing config should have a rate limit value
        assert 'AI_CHAT_RATE_LIMIT' in app.config
