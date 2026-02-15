import os
from datetime import date
from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import registry_bp
from ..extensions import db
from .models import Structure, StructureType, License, Sanction
from .permissions import can_edit_structure, is_director


def _parse_date(value):
    """Parse a date string (YYYY-MM-DD) into a Python date object."""
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


@registry_bp.route('/api/structure-types', methods=['GET'])
@jwt_required()
def list_structure_types():
    types = StructureType.query.filter_by(active=True).all()
    return jsonify([t.to_dict() for t in types]), 200


@registry_bp.route('/api/structure-types', methods=['POST'])
@jwt_required()
def create_structure_type():
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    data = request.get_json()
    st = StructureType(code=data['code'], name=data['name'],
                       description=data.get('description'))
    db.session.add(st)
    db.session.commit()
    return jsonify(st.to_dict()), 201


@registry_bp.route('/api/structures', methods=['GET'])
@jwt_required()
def list_structures():
    user_id = int(get_jwt_identity())
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    query = Structure.query

    # Multi-tenant: directors see only their peripheral unit
    from ..models import User
    user = User.query.get(user_id)
    if user and user.role != 'admin' and is_director(user_id) and user.peripheral_unit:
        query = query.filter_by(peripheral_unit=user.peripheral_unit)

    # Filters
    type_id = request.args.get('type_id', type=int)
    status = request.args.get('status')
    advisor_id = request.args.get('advisor_id', type=int)
    search = request.args.get('search')
    unit = request.args.get('peripheral_unit')

    if type_id:
        query = query.filter_by(type_id=type_id)
    if status:
        query = query.filter_by(status=status)
    if advisor_id:
        query = query.filter_by(advisor_id=advisor_id)
    if unit:
        query = query.filter_by(peripheral_unit=unit)
    if search:
        query = query.filter(
            db.or_(
                Structure.name.ilike(f'%{search}%'),
                Structure.code.ilike(f'%{search}%')
            )
        )

    query = query.order_by(Structure.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'structures': [s.to_dict() for s in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }), 200


@registry_bp.route('/api/structures', methods=['POST'])
@jwt_required()
def create_structure():
    user_id = int(get_jwt_identity())
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json()
    required = ['code', 'name', 'type_id']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400

    if Structure.query.filter_by(code=data['code']).first():
        return jsonify({'error': 'Code already exists'}), 409

    structure = Structure(
        code=data['code'], name=data['name'], type_id=data['type_id'],
        street=data.get('street'), city=data.get('city'),
        postal_code=data.get('postal_code'),
        representative_name=data.get('representative_name'),
        representative_afm=data.get('representative_afm'),
        representative_phone=data.get('representative_phone'),
        representative_email=data.get('representative_email'),
        capacity=data.get('capacity'), status=data.get('status', 'active'),
        ownership=data.get('ownership'),
        license_number=data.get('license_number'),
        license_date=_parse_date(data.get('license_date')),
        license_expiry=_parse_date(data.get('license_expiry')),
        advisor_id=data.get('advisor_id'),
        peripheral_unit=data.get('peripheral_unit'),
        notes=data.get('notes'),
    )
    db.session.add(structure)
    db.session.commit()
    return jsonify(structure.to_dict()), 201


@registry_bp.route('/api/structures/<int:structure_id>', methods=['GET'])
@jwt_required()
def get_structure(structure_id):
    structure = Structure.query.get_or_404(structure_id)
    return jsonify(structure.to_dict()), 200


@registry_bp.route('/api/structures/<int:structure_id>', methods=['PUT'])
@jwt_required()
def update_structure(structure_id):
    user_id = int(get_jwt_identity())
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    structure = Structure.query.get_or_404(structure_id)
    data = request.get_json()

    for field in ['name', 'type_id', 'street', 'city', 'postal_code',
                  'representative_name', 'representative_afm',
                  'representative_phone', 'representative_email',
                  'capacity', 'status', 'ownership', 'license_number',
                  'advisor_id', 'peripheral_unit', 'notes']:
        if field in data:
            setattr(structure, field, data[field])

    db.session.commit()
    return jsonify(structure.to_dict()), 200


# License endpoints
@registry_bp.route('/api/structures/<int:structure_id>/licenses', methods=['GET'])
@jwt_required()
def list_licenses(structure_id):
    Structure.query.get_or_404(structure_id)
    licenses = License.query.filter_by(structure_id=structure_id).order_by(License.issued_date.desc()).all()
    return jsonify([lic.to_dict() for lic in licenses]), 200


@registry_bp.route('/api/structures/<int:structure_id>/licenses', methods=['POST'])
@jwt_required()
def create_license(structure_id):
    user_id = int(get_jwt_identity())
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403
    Structure.query.get_or_404(structure_id)
    data = request.get_json()
    lic = License(
        structure_id=structure_id, type=data['type'],
        protocol_number=data.get('protocol_number'),
        issued_date=_parse_date(data.get('issued_date')),
        expiry_date=_parse_date(data.get('expiry_date')),
        status=data.get('status', 'active'), notes=data.get('notes'),
    )
    db.session.add(lic)
    db.session.commit()
    return jsonify(lic.to_dict()), 201


# Sanction endpoints
@registry_bp.route('/api/sanctions', methods=['GET'])
@jwt_required()
def list_all_sanctions():
    sanctions = Sanction.query.order_by(Sanction.imposed_date.desc()).all()
    result = []
    for s in sanctions:
        d = s.to_dict()
        d['structure_name'] = s.structure.name if s.structure else None
        d['structure_code'] = s.structure.code if s.structure else None
        result.append(d)
    return jsonify(result), 200


@registry_bp.route('/api/structures/<int:structure_id>/sanctions', methods=['GET'])
@jwt_required()
def list_sanctions(structure_id):
    Structure.query.get_or_404(structure_id)
    sanctions = Sanction.query.filter_by(structure_id=structure_id).order_by(Sanction.imposed_date.desc()).all()
    return jsonify([s.to_dict() for s in sanctions]), 200


@registry_bp.route('/api/structures/<int:structure_id>/sanctions', methods=['POST'])
@jwt_required()
def create_sanction(structure_id):
    user_id = int(get_jwt_identity())
    if not is_director(user_id):
        from ..models import User
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Director or admin only'}), 403
    Structure.query.get_or_404(structure_id)
    data = request.get_json()
    sanction = Sanction(
        structure_id=structure_id, type=data['type'],
        inspection_id=data.get('inspection_id'),
        amount=data.get('amount'), imposed_date=_parse_date(data.get('imposed_date')),
        status=data.get('status', 'imposed'),
        protocol_number=data.get('protocol_number'),
        notes=data.get('notes'),
    )
    db.session.add(sanction)
    db.session.commit()
    return jsonify(sanction.to_dict()), 201


@registry_bp.route('/api/sanctions/<int:sanction_id>', methods=['PATCH'])
@jwt_required()
def update_sanction(sanction_id):
    user_id = int(get_jwt_identity())
    if not is_director(user_id):
        from ..models import User
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Director or admin only'}), 403
    sanction = Sanction.query.get_or_404(sanction_id)
    data = request.get_json()
    for field in ['status', 'notes', 'amount']:
        if field in data:
            setattr(sanction, field, data[field])
    db.session.commit()
    return jsonify(sanction.to_dict()), 200


# Timeline endpoint
@registry_bp.route('/api/structures/<int:structure_id>/timeline', methods=['GET'])
@jwt_required()
def structure_timeline(structure_id):
    """Merge all events for a structure into a single chronological list."""
    Structure.query.get_or_404(structure_id)
    from ..inspections.models import Inspection, InspectionReport
    from ..oversight.models import SocialAdvisorReport

    events = []

    # Licenses
    for lic in License.query.filter_by(structure_id=structure_id).all():
        events.append({
            'type': 'license',
            'date': (lic.issued_date or lic.created_at.date()).isoformat() if lic.issued_date else lic.created_at.date().isoformat(),
            'title': f'Άδεια: {lic.type}',
            'status': lic.status,
            'detail': f'Αρ. πρωτ. {lic.protocol_number}' if lic.protocol_number else None,
            'id': lic.id,
        })

    # Sanctions
    for s in Sanction.query.filter_by(structure_id=structure_id).all():
        dt = s.imposed_date or s.created_at.date()
        events.append({
            'type': 'sanction',
            'date': dt.isoformat(),
            'title': f'Κύρωση: {s.type}',
            'status': s.status,
            'detail': f'{s.amount} €' if s.amount else None,
            'id': s.id,
        })

    # Inspections
    for insp in Inspection.query.filter_by(structure_id=structure_id).all():
        dt = insp.scheduled_date or insp.created_at.date()
        events.append({
            'type': 'inspection',
            'date': dt.isoformat(),
            'title': f'Έλεγχος: {insp.type}',
            'status': insp.status,
            'detail': insp.conclusion,
            'id': insp.id,
        })

    # Advisor reports
    for r in SocialAdvisorReport.query.filter_by(structure_id=structure_id).all():
        dt = r.drafted_date or r.created_at.date()
        events.append({
            'type': 'report',
            'date': dt.isoformat(),
            'title': f'Έκθεση: {r.type}',
            'status': r.status,
            'detail': (r.assessment or '')[:80] or None,
            'id': r.id,
        })

    # Sort newest first
    events.sort(key=lambda e: e['date'], reverse=True)
    return jsonify(events), 200


# ── Legislation files per structure type ──────────────────────────────

# Map structure type codes to content sub-folders under ΝΟΜΟΘΕΣΙΑ_ΚΟΙΝΩΝΙΚΗΣ_ΜΕΡΙΜΝΑΣ
_LEGISLATION_FOLDERS = {
    'MFH': 'ΜΦΗ',
    'KDAP': 'ΚΔΑΠ - ΚΔΑΠ ΑμεΑ',
    'SYD': 'ΣΥΔ',
    'KDHF-KAA': 'ΚΑΑ - ΚΔΗΦ',
    'CAMP': 'ΠΑΙΔΙΚΕΣ ΕΞΟΧΕΣ',
    'MFPAD': 'ΒΣΦΟΠ',
    'KIFI': 'ΚΗΦΗ',
}

_ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.txt', '.md'}


@registry_bp.route('/api/legislation/<type_code>', methods=['GET'])
@jwt_required()
def list_legislation(type_code):
    """List legislation files for a given structure type code."""
    folder_name = _LEGISLATION_FOLDERS.get(type_code)
    if not folder_name:
        return jsonify({'files': [], 'folder': None}), 200

    base = current_app.config['UPLOAD_FOLDER']
    if not os.path.isabs(base):
        base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), base)

    legislation_dir = os.path.join(base, 'ΝΟΜΟΘΕΣΙΑ_ΚΟΙΝΩΝΙΚΗΣ_ΜΕΡΙΜΝΑΣ', folder_name)
    if not os.path.isdir(legislation_dir):
        return jsonify({'files': [], 'folder': folder_name}), 200

    files = []
    for fname in sorted(os.listdir(legislation_dir)):
        ext = os.path.splitext(fname)[1].lower()
        if ext not in _ALLOWED_EXTENSIONS:
            continue
        fpath = os.path.join(legislation_dir, fname)
        if not os.path.isfile(fpath):
            continue
        size_bytes = os.path.getsize(fpath)
        # Content path relative to UPLOAD_FOLDER for /content/<path> serving
        rel_path = f'ΝΟΜΟΘΕΣΙΑ_ΚΟΙΝΩΝΙΚΗΣ_ΜΕΡΙΜΝΑΣ/{folder_name}/{fname}'
        files.append({
            'name': fname,
            'path': rel_path,
            'size': size_bytes,
            'extension': ext,
        })

    return jsonify({'files': files, 'folder': folder_name}), 200
