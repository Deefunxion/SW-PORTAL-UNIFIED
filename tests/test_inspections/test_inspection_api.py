"""Tests for inspection API with inspector body support."""
from datetime import date
import uuid


def _create_structure(app):
    """Helper: create a structure for testing."""
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db

    with app.app_context():
        st = StructureType.query.first()
        if not st:
            st = StructureType(name='API Test Type', code='APT')
            db.session.add(st)
            db.session.flush()
        code = f'AP{uuid.uuid4().hex[:6].upper()}'
        s = Structure(name='API Test Structure', code=code,
                      type_id=st.id, status='active')
        db.session.add(s)
        db.session.commit()
        return s.id


class TestInspectionAPIWithInspector:
    def test_create_inspection_with_inspector_id(self, app, client, admin_headers):
        sid = _create_structure(app)
        with app.app_context():
            from my_project.models import User
            admin = User.query.filter_by(username='testadmin').first()
            admin_id = admin.id

        resp = client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'inspector_id': admin_id,
            'type': 'regular',
            'scheduled_date': date.today().isoformat(),
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['inspector_id'] == admin_id
        assert data['committee_id'] is None

    def test_create_inspection_without_body_fails(self, app, client, admin_headers):
        sid = _create_structure(app)
        resp = client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'type': 'regular',
            'scheduled_date': date.today().isoformat(),
        })
        assert resp.status_code == 400

    def test_get_inspection_includes_inspector(self, app, client, admin_headers):
        sid = _create_structure(app)
        with app.app_context():
            from my_project.models import User
            admin = User.query.filter_by(username='testadmin').first()
            admin_id = admin.id

        resp = client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'inspector_id': admin_id,
            'type': 'regular',
            'scheduled_date': date.today().isoformat(),
        })
        insp_id = resp.get_json()['id']

        resp = client.get(f'/api/inspections/{insp_id}', headers=admin_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['inspector'] is not None
        assert data['inspector']['username'] == 'testadmin'

    def test_list_inspections_filter_by_inspector(self, app, client, admin_headers):
        sid = _create_structure(app)
        with app.app_context():
            from my_project.models import User
            admin = User.query.filter_by(username='testadmin').first()
            admin_id = admin.id

        client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'inspector_id': admin_id,
            'type': 'regular',
            'scheduled_date': date.today().isoformat(),
        })

        resp = client.get(f'/api/inspections?inspector_id={admin_id}',
                          headers=admin_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data['inspections']) >= 1
