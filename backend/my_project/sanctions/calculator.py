from ..extensions import db
from ..registry.models import Sanction, Structure
from .models import SanctionRule


def calculate_fine(violation_code, structure_id, custom_amount=None):
    """Calculate fine based on violation rules and recidivism history.

    Args:
        violation_code: The violation code to look up.
        structure_id: The structure being sanctioned.
        custom_amount: Optional override amount (must be within min/max range).

    Returns dict with calculation details including ranges and revenue split.
    """
    rule = SanctionRule.query.filter_by(
        violation_code=violation_code, is_active=True
    ).first()
    if not rule:
        raise ValueError(f'No active rule for violation code: {violation_code}')

    # Check structure type compatibility
    if rule.structure_type_id:
        structure = db.session.get(Structure, structure_id)
        if structure and structure.type_id != rule.structure_type_id:
            raise ValueError('Rule not applicable to this structure type')

    # Count prior sanctions for recidivism (using violation_code field or notes)
    prior_count = Sanction.query.filter(
        Sanction.structure_id == structure_id,
        Sanction.status.notin_(['cancelled']),
        db.or_(
            Sanction.violation_code == violation_code,
            Sanction.notes.contains(f'violation_code:{violation_code}'),
        ),
    ).count()

    # Determine multiplier based on recidivism
    if prior_count == 0:
        multiplier = 1.0
    elif prior_count == 1:
        multiplier = rule.escalation_2nd or 2.0
    else:
        multiplier = rule.escalation_3rd_plus or 3.0

    base = custom_amount if custom_amount else rule.base_fine
    final_amount = base * multiplier

    # Effective range with multiplier applied
    effective_min = (rule.min_fine or rule.base_fine) * multiplier
    effective_max = (rule.max_fine or rule.base_fine) * multiplier

    # Validate custom_amount is within range
    if custom_amount is not None:
        raw_min = rule.min_fine or rule.base_fine
        raw_max = rule.max_fine or rule.base_fine
        if custom_amount < raw_min or custom_amount > raw_max:
            raise ValueError(
                f'Amount {custom_amount} outside range [{raw_min}, {raw_max}]'
            )

    # Revenue split
    state_pct = (rule.revenue_split_state_pct or 50) / 100.0
    region_pct = (rule.revenue_split_region_pct or 50) / 100.0

    return {
        'violation_code': violation_code,
        'violation_name': rule.violation_name,
        'category': rule.category,
        'base_fine': rule.base_fine,
        'min_fine': rule.min_fine,
        'max_fine': rule.max_fine,
        'custom_amount': custom_amount,
        'multiplier': multiplier,
        'final_amount': final_amount,
        'effective_min': effective_min,
        'effective_max': effective_max,
        'legal_basis': rule.legal_reference,
        'recidivism_count': prior_count,
        'can_trigger_suspension': (
            rule.can_trigger_suspension and
            prior_count + 1 >= (rule.suspension_threshold or 999)
        ),
        'payment_deadline_days': rule.payment_deadline_days or 60,
        'appeal_deadline_days': rule.appeal_deadline_days or 15,
        'revenue_split': {
            'state_pct': rule.revenue_split_state_pct or 50,
            'state_ale': rule.revenue_split_state_ale or '1560989001',
            'state_amount': round(final_amount * state_pct, 2),
            'region_pct': rule.revenue_split_region_pct or 50,
            'region_kae': rule.revenue_split_region_kae or '64008',
            'region_amount': round(final_amount * region_pct, 2),
        },
    }
