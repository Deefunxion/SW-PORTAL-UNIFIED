def test_calculate_fine_first_offense(client, app):
    """First offense should use base fine (multiplier 1)."""
    from my_project.sanctions.calculator import calculate_fine
    from my_project.sanctions.models import SanctionRule
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db

    with app.app_context():
        # Ensure a structure type and structure exist
        stype = StructureType.query.filter_by(code='MFH').first()
        if not stype:
            stype = StructureType(code='MFH', name='Test MFH')
            db.session.add(stype)
            db.session.commit()

        structure = Structure.query.first()
        if not structure:
            structure = Structure(code='TEST-001', name='Test Structure', type_id=stype.id)
            db.session.add(structure)
            db.session.commit()

        rule = SanctionRule.query.filter_by(violation_code='NO_LICENSE').first()
        if not rule:
            rule = SanctionRule(violation_code='NO_LICENSE', violation_name='Test',
                                base_fine=10000.0, escalation_2nd=2.0, escalation_3rd_plus=3.0)
            db.session.add(rule)
            db.session.commit()

        result = calculate_fine(rule.violation_code, structure.id)
        assert result['base_fine'] == 10000.0
        assert result['recidivism_count'] == 0
        assert result['multiplier'] == 1.0
        assert result['final_amount'] == 10000.0


def test_calculate_fine_with_recidivism(client, app):
    """Second offense of same type should use escalation_2nd multiplier."""
    from my_project.sanctions.calculator import calculate_fine
    from my_project.sanctions.models import SanctionRule
    from my_project.registry.models import Structure, Sanction
    from my_project.extensions import db

    with app.app_context():
        rule = SanctionRule.query.filter_by(violation_code='NO_LICENSE').first()
        structure = Structure.query.first()

        # Create a prior sanction for the same violation
        prior = Sanction(structure_id=structure.id, type='fine',
                         amount=10000, status='imposed',
                         notes='violation_code:NO_LICENSE')
        db.session.add(prior)
        db.session.commit()

        result = calculate_fine(rule.violation_code, structure.id)
        assert result['recidivism_count'] >= 1
        assert result['multiplier'] == 2.0
        assert result['final_amount'] == 20000.0


def test_calculate_fine_unknown_code(client, app):
    """Unknown violation code should raise ValueError."""
    import pytest
    from my_project.sanctions.calculator import calculate_fine
    from my_project.registry.models import Structure

    with app.app_context():
        structure = Structure.query.first()
        with pytest.raises(ValueError, match='No active rule'):
            calculate_fine('NONEXISTENT_CODE', structure.id)
