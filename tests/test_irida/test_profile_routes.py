"""Tests for /api/profile/irida routes."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', '9i7RJOaT-0eIX4hCJQtDv-aPBH04vPv77JjFkU2cf0k=')


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
