import pytest
from datetime import date


def test_user_role_creation(app):
    from my_project.oversight.models import UserRole
    from my_project.models import User
    from my_project.extensions import db
    with app.app_context():
        user = User.query.first()
        if not user:
            user = User(username='roletest', email='role@test.com', role='staff')
            user.set_password('pass123')
            db.session.add(user)
            db.session.commit()
        ur = UserRole(user_id=user.id, role='director')
        db.session.add(ur)
        db.session.commit()
        assert ur.id is not None
        assert ur.role in UserRole.VALID_ROLES


def test_advisor_report_creation(app):
    from my_project.oversight.models import SocialAdvisorReport
    from my_project.registry.models import Structure, StructureType
    from my_project.models import User
    from my_project.extensions import db
    with app.app_context():
        user = User.query.first()
        st = StructureType.query.first() or StructureType(code='OT1', name='OT1')
        db.session.add(st)
        db.session.flush()
        s = Structure(code='OV-S1', name='Oversight Test', type_id=st.id)
        db.session.add(s)
        db.session.flush()
        report = SocialAdvisorReport(
            structure_id=s.id, author_id=user.id,
            drafted_date=date(2026, 2, 14), type='regular',
            assessment='Test assessment'
        )
        db.session.add(report)
        db.session.commit()
        assert report.id is not None
        assert report.status == 'draft'
