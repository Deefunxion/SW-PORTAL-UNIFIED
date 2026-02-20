"""Tests for inspection with Social Advisor as inspector body."""
from datetime import date


class TestInspectorBody:
    def test_inspection_with_inspector_instead_of_committee(self, app):
        """An inspection can have inspector_id instead of committee_id."""
        with app.app_context():
            from my_project.inspections.models import Inspection
            from my_project.registry.models import Structure, StructureType
            from my_project.models import User
            from my_project.extensions import db

            # Create structure
            st = StructureType.query.first()
            if not st:
                st = StructureType(name='Test', code='TST')
                db.session.add(st)
                db.session.flush()
            s = Structure(name='Test Structure', code='TS01',
                          type_id=st.id, status='active')
            db.session.add(s)

            # Create inspector user
            inspector = User.query.filter_by(username='inspector_test').first()
            if not inspector:
                inspector = User(username='inspector_test',
                                 email='inspector@test.com', role='staff')
                inspector.set_password('pass123')
                db.session.add(inspector)
            db.session.flush()

            insp = Inspection(
                structure_id=s.id,
                committee_id=None,
                inspector_id=inspector.id,
                type='regular',
                scheduled_date=date.today(),
            )
            db.session.add(insp)
            db.session.commit()

            assert insp.id is not None
            assert insp.committee_id is None
            assert insp.inspector_id == inspector.id

    def test_to_dict_includes_inspector_info(self, app):
        """to_dict() should include inspector data when set."""
        with app.app_context():
            from my_project.inspections.models import Inspection
            from my_project.registry.models import Structure, StructureType
            from my_project.models import User
            from my_project.extensions import db

            st = StructureType.query.first()
            if not st:
                st = StructureType(name='Test2', code='TS2')
                db.session.add(st)
                db.session.flush()
            s = Structure(name='Dict Test', code='DT01',
                          type_id=st.id, status='active')
            db.session.add(s)

            inspector = User.query.filter_by(username='inspector_dict').first()
            if not inspector:
                inspector = User(username='inspector_dict',
                                 email='insdict@test.com', role='staff')
                inspector.set_password('pass123')
                db.session.add(inspector)
            db.session.flush()

            insp = Inspection(
                structure_id=s.id,
                inspector_id=inspector.id,
                type='regular',
                scheduled_date=date.today(),
            )
            db.session.add(insp)
            db.session.commit()

            d = insp.to_dict()
            assert d['inspector_id'] == inspector.id
            assert d['inspector'] is not None
            assert d['inspector']['username'] == 'inspector_dict'
            assert d['committee_id'] is None
