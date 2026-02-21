"""Tests for POST /api/advisor-reports/<id>/send-to-irida."""
import os
os.environ.setdefault('IRIDA_ENCRYPTION_KEY', '9i7RJOaT-0eIX4hCJQtDv-aPBH04vPv77JjFkU2cf0k=')
from datetime import date


_counter = 0

def _create_structure_and_report(app, author_id):
    """Helper: create a structure + approved advisor report."""
    global _counter
    _counter += 1
    from my_project.registry.models import Structure, StructureType
    from my_project.oversight.models import SocialAdvisorReport
    from my_project.extensions import db

    with app.app_context():
        # Ensure structure type exists
        st = StructureType.query.first()
        if not st:
            st = StructureType(name='Test Type', code='TST')
            db.session.add(st)
            db.session.flush()

        s = Structure(
            name=f'Δομή Τεστ {_counter}', code=f'TST{_counter:03d}', type_id=st.id,
            representative_name='Test Rep', status='active',
        )
        db.session.add(s)
        db.session.flush()

        report = SocialAdvisorReport(
            structure_id=s.id,
            author_id=author_id,
            drafted_date=date.today(),
            type='regular',
            assessment='Test assessment',
            status='approved',
        )
        db.session.add(report)
        db.session.commit()
        return s.id, report.id


class TestSendToIrida:
    def test_send_without_irida_credentials_returns_400(self, app, client, auth_headers):
        _, report_id = _create_structure_and_report(app, author_id=1)
        resp = client.post(
            f'/api/advisor-reports/{report_id}/send-to-irida',
            headers=auth_headers,
            json={'recipients': ['org1']},
        )
        # Should fail because user has no IRIDA credentials
        assert resp.status_code == 400
        assert 'ΙΡΙΔΑ' in resp.get_json()['error'] or 'credentials' in resp.get_json()['error'].lower()

    def test_send_without_recipients_returns_400(self, app, client, auth_headers):
        _, report_id = _create_structure_and_report(app, author_id=1)
        resp = client.post(
            f'/api/advisor-reports/{report_id}/send-to-irida',
            headers=auth_headers,
            json={},
        )
        assert resp.status_code == 400

    def test_send_nonexistent_report_returns_404(self, client, auth_headers):
        resp = client.post(
            '/api/advisor-reports/99999/send-to-irida',
            headers=auth_headers,
            json={'recipients': ['org1']},
        )
        assert resp.status_code == 404
