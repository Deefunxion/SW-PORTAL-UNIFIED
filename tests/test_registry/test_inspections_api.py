import pytest
from io import BytesIO


class TestInspectionsAPI:
    def test_list_inspections_requires_auth(self, client):
        assert client.get('/api/inspections').status_code == 401

    def test_list_inspections(self, client, auth_headers):
        response = client.get('/api/inspections', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'inspections' in data
        assert 'total' in data

    def test_list_committees(self, client, auth_headers):
        response = client.get('/api/committees', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_create_inspection_requires_permission(self, client, auth_headers):
        response = client.post('/api/inspections', headers=auth_headers, json={
            'structure_id': 1, 'committee_id': 1, 'type': 'regular',
            'scheduled_date': '2026-06-01'
        })
        assert response.status_code == 403

    def test_create_committee(self, client, admin_headers):
        response = client.post('/api/committees', headers=admin_headers, json={
            'decision_number': 'TEST-AP-001/2026',
            'appointed_date': '2026-01-15',
        })
        assert response.status_code == 201
        data = response.get_json()
        assert data['decision_number'] == 'TEST-AP-001/2026'
        assert data['status'] == 'active'

    def test_create_inspection(self, client, admin_headers, app):
        # First ensure we have a structure and committee
        with app.app_context():
            from my_project.registry.models import Structure, StructureType
            from my_project.inspections.models import InspectionCommittee
            from my_project.extensions import db

            st = StructureType.query.first()
            if not st:
                st = StructureType(code='INSP-T', name='Insp Type')
                db.session.add(st)
                db.session.flush()

            s = Structure.query.filter_by(code='INSP-S001').first()
            if not s:
                s = Structure(code='INSP-S001', name='Inspection Test Structure', type_id=st.id)
                db.session.add(s)
                db.session.flush()

            c = InspectionCommittee.query.first()
            if not c:
                from datetime import date
                c = InspectionCommittee(decision_number='AP-INSP', appointed_date=date(2026, 1, 1))
                db.session.add(c)
                db.session.flush()

            db.session.commit()
            sid = s.id
            cid = c.id

        response = client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'committee_id': cid,
            'type': 'regular',
            'scheduled_date': '2026-06-01'
        })
        assert response.status_code == 201
        data = response.get_json()
        assert data['type'] == 'regular'
        assert data['status'] == 'scheduled'

    def test_get_inspection_detail(self, client, admin_headers, app):
        with app.app_context():
            from my_project.inspections.models import Inspection
            insp = Inspection.query.first()
            if not insp:
                return
            iid = insp.id

        response = client.get(f'/api/inspections/{iid}', headers=admin_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'committee' in data

    def test_submit_report_multipart(self, client, admin_headers, app):
        with app.app_context():
            from my_project.inspections.models import Inspection
            insp = Inspection.query.first()
            if not insp:
                return
            iid = insp.id

        data = {
            'findings': 'Κανονική λειτουργία. Τηρούνται οι κανονισμοί.',
            'recommendations': 'Συνέχιση κανονικής λειτουργίας.',
            'protocol_number': 'ΑΠ-123/2026',
            'conclusion': 'normal',
        }
        response = client.post(
            f'/api/inspections/{iid}/report',
            headers=admin_headers,
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 201
        result = response.get_json()
        assert result['status'] == 'submitted'
        assert result['findings'] == data['findings']

    def test_get_report(self, client, admin_headers, app):
        with app.app_context():
            from my_project.inspections.models import Inspection, InspectionReport
            report = InspectionReport.query.first()
            if not report:
                return
            iid = report.inspection_id

        response = client.get(f'/api/inspections/{iid}/report', headers=admin_headers)
        assert response.status_code == 200
