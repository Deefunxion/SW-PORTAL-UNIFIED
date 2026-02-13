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
