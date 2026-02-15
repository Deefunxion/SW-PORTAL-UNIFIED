import time
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import interop_bp
from ..extensions import db
from .models import InteropLog
from .aade import AADEService


@interop_bp.route('/api/interop/aade/lookup', methods=['POST'])
@jwt_required()
def aade_lookup():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    afm = data.get('afm', '').strip()
    if not afm or len(afm) != 9:
        return jsonify({'error': '\u0391\u03a6\u039c \u03c0\u03c1\u03ad\u03c0\u03b5\u03b9 \u03bd\u03b1 \u03b5\u03af\u03bd\u03b1\u03b9 9 \u03c8\u03b7\u03c6\u03af\u03b1'}), 400

    start = time.time()
    service = AADEService()
    result = service.lookup(afm)
    elapsed = int((time.time() - start) * 1000)

    log = InteropLog(
        service_name='aade', request_type='lookup',
        request_data={'afm': afm}, response_data=result,
        status='success' if result.get('found') else 'not_found',
        response_time_ms=elapsed, user_id=user_id,
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(result), 200


@interop_bp.route('/api/interop/log', methods=['GET'])
@jwt_required()
def interop_log():
    user_id = int(get_jwt_identity())
    from ..models import User
    user = db.session.get(User, user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    logs = InteropLog.query.order_by(InteropLog.created_at.desc()).limit(50).all()
    return jsonify([entry.to_dict() for entry in logs]), 200
