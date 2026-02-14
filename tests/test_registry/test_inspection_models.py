import pytest
from datetime import date


def test_committee_creation(app):
    from my_project.inspections.models import InspectionCommittee
    from my_project.extensions import db
    with app.app_context():
        c = InspectionCommittee(decision_number='AP-001/2026', appointed_date=date(2026, 1, 15))
        db.session.add(c)
        db.session.commit()
        assert c.id is not None
        assert c.status == 'active'


def test_inspection_creation(app):
    from my_project.inspections.models import Inspection, InspectionCommittee
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db
    with app.app_context():
        st = StructureType.query.first() or StructureType(code='T1', name='T1')
        db.session.add(st)
        db.session.flush()
        s = Structure(code='INS-S1', name='Test', type_id=st.id)
        db.session.add(s)
        c = InspectionCommittee(decision_number='AP-002', appointed_date=date(2026, 1, 1))
        db.session.add(c)
        db.session.flush()
        insp = Inspection(structure_id=s.id, committee_id=c.id, type='regular', scheduled_date=date(2026, 3, 1))
        db.session.add(insp)
        db.session.commit()
        assert insp.id is not None
        assert insp.status == 'scheduled'
