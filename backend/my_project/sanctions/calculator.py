from ..registry.models import Sanction
from .models import SanctionRule


def calculate_fine(violation_code, structure_id):
    """Calculate fine based on violation rules and recidivism history.

    Returns dict with: base_fine, multiplier, final_amount, legal_basis,
    recidivism_count, can_trigger_suspension.
    """
    rule = SanctionRule.query.filter_by(
        violation_code=violation_code, is_active=True
    ).first()
    if not rule:
        raise ValueError(f'No active rule for violation code: {violation_code}')

    # Count prior sanctions of the same violation type for this structure
    prior_count = Sanction.query.filter(
        Sanction.structure_id == structure_id,
        Sanction.notes.contains(f'violation_code:{violation_code}'),
        Sanction.status.notin_(['cancelled']),
    ).count()

    # Determine multiplier based on recidivism
    if prior_count == 0:
        multiplier = 1.0
    elif prior_count == 1:
        multiplier = rule.escalation_2nd
    else:
        multiplier = rule.escalation_3rd_plus

    final_amount = rule.base_fine * multiplier

    return {
        'violation_code': violation_code,
        'violation_name': rule.violation_name,
        'base_fine': rule.base_fine,
        'multiplier': multiplier,
        'final_amount': final_amount,
        'legal_basis': rule.legal_reference,
        'recidivism_count': prior_count,
        'can_trigger_suspension': (
            rule.can_trigger_suspension and
            prior_count + 1 >= rule.suspension_threshold
        ),
    }
