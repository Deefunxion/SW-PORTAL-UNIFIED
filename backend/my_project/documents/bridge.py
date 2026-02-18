"""Bridge functions to create DecisionRecords from other modules."""
from ..extensions import db
from .models import DecisionTemplate, DecisionRecord


def create_decision_from_sanction(sanction_decision):
    """
    Create a DecisionRecord from an approved SanctionDecision.

    Args:
        sanction_decision: SanctionDecision model instance

    Returns:
        DecisionRecord instance (already added to session, not committed)
    """
    # Find the matching template
    sd = sanction_decision
    template_type = 'sanction_fine'
    if sd.final_amount is None or sd.final_amount == 0:
        template_type = 'sanction_suspension'

    template = (DecisionTemplate.query
                .filter_by(type=template_type, is_active=True)
                .first())
    if not template:
        # Fallback: use any sanction template
        template = (DecisionTemplate.query
                    .filter(DecisionTemplate.type.like('sanction%'),
                            DecisionTemplate.is_active == True)
                    .first())
    if not template:
        return None

    # Build rendered body from sanction data
    from .generator import resolve_placeholders
    from ..registry.models import Structure
    structure = (Structure.query.get(sd.sanction.structure_id)
                 if sd.sanction else None)

    user_data = {
        'source_sanction_decision_id': sd.id,
        'obligor_name': sd.obligor_name or '',
        'obligor_afm': sd.obligor_afm or '',
        'final_amount': str(sd.final_amount or ''),
        'protocol_number': sd.protocol_number or '',
    }
    rendered = resolve_placeholders(template.body_template, structure, user_data)

    # Generate internal number
    from .routes import _next_internal_number
    record = DecisionRecord(
        template_id=template.id,
        structure_id=sd.sanction.structure_id if sd.sanction else None,
        data=user_data,
        rendered_body=rendered,
        status='draft',
        created_by=sd.approved_by or sd.drafted_by,
        internal_number=_next_internal_number(),
        source_type='sanction_decision',
        source_id=sd.id,
    )
    db.session.add(record)
    return record
