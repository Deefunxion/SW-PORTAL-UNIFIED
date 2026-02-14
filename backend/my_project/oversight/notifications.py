"""Notification helpers for the oversight subsystem.

Creates Notification records for key events (report lifecycle,
committee appointments, etc.).
"""
from ..extensions import db
from ..models import Notification, User


def _directors_and_admins():
    """Return user IDs for all directors and admin users."""
    from .models import UserRole
    # Admin system-role users
    admin_ids = {u.id for u in User.query.filter_by(role='admin').all()}
    # Director business-role users
    director_ids = {
        r.user_id for r in UserRole.query.filter_by(role='director').all()
    }
    return admin_ids | director_ids


def notify_report_submitted(report, report_kind='advisor'):
    """Notify directors/admins that a report was submitted for approval."""
    recipients = _directors_and_admins()
    # Exclude the author from being notified about their own submission
    recipients.discard(report.author_id if hasattr(report, 'author_id') else None)
    recipients.discard(report.submitted_by if hasattr(report, 'submitted_by') else None)

    if report_kind == 'advisor':
        title = 'Νέα έκθεση κοιν. συμβούλου προς έγκριση'
        url = f'/registry/{report.structure_id}'
    else:
        title = 'Νέα έκθεση ελέγχου υποβλήθηκε'
        url = f'/inspections/{report.inspection_id}/report'

    for uid in recipients:
        db.session.add(Notification(
            user_id=uid,
            title=title,
            content=f'Υποβλήθηκε έκθεση #{report.id} που απαιτεί έγκριση.',
            notification_type='report_submitted',
            action_url=url,
        ))
    # Caller is responsible for db.session.commit()


def notify_report_decision(report, action, report_kind='advisor'):
    """Notify the report author that their report was approved/returned."""
    author_id = getattr(report, 'author_id', None) or getattr(report, 'submitted_by', None)
    if not author_id:
        return

    if action == 'approve':
        title = 'Η έκθεσή σας εγκρίθηκε'
        ntype = 'report_approved'
    else:
        title = 'Η έκθεσή σας επιστράφηκε'
        ntype = 'report_returned'

    if report_kind == 'advisor':
        url = f'/registry/{report.structure_id}'
    else:
        url = f'/inspections/{report.inspection_id}/report'

    db.session.add(Notification(
        user_id=author_id,
        title=title,
        content=f'Έκθεση #{report.id}: {title.lower()}.',
        notification_type=ntype,
        action_url=url,
    ))


def notify_committee_appointment(membership):
    """Notify a user they've been added to an inspection committee."""
    from ..inspections.models import InspectionCommittee
    committee = InspectionCommittee.query.get(membership.committee_id)
    label = committee.decision_number if committee else f'#{membership.committee_id}'

    db.session.add(Notification(
        user_id=membership.user_id,
        title='Ορισμός σε Επιτροπή Ελέγχου',
        content=f'Προστεθήκατε στην Επιτροπή {label} ως {membership.role}.',
        notification_type='committee_appointment',
        action_url='/committees',
    ))
