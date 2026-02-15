def test_list_sanction_rules_requires_auth(client):
    resp = client.get('/api/sanction-rules')
    assert resp.status_code == 401


def test_list_sanction_rules(client, auth_headers):
    resp = client.get('/api/sanction-rules', headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.get_json(), list)


def test_calculate_fine_endpoint(client, auth_headers, app):
    from my_project.sanctions.models import SanctionRule
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db

    with app.app_context():
        stype = StructureType.query.filter_by(code='MFH').first()
        if not stype:
            stype = StructureType(code='MFH', name='Test MFH')
            db.session.add(stype)
            db.session.commit()

        structure = Structure.query.first()
        if not structure:
            structure = Structure(code='TEST-001', name='Test Structure', type_id=stype.id)
            db.session.add(structure)
            db.session.commit()

        rule = SanctionRule.query.filter_by(violation_code='NO_LICENSE').first()
        if not rule:
            rule = SanctionRule(violation_code='NO_LICENSE', violation_name='Test',
                                base_fine=10000.0)
            db.session.add(rule)
            db.session.commit()

    resp = client.post('/api/sanctions/calculate', headers=auth_headers, json={
        'violation_code': 'NO_LICENSE',
        'structure_id': 1,
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['base_fine'] == 10000.0
    assert 'final_amount' in data


def test_calculate_fine_missing_params(client, auth_headers):
    resp = client.post('/api/sanctions/calculate', headers=auth_headers, json={})
    assert resp.status_code == 400


def test_calculate_fine_unknown_violation(client, auth_headers):
    resp = client.post('/api/sanctions/calculate', headers=auth_headers, json={
        'violation_code': 'NONEXISTENT',
        'structure_id': 999,
    })
    assert resp.status_code == 404


def test_create_sanction_rule_requires_admin(client, auth_headers):
    """Non-admin users should get 403."""
    resp = client.post('/api/sanction-rules', headers=auth_headers, json={
        'violation_code': 'TEST_CODE',
        'violation_name': 'Test',
        'base_fine': 1000.0,
    })
    assert resp.status_code == 403


def test_create_sanction_rule_as_admin(client, admin_headers):
    resp = client.post('/api/sanction-rules', headers=admin_headers, json={
        'violation_code': 'ADMIN_TEST',
        'violation_name': 'Admin Test Rule',
        'base_fine': 5000.0,
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['violation_code'] == 'ADMIN_TEST'
