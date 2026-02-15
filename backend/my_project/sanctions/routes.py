from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import sanctions_bp
from ..extensions import db
from .models import SanctionRule
from .calculator import calculate_fine


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
