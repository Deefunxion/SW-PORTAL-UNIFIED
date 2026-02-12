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

def test_knowledge_stats_endpoint(client, auth_headers):
    """Knowledge stats should return counts."""
    response = client.get('/api/knowledge/stats', headers=auth_headers)
    assert response.status_code == 200
    data = response.get_json()
    assert 'total_documents' in data
    assert 'total_chunks' in data
