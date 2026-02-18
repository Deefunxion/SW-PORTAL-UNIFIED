"""Tests for SanctionDecision → DecisionRecord bridge."""
import pytest
from datetime import datetime


@pytest.fixture
def sanction_template(app):
    """Create a sanction_fine template."""
    from my_project.documents.models import DecisionTemplate
    from my_project.extensions import db as _db
    with app.app_context():
        tpl = DecisionTemplate.query.filter_by(type='sanction_fine').first()
        if not tpl:
            tpl = DecisionTemplate(
                type='sanction_fine', title='Απόφαση Επιβολής Προστίμου',
                body_template='<p>Πρόστιμο</p>',
                schema={'fields': []},
            )
            _db.session.add(tpl)
            _db.session.commit()
        return tpl.id


@pytest.fixture
def sanction_decision(app, auth_headers, sanction_template):
    """Create a SanctionDecision in 'submitted' status."""
    from my_project.sanctions.models import SanctionDecision
    from my_project.registry.models import StructureType, Structure, Sanction
    from my_project.models import User
    from my_project.extensions import db as _db

    with app.app_context():
        # Get the test user created by auth_headers
        user = User.query.filter_by(username='testuser').first()

        # Ensure structure type exists
        st = StructureType.query.filter_by(code='MFH').first()
        if not st:
            st = StructureType(code='MFH', name='ΜΦΗ',
                               description='Μονάδα Φροντίδας Ηλικιωμένων')
            _db.session.add(st)
            _db.session.flush()

        # Ensure structure exists
        s = Structure.query.filter_by(code='MFH-TEST-01').first()
        if not s:
            s = Structure(name='Test Structure', code='MFH-TEST-01',
                          type_id=st.id, city='Αθήνα', status='active')
            _db.session.add(s)
            _db.session.flush()

        # Create sanction
        sanc = Sanction(structure_id=s.id, type='fine',
                        amount=5000.00, status='imposed')
        _db.session.add(sanc)
        _db.session.flush()

        dec = SanctionDecision(
            sanction_id=sanc.id, status='submitted',
            drafted_by=user.id, final_amount=5000.00,
            obligor_name='Test Company', obligor_afm='123456789',
        )
        _db.session.add(dec)
        _db.session.commit()
        return dec.id


class TestBridge:
    def test_creates_decision_record(self, app, sanction_decision, sanction_template):
        from my_project.documents.bridge import create_decision_from_sanction
        from my_project.sanctions.models import SanctionDecision
        from my_project.extensions import db as _db

        with app.app_context():
            sd = _db.session.get(SanctionDecision, sanction_decision)
            record = create_decision_from_sanction(sd)
            assert record is not None
            assert record.status == 'draft'
            assert record.source_type == 'sanction_decision'
            assert record.source_id == sd.id

    def test_copies_structure_id(self, app, sanction_decision, sanction_template):
        from my_project.documents.bridge import create_decision_from_sanction
        from my_project.sanctions.models import SanctionDecision
        from my_project.extensions import db as _db

        with app.app_context():
            sd = _db.session.get(SanctionDecision, sanction_decision)
            record = create_decision_from_sanction(sd)
            assert record.structure_id == sd.sanction.structure_id

    def test_stores_source_reference(self, app, sanction_decision, sanction_template):
        from my_project.documents.bridge import create_decision_from_sanction
        from my_project.sanctions.models import SanctionDecision
        from my_project.extensions import db as _db

        with app.app_context():
            sd = _db.session.get(SanctionDecision, sanction_decision)
            record = create_decision_from_sanction(sd)
            assert record.data.get('source_sanction_decision_id') == sd.id


class TestDocumentRegistry:
    def test_registry_returns_decision_records(self, app, client, auth_headers):
        """Registry should return decision records including bridged ones."""
        response = client.get('/api/document-registry', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'documents' in data
        assert 'total' in data
        assert 'pages' in data

    def test_registry_filters_by_status(self, app, client, auth_headers):
        response = client.get('/api/document-registry?status=draft', headers=auth_headers)
        assert response.status_code == 200
        for doc in response.get_json()['documents']:
            assert doc['status'] == 'draft'

    def test_registry_filters_by_search(self, app, client, auth_headers):
        response = client.get('/api/document-registry?search=ΠΚΜ', headers=auth_headers)
        assert response.status_code == 200
