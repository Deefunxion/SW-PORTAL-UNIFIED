from datetime import datetime, date
import os
from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from . import oversight_bp
from ..extensions import db
from .models import UserRole, SocialAdvisorReport
from ..integrations.irida_crypto import encrypt_credential, decrypt_credential


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
        status='approved',
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


# --- IRIDA Profile (per-user credentials) ---

def _mask_username(username):
    """Mask a username for display: 'user@gov.gr' -> 'us******@gov.gr'."""
    if not username or '@' not in username:
        return username[:2] + '****' if username and len(username) > 2 else '****'
    local, domain = username.rsplit('@', 1)
    visible = min(2, len(local))
    return local[:visible] + '******' + '@' + domain


@oversight_bp.route('/api/profile/irida', methods=['GET'])
@jwt_required()
def get_irida_profile():
    """Get current user's IRIDA connection status (never exposes password)."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)

    if user.irida_username and user.irida_password:
        try:
            plain_username = decrypt_credential(user.irida_username)
        except Exception:
            plain_username = '(encrypted)'
        return jsonify({
            'configured': True,
            'username': _mask_username(plain_username),
            'x_profile': user.irida_x_profile,
            'base_url': user.irida_base_url,
        }), 200

    return jsonify({'configured': False}), 200


@oversight_bp.route('/api/profile/irida', methods=['POST'])
@jwt_required()
def save_irida_credentials():
    """Save encrypted IRIDA credentials for the current user."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)
    data = request.get_json()

    username = data.get('username')
    password = data.get('password')
    if not username or not password:
        return jsonify({'error': 'Username και password απαιτούνται'}), 400

    user.irida_username = encrypt_credential(username)
    user.irida_password = encrypt_credential(password)
    user.irida_x_profile = data.get('x_profile') or user.irida_x_profile
    user.irida_base_url = data.get('base_url') or user.irida_base_url

    db.session.commit()
    return jsonify({
        'configured': True,
        'username': _mask_username(username),
    }), 200


@oversight_bp.route('/api/profile/irida/test', methods=['POST'])
@jwt_required()
def test_irida_connection():
    """Test IRIDA connection with user's credentials. Returns profiles on success."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)
    data = request.get_json() or {}

    # Use provided credentials or stored ones
    username = data.get('username')
    password = data.get('password')

    if not username and user.irida_username:
        try:
            username = decrypt_credential(user.irida_username)
            password = decrypt_credential(user.irida_password)
        except Exception:
            return jsonify({'error': 'Δεν ήταν δυνατή η αποκρυπτογράφηση'}), 500

    if not username or not password:
        return jsonify({'error': 'Δεν υπάρχουν στοιχεία σύνδεσης'}), 400

    from ..integrations.irida_client import authenticate_user, get_mode
    mode = get_mode()
    base_url = user.irida_base_url or mode.get('base_url')

    try:
        token = authenticate_user(username, password, base_url=base_url)
        # Fetch profiles with the user's token
        import httpx
        from ..integrations.irida_client import _api_prefix
        prefix = _api_prefix()
        resp = httpx.get(
            f'{base_url}/api/v2/{prefix}/profiles',
            headers={
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json',
            },
            timeout=30,
        )
        resp.raise_for_status()
        profiles = resp.json()

        # Auto-set x_profile if not already set
        if profiles and not user.irida_x_profile:
            user.irida_x_profile = profiles[0].get('xProfile')
            db.session.commit()

        return jsonify({
            'success': True,
            'profiles': profiles,
        }), 200

    except RuntimeError as e:
        return jsonify({'error': str(e)}), 401
    except Exception as e:
        return jsonify({'error': f'Σφάλμα σύνδεσης: {str(e)}'}), 502


@oversight_bp.route('/api/profile/irida', methods=['DELETE'])
@jwt_required()
def delete_irida_credentials():
    """Remove stored IRIDA credentials for the current user."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)

    user.irida_username = None
    user.irida_password = None
    user.irida_x_profile = None
    user.irida_base_url = None
    db.session.commit()

    return jsonify({'configured': False}), 200


# --- Send Advisor Report to ΙΡΙΔΑ ---

@oversight_bp.route('/api/advisor-reports/<int:report_id>/send-to-irida', methods=['POST'])
@jwt_required()
def send_advisor_report_to_irida(report_id):
    """Send an approved advisor report to ΙΡΙΔΑ as Υπηρεσιακό Σημείωμα."""
    import json as _json
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get_or_404(user_id)

    report = SocialAdvisorReport.query.get_or_404(report_id)

    # Validate report status
    if report.status not in ('submitted', 'approved'):
        return jsonify({'error': 'Μόνο εγκεκριμένες αναφορές μπορούν να '
                        'σταλούν στο ΙΡΙΔΑ'}), 400

    # Validate request body
    data = request.get_json() or {}
    recipients = data.get('recipients', [])
    if not recipients:
        return jsonify({'error': 'Απαιτούνται αποδέκτες (recipients)'}), 400

    # Check IRIDA credentials
    if not user.irida_username or not user.irida_password:
        return jsonify({
            'error': 'Δεν έχετε ρυθμίσει σύνδεση ΙΡΙΔΑ. '
                     'Μεταβείτε στο Προφίλ → Σύνδεση ΙΡΙΔΑ.'
        }), 400

    from ..integrations.irida_crypto import decrypt_credential
    from ..integrations.irida_client import (
        authenticate_user, send_document_as_user, get_mode
    )
    from ..integrations.models import IridaTransaction

    try:
        username = decrypt_credential(user.irida_username)
        password = decrypt_credential(user.irida_password)
    except Exception:
        return jsonify({'error': 'Σφάλμα αποκρυπτογράφησης. '
                        'Αποθηκεύστε ξανά τα στοιχεία ΙΡΙΔΑ.'}), 500

    mode = get_mode()
    base_url = user.irida_base_url or mode.get('base_url')
    x_profile = user.irida_x_profile or ''

    # Build subject from report + structure
    structure = report.structure
    subject_override = data.get('subject')
    subject = subject_override or (
        f'Αναφορά Κοιν. Συμβούλου — {structure.name}'
        if structure else f'Αναφορά Κοιν. Συμβούλου #{report.id}'
    )

    # Generate PDF from the report
    from .pdf_reports import generate_advisor_report_pdf
    try:
        pdf_bytes = generate_advisor_report_pdf(report)
    except Exception:
        # Fallback: send a simple text file if PDF generation fails
        pdf_bytes = f'Αναφορά #{report.id}\n{report.assessment}'.encode('utf-8')

    filename = f'advisor_report_{report.id}.pdf'

    # Create pending transaction
    tx = IridaTransaction(
        direction='outbound',
        status='pending',
        source_type='advisor_report',
        source_id=report.id,
        subject=subject,
        sender=user.username,
        recipients_json=_json.dumps(recipients),
        sent_by_id=user_id,
    )
    db.session.add(tx)
    db.session.flush()

    try:
        token = authenticate_user(username, password, base_url=base_url)

        # Auto-fetch x_profile if missing
        if not x_profile:
            import httpx as _httpx
            from ..integrations.irida_client import _api_prefix
            prefix = _api_prefix()
            prof_resp = _httpx.get(
                f'{base_url}/api/v2/{prefix}/profiles',
                headers={
                    'Authorization': f'Bearer {token}',
                    'Accept': 'application/json',
                },
                timeout=30,
            )
            if prof_resp.status_code == 200:
                profiles = prof_resp.json()
                if profiles:
                    x_profile = profiles[0].get('xProfile', '')
                    user.irida_x_profile = x_profile

        result = send_document_as_user(
            token=token,
            x_profile=x_profile,
            base_url=base_url,
            subject=subject,
            registration_number='ΑΝΕΥ',
            sender=user.username,
            recipients=recipients,
            files=[(filename, pdf_bytes, 'application/pdf')],
            demo=mode.get('demo', False),
        )

        # Extract protocol number from response
        irida_data = result.get('data', result) if isinstance(result, dict) else result
        if isinstance(irida_data, list) and irida_data:
            tx.irida_reg_no = irida_data[0].get('regNo')
            tx.irida_document_id = str(irida_data[0].get('rootId', ''))

        tx.status = 'sent'
        db.session.commit()

        return jsonify({
            'transaction': tx.to_dict(),
            'message': f'Η αναφορά στάλθηκε στο ΙΡΙΔΑ'
                       f'{" — Αρ.Πρωτ: " + tx.irida_reg_no if tx.irida_reg_no else ""}',
        }), 200

    except RuntimeError as e:
        tx.status = 'failed'
        tx.error_message = str(e)
        db.session.commit()
        return jsonify({'error': str(e), 'transaction': tx.to_dict()}), 502

    except Exception as e:
        tx.status = 'failed'
        tx.error_message = str(e)
        db.session.commit()
        return jsonify({'error': f'Σφάλμα ΙΡΙΔΑ: {str(e)}',
                        'transaction': tx.to_dict()}), 502


# --- IRIDA Transactions ---

@oversight_bp.route('/api/irida/transactions', methods=['GET'])
@jwt_required()
def list_irida_transactions():
    """List IRIDA transactions, optionally filtered by source."""
    from ..integrations.models import IridaTransaction
    q = IridaTransaction.query
    source_type = request.args.get('source_type')
    source_id = request.args.get('source_id', type=int)
    if source_type:
        q = q.filter_by(source_type=source_type)
    if source_id:
        q = q.filter_by(source_id=source_id)
    txs = q.order_by(IridaTransaction.created_at.desc()).all()
    return jsonify([tx.to_dict() for tx in txs]), 200


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


@oversight_bp.route('/api/oversight/daily-agenda', methods=['GET'])
@jwt_required()
def daily_agenda():
    from datetime import timedelta
    from sqlalchemy.orm import joinedload
    from ..registry.models import Structure, License
    from ..inspections.models import Inspection
    from ..sanctions.models import SanctionDecision

    today = date.today()
    agenda = []

    # 1. Inspections scheduled today or this week — eager-load structure
    upcoming_inspections = Inspection.query.options(
        joinedload(Inspection.structure)
    ).filter(
        Inspection.scheduled_date >= today,
        Inspection.scheduled_date <= today + timedelta(days=7),
        Inspection.status.in_(['scheduled', 'pending'])
    ).order_by(Inspection.scheduled_date).all()

    for insp in upcoming_inspections:
        structure = insp.structure
        agenda.append({
            'type': 'inspection',
            'priority': 'high' if insp.scheduled_date == today else 'medium',
            'title': f'Έλεγχος: {structure.name if structure else "N/A"}',
            'subtitle': f'{insp.type} - {insp.scheduled_date.strftime("%d/%m/%Y")}',
            'date': insp.scheduled_date.isoformat(),
            'link': f'/inspections/{insp.id}/report',
            'structure_id': insp.structure_id
        })

    # 2. Licenses expiring within 30 days — eager-load structure
    expiring_licenses = License.query.options(
        joinedload(License.structure)
    ).filter(
        License.expiry_date >= today,
        License.expiry_date <= today + timedelta(days=30),
        License.status == 'active'
    ).order_by(License.expiry_date).all()

    for lic in expiring_licenses:
        structure = lic.structure
        days_left = (lic.expiry_date - today).days
        agenda.append({
            'type': 'license_expiring',
            'priority': 'high' if days_left <= 7 else 'medium',
            'title': f'Λήξη Άδειας: {structure.name if structure else "N/A"}',
            'subtitle': f'{lic.type} - σε {days_left} ημέρες ({lic.expiry_date.strftime("%d/%m/%Y")})',
            'date': lic.expiry_date.isoformat(),
            'link': f'/registry/{lic.structure_id}',
            'structure_id': lic.structure_id
        })

    # 3. Pending decision approvals
    pending_decisions = SanctionDecision.query.filter(
        SanctionDecision.status == 'submitted'
    ).order_by(SanctionDecision.created_at).all()

    for dec in pending_decisions:
        agenda.append({
            'type': 'pending_approval',
            'priority': 'high',
            'title': f'Εκκρεμεί Έγκριση: {dec.obligor_name or "N/A"}',
            'subtitle': f'Ποσό: {dec.final_amount}€',
            'date': dec.created_at.isoformat() if dec.created_at else today.isoformat(),
            'link': f'/sanctions/decisions/{dec.id}',
            'structure_id': dec.structure_id
        })

    # 4. Overdue payments
    overdue = SanctionDecision.query.filter(
        SanctionDecision.status == 'notified',
        SanctionDecision.payment_deadline < today
    ).all()

    for dec in overdue:
        agenda.append({
            'type': 'overdue_payment',
            'priority': 'critical',
            'title': f'Εκπρόθεσμη Πληρωμή: {dec.obligor_name or "N/A"}',
            'subtitle': f'Ποσό: {dec.final_amount}€ - Προθεσμία: {dec.payment_deadline.strftime("%d/%m/%Y")}',
            'date': dec.payment_deadline.isoformat(),
            'link': f'/sanctions/decisions/{dec.id}',
            'structure_id': dec.structure_id
        })

    # Sort by priority then date
    priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    agenda.sort(key=lambda x: (priority_order.get(x['priority'], 9), x['date']))

    return jsonify({
        'date': today.isoformat(),
        'items': agenda,
        'summary': {
            'total': len(agenda),
            'critical': sum(1 for a in agenda if a['priority'] == 'critical'),
            'high': sum(1 for a in agenda if a['priority'] == 'high'),
        }
    })


@oversight_bp.route('/api/oversight/alerts', methods=['GET'])
@jwt_required()
def oversight_alerts():
    from ..registry.models import Structure, License, Sanction as SanctionModel
    from ..inspections.models import InspectionReport
    from datetime import timedelta

    from sqlalchemy.orm import joinedload
    from ..sanctions.models import SanctionDecision
    alerts = []

    # Expiring licenses (within 3 months) — eager-load structure
    cutoff = date.today() + timedelta(days=90)
    expiring = License.query.options(joinedload(License.structure)).filter(
        License.expiry_date <= cutoff,
        License.expiry_date >= date.today(),
        License.status == 'active'
    ).all()
    for lic in expiring:
        structure = lic.structure
        alerts.append({
            'type': 'license_expiring',
            'severity': 'warning',
            'message': f'Η άδεια της δομής "{structure.name if structure else "?"}" λήγει στις {lic.expiry_date.isoformat()}',
            'structure_id': lic.structure_id,
            'date': lic.expiry_date.isoformat(),
        })

    # Expired licenses — eager-load structure
    expired = License.query.options(joinedload(License.structure)).filter(
        License.expiry_date < date.today(),
        License.status == 'active'
    ).all()
    for lic in expired:
        structure = lic.structure
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

    # Batch-load all decisions with sanction→structure in one query
    all_decisions = SanctionDecision.query.options(
        joinedload(SanctionDecision.sanction).joinedload(SanctionModel.structure)
    ).all()

    # Overdue sanction payments (notified + past payment deadline)
    for dec in all_decisions:
        if dec.status != 'notified' or not dec.payment_deadline or dec.payment_deadline >= date.today():
            continue
        sanction = dec.sanction
        structure = sanction.structure if sanction else None
        alerts.append({
            'type': 'payment_overdue',
            'severity': 'critical',
            'message': f'Εκπρόθεσμη πληρωμή προστίμου {dec.final_amount:,.0f}€ — {structure.name if structure else "?"} (λήξη: {dec.payment_deadline.isoformat()})',
            'structure_id': sanction.structure_id if sanction else None,
            'decision_id': dec.id,
        })

    # Approaching payment deadlines (within 7 days)
    payment_soon = date.today() + timedelta(days=7)
    for dec in all_decisions:
        if dec.status != 'notified' or not dec.payment_deadline:
            continue
        if dec.payment_deadline < date.today() or dec.payment_deadline > payment_soon:
            continue
        sanction = dec.sanction
        structure = sanction.structure if sanction else None
        alerts.append({
            'type': 'payment_approaching',
            'severity': 'warning',
            'message': f'Πληρωμή προστίμου {dec.final_amount:,.0f}€ λήγει {dec.payment_deadline.isoformat()} — {structure.name if structure else "?"}',
            'structure_id': sanction.structure_id if sanction else None,
            'decision_id': dec.id,
        })

    # Approaching appeal deadlines (within 3 days)
    appeal_soon = date.today() + timedelta(days=3)
    for dec in all_decisions:
        if dec.status != 'notified' or not dec.appeal_deadline:
            continue
        if dec.appeal_deadline < date.today() or dec.appeal_deadline > appeal_soon:
            continue
        sanction = dec.sanction
        structure = sanction.structure if sanction else None
        alerts.append({
            'type': 'appeal_deadline_approaching',
            'severity': 'warning',
            'message': f'Λήξη προθεσμίας ένστασης {dec.appeal_deadline.isoformat()} — {structure.name if structure else "?"}',
            'structure_id': sanction.structure_id if sanction else None,
            'decision_id': dec.id,
        })

    # Returned decisions requiring revision
    for dec in all_decisions:
        if dec.status != 'returned':
            continue
        sanction = dec.sanction
        structure = sanction.structure if sanction else None
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
