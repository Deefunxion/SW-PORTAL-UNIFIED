"""Tests for internal document numbering (ΠΚΜ-YYYY/NNNN)."""
import pytest
from datetime import datetime


@pytest.fixture
def template(app):
    """Create a test template."""
    from my_project.documents.models import DecisionTemplate
    from my_project.extensions import db as _db
    with app.app_context():
        tpl = DecisionTemplate.query.filter_by(type='test_numbering').first()
        if not tpl:
            tpl = DecisionTemplate(
                type='test_numbering', title='Test Numbering',
                body_template='<p>Test</p>', schema={'fields': []},
            )
            _db.session.add(tpl)
            _db.session.commit()
        return tpl.id


class TestNextInternalNumber:
    def test_first_number_of_year(self, app, client, auth_headers, template):
        response = client.post('/api/decisions', json={
            'template_id': template, 'data': {},
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.get_json()
        year = datetime.utcnow().year
        assert data.get('internal_number') is not None
        assert data['internal_number'].startswith(f'ΠΚΜ-{year}/')

    def test_sequential_numbers(self, app, client, auth_headers, template):
        resp1 = client.post('/api/decisions', json={
            'template_id': template, 'data': {},
        }, headers=auth_headers)
        resp2 = client.post('/api/decisions', json={
            'template_id': template, 'data': {},
        }, headers=auth_headers)
        num1 = resp1.get_json()['internal_number']
        num2 = resp2.get_json()['internal_number']
        # Extract sequential part
        seq1 = int(num1.split('/')[1])
        seq2 = int(num2.split('/')[1])
        assert seq2 == seq1 + 1

    def test_internal_number_in_to_dict(self, app, client, auth_headers, template):
        resp = client.post('/api/decisions', json={
            'template_id': template, 'data': {},
        }, headers=auth_headers)
        rec_id = resp.get_json()['id']
        detail = client.get(f'/api/decisions/{rec_id}', headers=auth_headers)
        assert 'internal_number' in detail.get_json()
