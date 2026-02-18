"""Tests for bulk document generation endpoint."""
import pytest


@pytest.fixture
def bulk_template(app):
    from my_project.documents.models import DecisionTemplate
    from my_project.extensions import db as _db
    with app.app_context():
        tpl = DecisionTemplate.query.filter_by(type='bulk_test').first()
        if not tpl:
            tpl = DecisionTemplate(
                type='bulk_test', title='Bulk Test',
                body_template='<p>Decision for {{name}}</p>',
                schema={'fields': [{'key': 'name', 'label': 'Name',
                                    'type': 'text', 'required': True}]},
            )
            _db.session.add(tpl)
            _db.session.commit()
        return tpl.id


class TestBulkCreation:
    def test_creates_multiple_records(self, app, client, auth_headers, bulk_template):
        response = client.post('/api/decisions/bulk', json={
            'template_id': bulk_template,
            'records': [
                {'data': {'name': 'Camp Alpha'}},
                {'data': {'name': 'Camp Beta'}},
                {'data': {'name': 'Camp Gamma'}},
            ],
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.get_json()
        assert len(data['decisions']) == 3

    def test_each_gets_internal_number(self, app, client, auth_headers, bulk_template):
        response = client.post('/api/decisions/bulk', json={
            'template_id': bulk_template,
            'records': [
                {'data': {'name': 'One'}},
                {'data': {'name': 'Two'}},
            ],
        }, headers=auth_headers)
        decisions = response.get_json()['decisions']
        numbers = [d['internal_number'] for d in decisions]
        assert len(set(numbers)) == 2  # all unique

    def test_empty_records_rejected(self, app, client, auth_headers, bulk_template):
        response = client.post('/api/decisions/bulk', json={
            'template_id': bulk_template,
            'records': [],
        }, headers=auth_headers)
        assert response.status_code == 400

    def test_invalid_template_rejected(self, app, client, auth_headers):
        response = client.post('/api/decisions/bulk', json={
            'template_id': 99999,
            'records': [{'data': {'name': 'Test'}}],
        }, headers=auth_headers)
        assert response.status_code == 404
