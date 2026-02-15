"""Smoke tests for inspection and report update endpoints."""


def _ensure_inspection(app):
    """Ensure a test inspection exists, return its id."""
    from my_project.inspections.models import Inspection, InspectionCommittee
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db
    from datetime import date

    with app.app_context():
        insp = Inspection.query.first()
        if insp:
            return insp.id

        stype = StructureType.query.first()
        if not stype:
            stype = StructureType(code='UPD-T', name='Update Test')
            db.session.add(stype)
            db.session.flush()

        s = Structure.query.first()
        if not s:
            s = Structure(code='UPD-S001', name='Update Test Structure', type_id=stype.id)
            db.session.add(s)
            db.session.flush()

        c = InspectionCommittee.query.first()
        if not c:
            c = InspectionCommittee(decision_number='AP-UPD', appointed_date=date(2026, 1, 1))
            db.session.add(c)
            db.session.flush()

        insp = Inspection(
            structure_id=s.id,
            committee_id=c.id,
            type='regular',
            scheduled_date=date(2026, 6, 1),
        )
        db.session.add(insp)
        db.session.commit()
        return insp.id


def _ensure_report(app):
    """Ensure a test inspection report exists, return its id.
    Creates a dedicated inspection to avoid unique constraint conflicts."""
    from my_project.inspections.models import (
        Inspection, InspectionReport, InspectionCommittee,
    )
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db
    from datetime import date

    with app.app_context():
        # Check for an existing report we can reuse
        report = InspectionReport.query.filter_by(
            protocol_number='ΑΠ-RPT-TEST/2026'
        ).first()
        if report:
            return report.id

        # Create a dedicated inspection for report tests
        stype = StructureType.query.first()
        if not stype:
            stype = StructureType(code='RPT-T', name='Report Test')
            db.session.add(stype)
            db.session.flush()

        s = Structure.query.first()
        if not s:
            s = Structure(code='RPT-S001', name='Report Test Structure', type_id=stype.id)
            db.session.add(s)
            db.session.flush()

        c = InspectionCommittee.query.first()
        if not c:
            c = InspectionCommittee(decision_number='AP-RPT', appointed_date=date(2026, 1, 1))
            db.session.add(c)
            db.session.flush()

        insp = Inspection(
            structure_id=s.id,
            committee_id=c.id,
            type='extraordinary',
            scheduled_date=date(2026, 7, 15),
        )
        db.session.add(insp)
        db.session.flush()

        report = InspectionReport(
            inspection_id=insp.id,
            findings='Test findings for report update',
            recommendations='Test recommendations',
            protocol_number='ΑΠ-RPT-TEST/2026',
            status='submitted',
        )
        db.session.add(report)
        db.session.commit()
        return report.id


# --- PATCH /api/inspections/<id> ---

def test_update_inspection_requires_auth(client, app):
    iid = _ensure_inspection(app)
    resp = client.patch(f'/api/inspections/{iid}', json={'status': 'completed'})
    assert resp.status_code == 401


def test_update_inspection_requires_permission(client, auth_headers, app):
    iid = _ensure_inspection(app)
    resp = client.patch(f'/api/inspections/{iid}', headers=auth_headers,
                        json={'status': 'completed'})
    assert resp.status_code == 403


def test_update_inspection_as_admin(client, admin_headers, app):
    iid = _ensure_inspection(app)
    resp = client.patch(f'/api/inspections/{iid}', headers=admin_headers,
                        json={'notes': 'Updated by test'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['notes'] == 'Updated by test'


def test_update_inspection_not_found(client, admin_headers):
    resp = client.patch('/api/inspections/99999', headers=admin_headers,
                        json={'status': 'completed'})
    assert resp.status_code == 404


# --- PATCH /api/inspection-reports/<id> ---

def test_update_report_requires_auth(client, app):
    rid = _ensure_report(app)
    resp = client.patch(f'/api/inspection-reports/{rid}',
                        json={'status': 'approved'})
    assert resp.status_code == 401


def test_update_report_requires_director(client, auth_headers, app):
    rid = _ensure_report(app)
    resp = client.patch(f'/api/inspection-reports/{rid}', headers=auth_headers,
                        json={'status': 'approved'})
    assert resp.status_code == 403


def test_update_report_as_admin(client, admin_headers, app):
    rid = _ensure_report(app)
    resp = client.patch(f'/api/inspection-reports/{rid}', headers=admin_headers,
                        json={'status': 'approved'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['status'] == 'approved'


def test_update_report_as_director(client, director_headers, app):
    rid = _ensure_report(app)
    resp = client.patch(f'/api/inspection-reports/{rid}', headers=director_headers,
                        json={'status': 'finalized'})
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['status'] == 'finalized'
