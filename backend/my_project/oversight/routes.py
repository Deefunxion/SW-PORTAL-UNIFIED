from datetime import datetime, date
import os
from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from . import oversight_bp
from ..extensions import db
from .models import UserRole, SocialAdvisorReport


def _parse_date(value):
    """Parse a date string (YYYY-MM-DD) into a Python date object."""
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


# --- Advisor Reports ---

@oversight_bp.route('/api/structures/<int:structure_id>/advisor-reports', methods=['GET'])
@jwt_required()
def list_advisor_reports(structure_id):
    from ..registry.models import Structure
    Structure.query.get_or_404(structure_id)
    reports = SocialAdvisorReport.query.filter_by(
        structure_id=structure_id
    ).order_by(SocialAdvisorReport.created_at.desc()).all()
    return jsonify([r.to_dict() for r in reports]), 200


@oversight_bp.route('/api/structures/<int:structure_id>/advisor-reports', methods=['POST'])
@jwt_required()
def create_advisor_report(structure_id):
    user_id = int(get_jwt_identity())
    from ..registry.models import Structure
    Structure.query.get_or_404(structure_id)

    # Handle multipart form data
    drafted_date = request.form.get('drafted_date', date.today().isoformat())
    report_type = request.form.get('type', 'regular')
    assessment = request.form.get('assessment', '')
    recommendations = request.form.get('recommendations', '')

    file_path = None
    if 'file' in request.files:
        file = request.files['file']
        if file and file.filename:
            filename = secure_filename(file.filename)
            upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'advisor_reports')
            os.makedirs(upload_dir, exist_ok=True)
            full_path = os.path.join(upload_dir, f'{structure_id}_{filename}')
            file.save(full_path)
            file_path = f'advisor_reports/{structure_id}_{filename}'

    report = SocialAdvisorReport(
        structure_id=structure_id,
        author_id=user_id,
        drafted_date=_parse_date(drafted_date),
        type=report_type,
        assessment=assessment,
        recommendations=recommendations,
        file_path=file_path,
        status='draft',
    )
    db.session.add(report)
    db.session.commit()
    return jsonify(report.to_dict()), 201


@oversight_bp.route('/api/advisor-reports/<int:report_id>', methods=['GET'])
@jwt_required()
def get_advisor_report(report_id):
    report = SocialAdvisorReport.query.get_or_404(report_id)
    return jsonify(report.to_dict()), 200


@oversight_bp.route('/api/advisor-reports/<int:report_id>', methods=['PATCH'])
@jwt_required()
def update_advisor_report(report_id):
    user_id = int(get_jwt_identity())
    report = SocialAdvisorReport.query.get_or_404(report_id)
    # Only the author can edit their own draft
    if report.author_id != user_id:
        return jsonify({'error': 'Only the author can edit this report'}), 403
    if report.status != 'draft':
        return jsonify({'error': 'Only draft reports can be edited'}), 400

    data = request.get_json()
    for field in ['assessment', 'recommendations', 'type']:
        if field in data:
            setattr(report, field, data[field])
    if 'status' in data and data['status'] == 'submitted':
        report.status = 'submitted'
        from .notifications import notify_report_submitted
        notify_report_submitted(report, report_kind='advisor')
    if 'drafted_date' in data:
        report.drafted_date = _parse_date(data['drafted_date'])

    db.session.commit()
    return jsonify(report.to_dict()), 200


@oversight_bp.route('/api/advisor-reports/<int:report_id>/approve', methods=['PATCH'])
@jwt_required()
def approve_advisor_report(report_id):
    user_id = int(get_jwt_identity())
    from ..registry.permissions import is_director
    from ..models import User
    user = User.query.get(user_id)
    if not is_director(user_id) and (not user or user.role != 'admin'):
        return jsonify({'error': 'Director or admin only'}), 403

    report = SocialAdvisorReport.query.get_or_404(report_id)
    data = request.get_json()
    action = data.get('action')

    if action == 'approve':
        report.status = 'approved'
        report.approved_by = user_id
        report.approved_at = datetime.utcnow()
    elif action == 'return':
        report.status = 'returned'
    else:
        return jsonify({'error': 'Invalid action'}), 400

    from .notifications import notify_report_decision
    notify_report_decision(report, action, report_kind='advisor')

    db.session.commit()
    return jsonify(report.to_dict()), 200


# --- User Roles ---

@oversight_bp.route('/api/user-roles', methods=['GET'])
@jwt_required()
def list_user_roles():
    user_id = int(get_jwt_identity())
    from ..registry.permissions import is_director
    from ..models import User
    user = User.query.get(user_id)

    # Directors and admins see all roles; others see only their own
    if is_director(user_id) or (user and user.role == 'admin'):
        roles = UserRole.query.all()
    else:
        roles = UserRole.query.filter_by(user_id=user_id).all()

    return jsonify([r.to_dict() for r in roles]), 200


@oversight_bp.route('/api/user-roles', methods=['POST'])
@jwt_required()
def assign_user_role():
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    data = request.get_json()
    role_name = data.get('role')
    if role_name not in UserRole.VALID_ROLES:
        return jsonify({'error': f'Invalid role. Valid: {UserRole.VALID_ROLES}'}), 400

    user_role = UserRole(
        user_id=data['user_id'],
        role=role_name,
        structure_id=data.get('structure_id'),
        assigned_by=user_id,
    )
    db.session.add(user_role)
    db.session.commit()
    return jsonify(user_role.to_dict()), 201


@oversight_bp.route('/api/user-roles/<int:role_id>', methods=['DELETE'])
@jwt_required()
def remove_user_role(role_id):
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    user_role = UserRole.query.get_or_404(role_id)
    db.session.delete(user_role)
    db.session.commit()
    return jsonify({'message': 'Role removed'}), 200


# --- Dashboard & Alerts ---

@oversight_bp.route('/api/oversight/dashboard', methods=['GET'])
@jwt_required()
def oversight_dashboard():
    from ..registry.models import Structure, StructureType, License, Sanction
    from ..inspections.models import Inspection, InspectionReport
    from sqlalchemy import func, extract
    from datetime import timedelta

    total_structures = Structure.query.count()
    active_structures = Structure.query.filter_by(status='active').count()
    total_inspections = Inspection.query.count()
    completed_inspections = Inspection.query.filter_by(status='completed').count()
    pending_reports = SocialAdvisorReport.query.filter_by(status='draft').count()
    submitted_reports = SocialAdvisorReport.query.filter_by(status='submitted').count()
    total_sanctions = Sanction.query.count()

    # Sanction decision workflow stats
    from ..sanctions.models import SanctionDecision
    decision_stats = {
        'draft': SanctionDecision.query.filter_by(status='draft').count(),
        'submitted': SanctionDecision.query.filter_by(status='submitted').count(),
        'approved': SanctionDecision.query.filter_by(status='approved').count(),
        'notified': SanctionDecision.query.filter_by(status='notified').count(),
        'paid': SanctionDecision.query.filter_by(status='paid').count(),
        'overdue': SanctionDecision.query.filter(
            SanctionDecision.status == 'notified',
            SanctionDecision.payment_deadline < date.today()
        ).count(),
        'total_amount_pending': db.session.query(
            func.coalesce(func.sum(SanctionDecision.final_amount), 0)
        ).filter(SanctionDecision.status.in_(['approved', 'notified'])).scalar(),
        'total_amount_paid': db.session.query(
            func.coalesce(func.sum(SanctionDecision.paid_amount), 0)
        ).filter(SanctionDecision.status == 'paid').scalar(),
    }

    # Structures by type
    structures_by_type = []
    type_counts = (
        db.session.query(StructureType.name, func.count(Structure.id))
        .join(Structure, Structure.type_id == StructureType.id)
        .group_by(StructureType.name)
        .all()
    )
    for name, count in type_counts:
        structures_by_type.append({'name': name, 'count': count})

    # Inspections by month (last 12 months)
    inspections_by_month = []
    today = date.today()
    for i in range(11, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        count = Inspection.query.filter(
            extract('year', Inspection.scheduled_date) == y,
            extract('month', Inspection.scheduled_date) == m
        ).count()
        inspections_by_month.append({
            'month': f'{y}-{m:02d}',
            'count': count,
        })

    # Sanctions by status
    sanctions_by_status = []
    status_counts = (
        db.session.query(Sanction.status, func.count(Sanction.id))
        .group_by(Sanction.status)
        .all()
    )
    for status, count in status_counts:
        sanctions_by_status.append({'status': status, 'count': count})

    # Recent inspections (5)
    recent_inspections = Inspection.query.order_by(
        Inspection.scheduled_date.desc()
    ).limit(5).all()

    # Recent advisor reports (5)
    recent_reports = SocialAdvisorReport.query.order_by(
        SocialAdvisorReport.created_at.desc()
    ).limit(5).all()

    return jsonify({
        'stats': {
            'total_structures': total_structures,
            'active_structures': active_structures,
            'total_inspections': total_inspections,
            'completed_inspections': completed_inspections,
            'pending_reports': pending_reports,
            'submitted_reports': submitted_reports,
            'total_sanctions': total_sanctions,
        },
        'decision_stats': decision_stats,
        'structures_by_type': structures_by_type,
        'inspections_by_month': inspections_by_month,
        'sanctions_by_status': sanctions_by_status,
        'recent_inspections': [{
            **i.to_dict(),
            'structure_name': i.structure.name if i.structure else None,
            'report': i.report.to_dict() if i.report else None,
        } for i in recent_inspections],
        'recent_reports': [{
            **r.to_dict(),
            'structure_name': r.structure.name if r.structure else None,
            'author_name': r.author.username if r.author else None,
        } for r in recent_reports],
    }), 200


@oversight_bp.route('/api/oversight/alerts', methods=['GET'])
@jwt_required()
def oversight_alerts():
    from ..registry.models import Structure, License
    from ..inspections.models import InspectionReport
    from datetime import timedelta

    alerts = []

    # Expiring licenses (within 3 months)
    cutoff = date.today() + timedelta(days=90)
    expiring = License.query.filter(
        License.expiry_date <= cutoff,
        License.expiry_date >= date.today(),
        License.status == 'active'
    ).all()
    for lic in expiring:
        structure = Structure.query.get(lic.structure_id)
        alerts.append({
            'type': 'license_expiring',
            'severity': 'warning',
            'message': f'Η άδεια της δομής "{structure.name if structure else "?"}" λήγει στις {lic.expiry_date.isoformat()}',
            'structure_id': lic.structure_id,
            'date': lic.expiry_date.isoformat(),
        })

    # Expired licenses
    expired = License.query.filter(
        License.expiry_date < date.today(),
        License.status == 'active'
    ).all()
    for lic in expired:
        structure = Structure.query.get(lic.structure_id)
        alerts.append({
            'type': 'license_expired',
            'severity': 'critical',
            'message': f'Η άδεια της δομής "{structure.name if structure else "?"}" έχει λήξει ({lic.expiry_date.isoformat()})',
            'structure_id': lic.structure_id,
            'date': lic.expiry_date.isoformat(),
        })

    # Pending advisor reports (submitted but not approved)
    pending = SocialAdvisorReport.query.filter_by(status='submitted').all()
    for report in pending:
        alerts.append({
            'type': 'report_pending_approval',
            'severity': 'info',
            'message': f'Εκκρεμεί έγκριση έκθεσης κοιν. συμβούλου ({report.drafted_date.isoformat() if report.drafted_date else "?"})',
            'structure_id': report.structure_id,
            'report_id': report.id,
        })

    # Overdue sanction payments (notified + past payment deadline)
    from ..sanctions.models import SanctionDecision
    overdue_decisions = SanctionDecision.query.filter(
        SanctionDecision.status == 'notified',
        SanctionDecision.payment_deadline < date.today()
    ).all()
    for dec in overdue_decisions:
        sanction = dec.sanction
        structure = Structure.query.get(sanction.structure_id) if sanction else None
        alerts.append({
            'type': 'payment_overdue',
            'severity': 'critical',
            'message': f'Εκπρόθεσμη πληρωμή προστίμου {dec.final_amount:,.0f}€ — {structure.name if structure else "?"} (λήξη: {dec.payment_deadline.isoformat()})',
            'structure_id': sanction.structure_id if sanction else None,
            'decision_id': dec.id,
        })

    # Approaching payment deadlines (within 7 days)
    payment_soon = date.today() + timedelta(days=7)
    approaching_payment = SanctionDecision.query.filter(
        SanctionDecision.status == 'notified',
        SanctionDecision.payment_deadline >= date.today(),
        SanctionDecision.payment_deadline <= payment_soon,
    ).all()
    for dec in approaching_payment:
        sanction = dec.sanction
        structure = Structure.query.get(sanction.structure_id) if sanction else None
        alerts.append({
            'type': 'payment_approaching',
            'severity': 'warning',
            'message': f'Πληρωμή προστίμου {dec.final_amount:,.0f}€ λήγει {dec.payment_deadline.isoformat()} — {structure.name if structure else "?"}',
            'structure_id': sanction.structure_id if sanction else None,
            'decision_id': dec.id,
        })

    # Approaching appeal deadlines (within 3 days)
    appeal_soon = date.today() + timedelta(days=3)
    approaching_appeal = SanctionDecision.query.filter(
        SanctionDecision.status == 'notified',
        SanctionDecision.appeal_deadline >= date.today(),
        SanctionDecision.appeal_deadline <= appeal_soon,
    ).all()
    for dec in approaching_appeal:
        sanction = dec.sanction
        structure = Structure.query.get(sanction.structure_id) if sanction else None
        alerts.append({
            'type': 'appeal_deadline_approaching',
            'severity': 'warning',
            'message': f'Λήξη προθεσμίας ένστασης {dec.appeal_deadline.isoformat()} — {structure.name if structure else "?"}',
            'structure_id': sanction.structure_id if sanction else None,
            'decision_id': dec.id,
        })

    # Returned decisions requiring revision
    returned = SanctionDecision.query.filter_by(status='returned').all()
    for dec in returned:
        sanction = dec.sanction
        structure = Structure.query.get(sanction.structure_id) if sanction else None
        alerts.append({
            'type': 'decision_returned',
            'severity': 'info',
            'message': f'Απόφαση κύρωσης επιστράφηκε για διόρθωση — {structure.name if structure else "?"}',
            'structure_id': sanction.structure_id if sanction else None,
            'decision_id': dec.id,
        })

    return jsonify(alerts), 200


# --- Report Generation ---

@oversight_bp.route('/api/oversight/reports/<report_type>', methods=['GET'])
@jwt_required()
def generate_report(report_type):
    from flask import Response
    from .reports import REPORT_GENERATORS

    fmt = request.args.get('format', 'pdf')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    generators = REPORT_GENERATORS.get(report_type)
    if not generators:
        return jsonify({'error': f'Unknown report type: {report_type}'}), 400

    generator = generators.get(fmt)
    if not generator:
        return jsonify({'error': f'Unknown format: {fmt}'}), 400

    content = generator(date_from=date_from, date_to=date_to)

    if fmt == 'pdf':
        mimetype = 'application/pdf'
        ext = 'pdf'
    else:
        mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ext = 'xlsx'

    filename = f'{report_type}_{date.today().isoformat()}.{ext}'
    return Response(
        content,
        mimetype=mimetype,
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


# --- Ίριδα Export ---

@oversight_bp.route('/api/irida-export/<document_type>/<int:record_id>', methods=['GET'])
@jwt_required()
def irida_export(document_type, record_id):
    """Export a document as Ίριδα-compatible ZIP (metadata.json + PDF)."""
    from flask import send_file
    from ..integrations.irida_export import create_export_zip

    # Resolve the record based on document_type
    if document_type == 'advisor_report':
        record = SocialAdvisorReport.query.get_or_404(record_id)
    elif document_type == 'inspection_report':
        from ..inspections.models import InspectionReport
        record = InspectionReport.query.get_or_404(record_id)
    elif document_type == 'license':
        from ..registry.models import License
        record = License.query.get_or_404(record_id)
    elif document_type == 'sanction':
        from ..registry.models import Sanction
        record = Sanction.query.get_or_404(record_id)
    else:
        return jsonify({'error': f'Μη έγκυρος τύπος εγγράφου: {document_type}'}), 400

    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'content')
    zip_path = create_export_zip(document_type, record, upload_folder)

    return send_file(
        zip_path,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'irida_{document_type}_{record_id}.zip',
    )
