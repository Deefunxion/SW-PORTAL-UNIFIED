import pytest


class TestStructuresAPI:
    def test_list_structures_requires_auth(self, client):
        response = client.get('/api/structures')
        assert response.status_code == 401

    def test_list_structures(self, client, auth_headers):
        response = client.get('/api/structures', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'structures' in data
        assert 'total' in data

    def test_create_structure_requires_auth(self, client):
        response = client.post('/api/structures', json={'name': 'Test'})
        assert response.status_code == 401

    def test_get_structure_types(self, client, auth_headers):
        response = client.get('/api/structure-types', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_create_structure(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import StructureType
            st = StructureType.query.first()
            type_id = st.id if st else 1

        response = client.post('/api/structures', headers=admin_headers, json={
            'code': 'API-S001',
            'name': 'Γηροκομείο Αθηνών',
            'type_id': type_id,
            'city': 'Αθήνα',
            'status': 'active'
        })
        assert response.status_code == 201
        data = response.get_json()
        assert data['code'] == 'API-S001'

    def test_create_structure_duplicate_code(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import StructureType
            st = StructureType.query.first()
            type_id = st.id if st else 1

        # Create first
        client.post('/api/structures', headers=admin_headers, json={
            'code': 'DUP-001', 'name': 'First', 'type_id': type_id
        })
        # Duplicate
        response = client.post('/api/structures', headers=admin_headers, json={
            'code': 'DUP-001', 'name': 'Second', 'type_id': type_id
        })
        assert response.status_code == 409

    def test_create_structure_missing_fields(self, client, admin_headers):
        response = client.post('/api/structures', headers=admin_headers, json={
            'name': 'Missing code and type'
        })
        assert response.status_code == 400

    def test_create_structure_forbidden_for_guest(self, client, app):
        """A fresh user with no UserRole entries should get 403."""
        from my_project.models import User
        from my_project.extensions import db as _db

        with app.app_context():
            from my_project.registry.models import StructureType
            st = StructureType.query.first()
            type_id = st.id if st else 1

            # Create a fresh guest user with no roles
            fresh = User.query.filter_by(username='freshguest').first()
            if not fresh:
                fresh = User(username='freshguest', email='fresh@test.com', role='guest')
                fresh.set_password('freshpass123')
                _db.session.add(fresh)
                _db.session.commit()

        # Login as the fresh guest
        resp = client.post('/api/auth/login', json={
            'username': 'freshguest', 'password': 'freshpass123'
        })
        token = resp.get_json()['access_token']
        guest_headers = {'Authorization': f'Bearer {token}'}

        response = client.post('/api/structures', headers=guest_headers, json={
            'code': 'GUEST-001', 'name': 'Guest Attempt', 'type_id': type_id
        })
        assert response.status_code == 403

    def test_get_structure_detail(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import Structure
            s = Structure.query.first()
            if s:
                sid = s.id
            else:
                sid = 999

        response = client.get(f'/api/structures/{sid}', headers=admin_headers)
        assert response.status_code in [200, 404]

    def test_update_structure(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import Structure
            s = Structure.query.first()
            if not s:
                return
            sid = s.id

        response = client.put(f'/api/structures/{sid}', headers=admin_headers, json={
            'city': 'Θεσσαλονίκη'
        })
        assert response.status_code == 200
        assert response.get_json()['city'] == 'Θεσσαλονίκη'

    def test_list_structure_types_post_admin_only(self, client, auth_headers):
        response = client.post('/api/structure-types', headers=auth_headers, json={
            'code': 'NEW', 'name': 'New Type'
        })
        assert response.status_code == 403

    def test_list_licenses(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import Structure
            s = Structure.query.first()
            if not s:
                return
            sid = s.id

        response = client.get(f'/api/structures/{sid}/licenses', headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.get_json(), list)

    def test_list_sanctions(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import Structure
            s = Structure.query.first()
            if not s:
                return
            sid = s.id

        response = client.get(f'/api/structures/{sid}/sanctions', headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.get_json(), list)
