"""Tests for template versioning."""
import pytest


@pytest.fixture
def versioned_template(app):
    from my_project.documents.models import DecisionTemplate
    from my_project.extensions import db as _db
    with app.app_context():
        tpl = DecisionTemplate(
            type='version_test', title='Version Test Template',
            body_template='<p>Version 1</p>', version=1,
            schema={'fields': []}, is_active=True,
        )
        _db.session.add(tpl)
        _db.session.commit()
        return tpl.id


class TestTemplateVersioning:
    def test_clone_creates_new_version(self, app, client, auth_headers, versioned_template):
        response = client.post(
            f'/api/templates/{versioned_template}/new-version',
            json={'body_template': '<p>Version 2</p>'},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data['version'] == 2
        assert data['is_active'] is True

    def test_old_version_deactivated(self, app, client, auth_headers, versioned_template):
        client.post(
            f'/api/templates/{versioned_template}/new-version',
            json={'body_template': '<p>Version 2</p>'},
            headers=auth_headers,
        )
        from my_project.documents.models import DecisionTemplate
        with app.app_context():
            old = DecisionTemplate.query.get(versioned_template)
            assert old.is_active is False

    def test_list_only_shows_active(self, app, client, auth_headers, versioned_template):
        # Count active version_test templates before cloning
        before = client.get('/api/templates', headers=auth_headers)
        before_count = len([t for t in before.get_json()
                           if t['type'] == 'version_test'])

        client.post(
            f'/api/templates/{versioned_template}/new-version',
            json={},
            headers=auth_headers,
        )
        response = client.get('/api/templates', headers=auth_headers)
        after_count = len([t for t in response.get_json()
                          if t['type'] == 'version_test'])
        # Count should stay the same: old deactivated, new activated
        assert after_count == before_count

    def test_old_decision_keeps_old_template(self, app, client, auth_headers, versioned_template):
        """Decisions created with v1 should still reference v1."""
        # Create decision with v1
        resp = client.post('/api/decisions', json={
            'template_id': versioned_template, 'data': {},
        }, headers=auth_headers)
        decision_id = resp.get_json()['id']
        old_template_id = versioned_template

        # Create v2
        client.post(
            f'/api/templates/{versioned_template}/new-version',
            json={'body_template': '<p>Version 2</p>'},
            headers=auth_headers,
        )

        # Check decision still references v1
        detail = client.get(f'/api/decisions/{decision_id}', headers=auth_headers)
        assert detail.get_json()['template_id'] == old_template_id
