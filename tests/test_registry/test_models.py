import pytest


def test_structure_type_creation(app):
    from my_project.registry.models import StructureType
    from my_project.extensions import db
    with app.app_context():
        st = StructureType(code='TEST', name='Test Type')
        db.session.add(st)
        db.session.commit()
        assert st.id is not None
        assert st.to_dict()['code'] == 'TEST'


def test_structure_creation(app):
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db
    with app.app_context():
        st = StructureType.query.filter_by(code='TEST').first()
        if not st:
            st = StructureType(code='TEST2', name='Test Type 2')
            db.session.add(st)
            db.session.commit()
        s = Structure(code='S001', name='Test Structure', type_id=st.id, status='active')
        db.session.add(s)
        db.session.commit()
        assert s.id is not None
        d = s.to_dict()
        assert d['code'] == 'S001'
        assert d['status'] == 'active'
