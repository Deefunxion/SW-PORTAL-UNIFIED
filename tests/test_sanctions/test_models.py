def test_sanction_rule_to_dict(client, app):
    from my_project.sanctions.models import SanctionRule
    from my_project.extensions import db
    with app.app_context():
        rule = SanctionRule.query.filter_by(violation_code='NO_LICENSE').first()
        if not rule:
            rule = SanctionRule(
                violation_code='NO_LICENSE',
                violation_name='\u039b\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03af\u03b1 \u03c7\u03c9\u03c1\u03af\u03c2 \u03ac\u03b4\u03b5\u03b9\u03b1',
                base_fine=10000.0,
                legal_reference='\u039d.4756/2020, \u0386\u03c1\u03b8\u03c1\u03bf 42'
            )
            db.session.add(rule)
            db.session.commit()
        d = rule.to_dict()
        assert d['violation_code'] == 'NO_LICENSE'
        assert d['base_fine'] == 10000.0
        assert d['escalation_2nd'] == 2.0
        assert d['escalation_3rd_plus'] == 3.0
        assert d['is_active'] is True
