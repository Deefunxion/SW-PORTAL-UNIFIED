import pytest


class TestOversightAPI:
    def test_dashboard_requires_auth(self, client):
        assert client.get('/api/oversight/dashboard').status_code == 401

    def test_dashboard(self, client, auth_headers):
        response = client.get('/api/oversight/dashboard', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'stats' in data
        assert 'total_structures' in data['stats']
        assert 'active_structures' in data['stats']
        assert 'total_inspections' in data['stats']
        assert 'pending_reports' in data['stats']
        assert 'structures_by_type' in data
        assert 'inspections_by_month' in data
        assert 'recent_inspections' in data
        assert 'recent_reports' in data

    def test_alerts(self, client, auth_headers):
        response = client.get('/api/oversight/alerts', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_list_user_roles(self, client, auth_headers):
        response = client.get('/api/user-roles', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_assign_role_admin_only(self, client, auth_headers):
        response = client.post('/api/user-roles', headers=auth_headers, json={
            'user_id': 1, 'role': 'social_advisor'
        })
        assert response.status_code == 403

    def test_assign_role(self, client, admin_headers, app):
        with app.app_context():
            from my_project.models import User
            user = User.query.filter_by(username='testuser').first()
            if not user:
                return
            uid = user.id

        response = client.post('/api/user-roles', headers=admin_headers, json={
            'user_id': uid, 'role': 'committee_member'
        })
        assert response.status_code == 201
        data = response.get_json()
        assert data['role'] == 'committee_member'

    def test_assign_invalid_role(self, client, admin_headers):
        response = client.post('/api/user-roles', headers=admin_headers, json={
            'user_id': 1, 'role': 'fake_role'
        })
        assert response.status_code == 400

    def test_remove_role(self, client, admin_headers, app):
        with app.app_context():
            from my_project.oversight.models import UserRole
            role = UserRole.query.first()
            if not role:
                return
            rid = role.id

        response = client.delete(f'/api/user-roles/{rid}', headers=admin_headers)
        assert response.status_code == 200

    def test_create_advisor_report(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import Structure
            s = Structure.query.first()
            if not s:
                return
            sid = s.id

        data = {
            'type': 'regular',
            'assessment': 'Καλή λειτουργία δομής.',
            'recommendations': 'Συνέχιση τρέχουσας λειτουργίας.',
            'drafted_date': '2026-02-14',
        }
        response = client.post(
            f'/api/structures/{sid}/advisor-reports',
            headers=admin_headers,
            data=data,
            content_type='multipart/form-data'
        )
        assert response.status_code == 201
        result = response.get_json()
        assert result['status'] == 'approved'
        assert result['type'] == 'regular'

    def test_list_advisor_reports(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import Structure
            s = Structure.query.first()
            if not s:
                return
            sid = s.id

        response = client.get(f'/api/structures/{sid}/advisor-reports', headers=admin_headers)
        assert response.status_code == 200
        assert isinstance(response.get_json(), list)

    def test_approve_report(self, client, admin_headers, app):
        with app.app_context():
            from my_project.oversight.models import SocialAdvisorReport
            from my_project.extensions import db as _db
            report = SocialAdvisorReport.query.filter_by(status='draft').first()
            if not report:
                return
            # Must be submitted first
            report.status = 'submitted'
            _db.session.commit()
            rid = report.id

        response = client.patch(
            f'/api/advisor-reports/{rid}/approve',
            headers=admin_headers,
            json={'action': 'approve'}
        )
        assert response.status_code == 200
        assert response.get_json()['status'] == 'approved'
