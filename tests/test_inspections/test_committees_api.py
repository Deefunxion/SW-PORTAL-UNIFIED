"""Smoke tests for committee management endpoints."""


def _ensure_committee(app):
    """Ensure a test committee exists, return its id."""
    from my_project.inspections.models import InspectionCommittee
    from my_project.extensions import db
    from datetime import date

    with app.app_context():
        c = InspectionCommittee.query.first()
        if not c:
            c = InspectionCommittee(
                decision_number='AP-CMTE-TEST',
                appointed_date=date(2026, 1, 1),
            )
            db.session.add(c)
            db.session.commit()
        return c.id


def _ensure_structure(app):
    """Ensure a test structure exists, return its id."""
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db

    with app.app_context():
        stype = StructureType.query.first()
        if not stype:
            stype = StructureType(code='CMTE-T', name='Committee Test')
            db.session.add(stype)
            db.session.flush()
        s = Structure.query.first()
        if not s:
            s = Structure(code='CMTE-S001', name='Committee Test Structure', type_id=stype.id)
            db.session.add(s)
            db.session.commit()
        return s.id


# --- GET /api/committees/<id> ---

def test_get_committee_detail_requires_auth(client, app):
    cid = _ensure_committee(app)
    resp = client.get(f'/api/committees/{cid}')
    assert resp.status_code == 401


def test_get_committee_detail(client, auth_headers, app):
    cid = _ensure_committee(app)
    resp = client.get(f'/api/committees/{cid}', headers=auth_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert 'decision_number' in data


def test_get_committee_not_found(client, auth_headers):
    resp = client.get('/api/committees/99999', headers=auth_headers)
    assert resp.status_code == 404


# --- PUT /api/committees/<id> ---

def test_update_committee_requires_auth(client, app):
    cid = _ensure_committee(app)
    resp = client.put(f'/api/committees/{cid}', json={'status': 'inactive'})
    assert resp.status_code == 401


def test_update_committee_requires_permission(client, auth_headers, app):
    cid = _ensure_committee(app)
    resp = client.put(f'/api/committees/{cid}', headers=auth_headers,
                      json={'status': 'inactive'})
    assert resp.status_code == 403


def test_update_committee_as_admin(client, admin_headers, app):
    cid = _ensure_committee(app)
    resp = client.put(f'/api/committees/{cid}', headers=admin_headers,
                      json={'notes': 'Updated by test'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['notes'] == 'Updated by test'


# --- POST /api/committees/<id>/members ---

def test_add_member_requires_auth(client, app):
    cid = _ensure_committee(app)
    resp = client.post(f'/api/committees/{cid}/members', json={'user_id': 1})
    assert resp.status_code == 401


def test_add_member_requires_permission(client, auth_headers, app):
    cid = _ensure_committee(app)
    resp = client.post(f'/api/committees/{cid}/members', headers=auth_headers,
                       json={'user_id': 1})
    assert resp.status_code == 403


def test_add_member_as_admin(client, admin_headers, app):
    cid = _ensure_committee(app)
    with app.app_context():
        from my_project.models import User
        user = User.query.filter_by(username='testuser').first()
        uid = user.id if user else 1

    resp = client.post(f'/api/committees/{cid}/members', headers=admin_headers,
                       json={'user_id': uid, 'role': 'member'})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['role'] == 'member'


# --- DELETE /api/committees/<id>/members/<user_id> ---

def test_remove_member_requires_auth(client, app):
    cid = _ensure_committee(app)
    resp = client.delete(f'/api/committees/{cid}/members/1')
    assert resp.status_code == 401


def test_remove_member_requires_permission(client, auth_headers, app):
    cid = _ensure_committee(app)
    resp = client.delete(f'/api/committees/{cid}/members/1', headers=auth_headers)
    assert resp.status_code == 403


def test_remove_member_as_admin(client, admin_headers, app):
    """Remove the member we just added."""
    cid = _ensure_committee(app)
    with app.app_context():
        from my_project.inspections.models import CommitteeMembership
        m = CommitteeMembership.query.filter_by(committee_id=cid).first()
        if not m:
            return  # nothing to remove, skip gracefully
        uid = m.user_id

    resp = client.delete(f'/api/committees/{cid}/members/{uid}', headers=admin_headers)
    assert resp.status_code == 200


# --- POST /api/committees/<id>/structures ---

def test_assign_structure_requires_auth(client, app):
    cid = _ensure_committee(app)
    resp = client.post(f'/api/committees/{cid}/structures',
                       json={'structure_id': 1})
    assert resp.status_code == 401


def test_assign_structure_requires_permission(client, auth_headers, app):
    cid = _ensure_committee(app)
    sid = _ensure_structure(app)
    resp = client.post(f'/api/committees/{cid}/structures', headers=auth_headers,
                       json={'structure_id': sid})
    assert resp.status_code == 403


def test_assign_structure_as_admin(client, admin_headers, app):
    cid = _ensure_committee(app)
    sid = _ensure_structure(app)
    resp = client.post(f'/api/committees/{cid}/structures', headers=admin_headers,
                       json={'structure_id': sid})
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['structure_id'] == sid
