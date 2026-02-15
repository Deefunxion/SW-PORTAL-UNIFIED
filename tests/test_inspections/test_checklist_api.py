"""Smoke tests for checklist template endpoints."""


def test_list_checklist_templates_requires_auth(client):
    resp = client.get('/api/checklist-templates')
    assert resp.status_code == 401


def test_list_checklist_templates(client, auth_headers):
    resp = client.get('/api/checklist-templates', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)


def test_get_checklist_by_type_requires_auth(client):
    resp = client.get('/api/checklist-templates/1')
    assert resp.status_code == 401


def test_get_checklist_by_type_found(client, auth_headers, app):
    from my_project.inspections.models import ChecklistTemplate
    from my_project.registry.models import StructureType
    from my_project.extensions import db

    with app.app_context():
        stype = StructureType.query.first()
        if not stype:
            stype = StructureType(code='CL-TEST', name='Checklist Test Type')
            db.session.add(stype)
            db.session.flush()

        tmpl = ChecklistTemplate.query.filter_by(structure_type_id=stype.id).first()
        if not tmpl:
            tmpl = ChecklistTemplate(
                structure_type_id=stype.id,
                name='Test Checklist',
                version=1,
                items=[{'category': 'Test', 'checks': []}],
                is_active=True,
            )
            db.session.add(tmpl)
            db.session.commit()
        type_id = stype.id

    resp = client.get(f'/api/checklist-templates/{type_id}', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'items' in data
    assert data['name'] == 'Test Checklist'


def test_get_checklist_by_type_not_found(client, auth_headers):
    resp = client.get('/api/checklist-templates/99999', headers=auth_headers)
    assert resp.status_code == 404
