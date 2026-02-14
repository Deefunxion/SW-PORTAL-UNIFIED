from ..extensions import db


def is_committee_member(user_id, committee_id=None):
    """Check if user is member of any/specific committee."""
    from .models import CommitteeMembership
    query = CommitteeMembership.query.filter_by(user_id=user_id)
    if committee_id:
        query = query.filter_by(committee_id=committee_id)
    return query.first() is not None


def can_submit_report(user_id, inspection_id):
    """Check if user can submit a report for an inspection."""
    from .models import Inspection, CommitteeMembership
    inspection = Inspection.query.get(inspection_id)
    if not inspection:
        return False
    return is_committee_member(user_id, inspection.committee_id)
