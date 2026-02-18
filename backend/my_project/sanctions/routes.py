from datetime import datetime, date, timedelta
from flask import jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import sanctions_bp
from ..extensions import db
from .models import SanctionRule, SanctionDecision
from .calculator import calculate_fine
from ..registry.models import Sanction, Structure


@sanctions_bp.route('/api/sanction-rules', methods=['GET'])
@jwt_required()
def list_sanction_rules():
    q = SanctionRule.query.filter_by(is_active=True)
    structure_type_id = request.args.get('structure_type_id', type=int)
    if structure_type_id:
        q = q.filter(
            db.or_(
                SanctionRule.structure_type_id == structure_type_id,
                SanctionRule.structure_type_id.is_(None),
            )
        )
    category = request.args.get('category')
    if category:
        q = q.filter_by(category=category)
    rules = q.order_by(SanctionRule.category, SanctionRule.violation_name).all()
    return jsonify([r.to_dict() for r in rules]), 200


@sanctions_bp.route('/api/sanction-rules', methods=['POST'])
@jwt_required()
def create_sanction_rule():
    user_id = int(get_jwt_identity())
    from ..models import User
    user = db.session.get(User, user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    data = request.get_json()
    rule = SanctionRule(
        violation_code=data['violation_code'],
        violation_name=data['violation_name'],
        description=data.get('description'),
        base_fine=data['base_fine'],
        min_fine=data.get('min_fine'),
        max_fine=data.get('max_fine'),
        category=data.get('category', 'general'),
        escalation_2nd=data.get('escalation_2nd', 2.0),
        escalation_3rd_plus=data.get('escalation_3rd_plus', 3.0),
        can_trigger_suspension=data.get('can_trigger_suspension', False),
        suspension_threshold=data.get('suspension_threshold', 3),
        legal_reference=data.get('legal_reference'),
        structure_type_id=data.get('structure_type_id'),
        payment_deadline_days=data.get('payment_deadline_days', 60),
        appeal_deadline_days=data.get('appeal_deadline_days', 15),
        revenue_split_state_pct=data.get('revenue_split_state_pct', 50),
        revenue_split_state_ale=data.get('revenue_split_state_ale', '1560989001'),
        revenue_split_region_pct=data.get('revenue_split_region_pct', 50),
        revenue_split_region_kae=data.get('revenue_split_region_kae', '64008'),
    )
    db.session.add(rule)
    db.session.commit()
    return jsonify(rule.to_dict()), 201


@sanctions_bp.route('/api/sanctions/calculate', methods=['POST'])
@jwt_required()
def calculate_fine_endpoint():
    """Preview fine calculation without creating a sanction."""
    data = request.get_json()
    violation_code = data.get('violation_code')
    structure_id = data.get('structure_id')
    custom_amount = data.get('custom_amount')

    if not violation_code or not structure_id:
        return jsonify({'error': 'violation_code and structure_id required'}), 400

    # Convert custom_amount to float if provided
    if custom_amount is not None:
        try:
            custom_amount = float(custom_amount)
        except (TypeError, ValueError):
            return jsonify({'error': 'custom_amount must be a number'}), 400

    try:
        result = calculate_fine(violation_code, structure_id, custom_amount)
        return jsonify(result), 200
    except ValueError as e:
        err_msg = str(e)
        if 'No active rule' in err_msg:
            return jsonify({'error': err_msg}), 404
        return jsonify({'error': err_msg}), 400


# ── Sanction Decisions ──────────────────────────────────────────────


@sanctions_bp.route('/api/sanction-decisions', methods=['POST'])
@jwt_required()
def create_decision():
    """Create a draft sanction decision with its underlying Sanction."""
    user_id = int(get_jwt_identity())
    data = request.get_json()

    structure_id = data.get('structure_id')
    violation_code = data.get('violation_code')
    calculated_amount = data.get('calculated_amount')
    final_amount = data.get('final_amount', calculated_amount)

    if not all([structure_id, violation_code, calculated_amount]):
        return jsonify({'error': 'structure_id, violation_code, calculated_amount required'}), 400

    structure = db.session.get(Structure, structure_id)
    if not structure:
        return jsonify({'error': 'Structure not found'}), 404

    # Create underlying Sanction record
    sanction = Sanction(
        structure_id=structure_id,
        inspection_id=data.get('inspection_id'),
        type='fine',
        amount=final_amount,
        imposed_date=date.today(),
        status='imposed',
        violation_code=violation_code,
        calculated_amount=calculated_amount,
        final_amount=final_amount,
        inspection_finding=data.get('inspection_finding'),
        notes=f'violation_code:{violation_code}',
    )
    db.session.add(sanction)
    db.session.flush()  # get sanction.id

    # Revenue split from rule
    rule = SanctionRule.query.filter_by(
        violation_code=violation_code, is_active=True
    ).first()
    state_pct = ((rule.revenue_split_state_pct or 50) / 100.0) if rule else 0.5
    region_pct = ((rule.revenue_split_region_pct or 50) / 100.0) if rule else 0.5

    decision = SanctionDecision(
        sanction_id=sanction.id,
        status='draft',
        drafted_by=user_id,
        violation_code=violation_code,
        inspection_finding=data.get('inspection_finding'),
        calculated_amount=calculated_amount,
        final_amount=final_amount,
        justification=data.get('justification', ''),
        amount_state=round(final_amount * state_pct, 2),
        amount_region=round(final_amount * region_pct, 2),
        obligor_name=data.get('obligor_name', ''),
        obligor_father_name=data.get('obligor_father_name', ''),
        obligor_afm=data.get('obligor_afm', ''),
        obligor_doy=data.get('obligor_doy', ''),
        obligor_address=data.get('obligor_address', ''),
    )
    db.session.add(decision)
    db.session.commit()
    return jsonify(decision.to_dict()), 201


@sanctions_bp.route('/api/sanction-decisions', methods=['GET'])
@jwt_required()
def list_decisions():
    """List sanction decisions with optional filters."""
    q = SanctionDecision.query
    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)
    structure_id = request.args.get('structure_id', type=int)
    if structure_id:
        q = q.join(Sanction).filter(Sanction.structure_id == structure_id)
    decisions = q.order_by(SanctionDecision.created_at.desc()).all()

    result = []
    for d in decisions:
        data = d.to_dict()
        data['structure_id'] = d.sanction.structure_id if d.sanction else None
        data['structure_name'] = (
            d.sanction.structure.name
            if d.sanction and hasattr(d.sanction, 'structure') and d.sanction.structure
            else None
        )
        result.append(data)
    return jsonify(result), 200


@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>', methods=['GET'])
@jwt_required()
def get_decision(decision_id):
    """Get a single sanction decision with structure info."""
    decision = db.session.get(SanctionDecision, decision_id)
    if not decision:
        return jsonify({'error': 'Decision not found'}), 404
    data = decision.to_dict()
    if decision.sanction:
        data['structure_id'] = decision.sanction.structure_id
        structure = db.session.get(Structure, decision.sanction.structure_id)
        data['structure_name'] = structure.name if structure else None
        data['sanction'] = decision.sanction.to_dict()
    return jsonify(data), 200


@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>', methods=['PATCH'])
@jwt_required()
def update_decision(decision_id):
    """Update a draft decision (only editable in draft/returned status)."""
    decision = db.session.get(SanctionDecision, decision_id)
    if not decision:
        return jsonify({'error': 'Decision not found'}), 404
    if decision.status not in ('draft', 'returned'):
        return jsonify({'error': 'Only draft/returned decisions can be edited'}), 400

    data = request.get_json()
    editable = [
        'justification', 'final_amount', 'inspection_finding',
        'obligor_name', 'obligor_father_name', 'obligor_afm',
        'obligor_doy', 'obligor_address',
    ]
    for field in editable:
        if field in data:
            setattr(decision, field, data[field])

    # Update revenue split if amount changed
    if 'final_amount' in data and data['final_amount']:
        rule = SanctionRule.query.filter_by(
            violation_code=decision.violation_code, is_active=True
        ).first()
        state_pct = ((rule.revenue_split_state_pct or 50) / 100.0) if rule else 0.5
        region_pct = ((rule.revenue_split_region_pct or 50) / 100.0) if rule else 0.5
        decision.amount_state = round(data['final_amount'] * state_pct, 2)
        decision.amount_region = round(data['final_amount'] * region_pct, 2)
        # Also update the underlying sanction
        if decision.sanction:
            decision.sanction.amount = data['final_amount']
            decision.sanction.final_amount = data['final_amount']

    if decision.status == 'returned':
        decision.status = 'draft'

    db.session.commit()
    return jsonify(decision.to_dict()), 200


@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/submit', methods=['POST'])
@jwt_required()
def submit_decision(decision_id):
    """Submit a draft decision for approval."""
    decision = db.session.get(SanctionDecision, decision_id)
    if not decision:
        return jsonify({'error': 'Decision not found'}), 404
    if decision.status not in ('draft',):
        return jsonify({'error': 'Only draft decisions can be submitted'}), 400

    if not decision.justification:
        return jsonify({'error': 'Justification is required before submission'}), 400

    decision.status = 'submitted'
    db.session.commit()
    return jsonify(decision.to_dict()), 200


@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/approve', methods=['POST'])
@jwt_required()
def approve_decision(decision_id):
    """Approve or return a submitted decision (admin/director only)."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = db.session.get(User, user_id)
    if not user or user.role not in ('admin', 'director'):
        return jsonify({'error': 'Director or admin only'}), 403

    decision = db.session.get(SanctionDecision, decision_id)
    if not decision:
        return jsonify({'error': 'Decision not found'}), 404
    if decision.status != 'submitted':
        return jsonify({'error': 'Only submitted decisions can be approved/returned'}), 400

    data = request.get_json()
    action = data.get('action', 'approve')

    if action == 'approve':
        decision.status = 'approved'
        decision.approved_by = user_id
        decision.approved_at = datetime.utcnow()
        # Auto-generate protocol number
        year = datetime.utcnow().year
        count = SanctionDecision.query.filter(
            SanctionDecision.protocol_number.isnot(None),
            SanctionDecision.protocol_number.like(f'{year}/%'),
        ).count()
        decision.protocol_number = f'{year}/{count + 1:04d}'
        # Bridge: create document record for the registry
        from ..documents.bridge import create_decision_from_sanction
        create_decision_from_sanction(decision)
    elif action == 'return':
        decision.status = 'returned'
        decision.return_comments = data.get('comments', '')
    else:
        return jsonify({'error': 'Invalid action, use approve or return'}), 400

    db.session.commit()
    return jsonify(decision.to_dict()), 200


@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/notify', methods=['POST'])
@jwt_required()
def notify_decision(decision_id):
    """Mark an approved decision as notified and set deadlines."""
    decision = db.session.get(SanctionDecision, decision_id)
    if not decision:
        return jsonify({'error': 'Decision not found'}), 404
    if decision.status != 'approved':
        return jsonify({'error': 'Only approved decisions can be notified'}), 400

    data = request.get_json() or {}

    rule = SanctionRule.query.filter_by(
        violation_code=decision.violation_code, is_active=True
    ).first()
    payment_days = (rule.payment_deadline_days or 60) if rule else 60
    appeal_days = (rule.appeal_deadline_days or 15) if rule else 15

    decision.status = 'notified'
    decision.notified_at = datetime.utcnow()
    decision.notification_method = data.get('method', 'personal_service')
    decision.payment_deadline = date.today() + timedelta(days=payment_days)
    decision.appeal_deadline = date.today() + timedelta(days=appeal_days)

    # Update underlying sanction protocol
    if decision.sanction and decision.protocol_number:
        decision.sanction.protocol_number = decision.protocol_number

    db.session.commit()
    return jsonify(decision.to_dict()), 200


@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/payment', methods=['POST'])
@jwt_required()
def update_payment(decision_id):
    """Update payment status: paid, appealed, or cancelled."""
    decision = db.session.get(SanctionDecision, decision_id)
    if not decision:
        return jsonify({'error': 'Decision not found'}), 404
    if decision.status not in ('notified', 'overdue'):
        return jsonify({'error': 'Only notified/overdue decisions can be updated'}), 400

    data = request.get_json()
    action = data.get('action')  # paid, appealed, cancelled
    if action not in ('paid', 'appealed', 'cancelled'):
        return jsonify({'error': 'action must be paid, appealed, or cancelled'}), 400

    decision.status = action
    if action == 'paid':
        decision.paid_at = datetime.utcnow()
        decision.paid_amount = data.get('paid_amount', decision.final_amount)
        if decision.sanction:
            decision.sanction.status = 'paid'
    elif action == 'appealed':
        if decision.sanction:
            decision.sanction.status = 'appealed'
    elif action == 'cancelled':
        if decision.sanction:
            decision.sanction.status = 'cancelled'

    db.session.commit()
    return jsonify(decision.to_dict()), 200


@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/export', methods=['GET'])
@jwt_required()
def export_decision(decision_id):
    """Export decision data in OPS ΧΚ format for interop."""
    decision = db.session.get(SanctionDecision, decision_id)
    if not decision:
        return jsonify({'error': 'Decision not found'}), 404

    rule = SanctionRule.query.filter_by(
        violation_code=decision.violation_code, is_active=True
    ).first()

    export_data = {
        'catalog_type': '64004/04',
        'decision_number': decision.protocol_number or '',
        'decision_date': (
            decision.approved_at.strftime('%Y-%m-%d')
            if decision.approved_at else ''
        ),
        'irida_protocol': '',
        'doy': decision.obligor_doy or '',
        'organizational_unit': 'Τμήμα Κοινωνικής Αλληλεγγύης',
        'reason': (
            f'{rule.revenue_split_state_ale or "1560989001"} - '
            f'Πρόστιμο Ν.5041/2023 Συν.Ποσό {decision.final_amount:,.2f}€'
            if rule else f'Πρόστιμο {decision.final_amount:,.2f}€'
        ),
        'obligor': {
            'category': 'ΙΔΙΩΤΕΣ',
            'name': decision.obligor_name or '',
            'afm': decision.obligor_afm or '',
            'doy': decision.obligor_doy or '',
            'address': decision.obligor_address or '',
        },
        'amounts': {
            'state_budget': decision.amount_state or 0,
            'region_budget': decision.amount_region or 0,
            'legal_reference': rule.legal_reference if rule else 'Ν.5041/2023 αρ.100',
        },
    }
    return jsonify(export_data), 200


@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/pdf', methods=['GET'])
@jwt_required()
def generate_pdf(decision_id):
    """Generate and return PDF for a sanction decision."""
    from .pdf_generator import generate_decision_pdf

    decision = db.session.get(SanctionDecision, decision_id)
    if not decision:
        return jsonify({'error': 'Decision not found'}), 404

    rule = SanctionRule.query.filter_by(
        violation_code=decision.violation_code, is_active=True
    ).first()

    try:
        pdf_bytes = generate_decision_pdf(decision, rule)
    except Exception as e:
        return jsonify({'error': f'PDF generation failed: {str(e)}'}), 500

    from io import BytesIO
    return send_file(
        BytesIO(pdf_bytes),
        mimetype='application/pdf',
        as_attachment=False,
        download_name=f'decision-{decision_id}.pdf',
    )
