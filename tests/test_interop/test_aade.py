def test_aade_lookup_requires_auth(client):
    resp = client.post('/api/interop/aade/lookup', json={'afm': '012345678'})
    assert resp.status_code == 401


def test_aade_lookup_found(client, auth_headers):
    resp = client.post('/api/interop/aade/lookup', headers=auth_headers,
                       json={'afm': '012345678'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['found'] is True
    assert 'name' in data
    assert 'address' in data


def test_aade_lookup_not_found(client, auth_headers):
    resp = client.post('/api/interop/aade/lookup', headers=auth_headers,
                       json={'afm': '111111111'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['found'] is False


def test_aade_lookup_invalid_afm(client, auth_headers):
    resp = client.post('/api/interop/aade/lookup', headers=auth_headers,
                       json={'afm': '123'})
    assert resp.status_code == 400


def test_aade_lookup_creates_log(client, auth_headers, app):
    from my_project.interop.models import InteropLog
    with app.app_context():
        before = InteropLog.query.count()

    client.post('/api/interop/aade/lookup', headers=auth_headers,
                json={'afm': '012345678'})

    with app.app_context():
        after = InteropLog.query.count()
        assert after > before


def test_interop_log_requires_admin(client, auth_headers):
    resp = client.get('/api/interop/log', headers=auth_headers)
    assert resp.status_code == 403


def test_interop_log_as_admin(client, admin_headers):
    resp = client.get('/api/interop/log', headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)
