from datetime import datetime, date
import os
from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
from . import inspections_bp
from ..extensions import db
from .models import (Inspection, InspectionReport, InspectionCommittee,
                     CommitteeMembership, CommitteeStructureAssignment,
                     ChecklistTemplate)
from .permissions import is_committee_member


def _parse_date(value):
    """Parse a date string (YYYY-MM-DD) into a Python date object."""
    if value is None:
        return None
    if isinstance(value, date):
        return value
    return date.fromisoformat(value)


# --- Inspections CRUD ---

@inspections_bp.route('/api/inspections', methods=['GET'])
@jwt_required()
def list_inspections():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    query = Inspection.query

    structure_id = request.args.get('structure_id', type=int)
    committee_id = request.args.get('committee_id', type=int)
    status = request.args.get('status')
    inspection_type = request.args.get('type')

    if structure_id:
        query = query.filter_by(structure_id=structure_id)
    if committee_id:
        query = query.filter_by(committee_id=committee_id)
    if status:
        query = query.filter_by(status=status)
    if inspection_type:
        query = query.filter_by(type=inspection_type)

    query = query.order_by(Inspection.scheduled_date.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'inspections': [i.to_dict() for i in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }), 200


@inspections_bp.route('/api/inspections', methods=['POST'])
@jwt_required()
def create_inspection():
    user_id = int(get_jwt_identity())
    from ..registry.permissions import can_edit_structure
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json()
    required = ['structure_id', 'committee_id', 'type', 'scheduled_date']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400

    inspection = Inspection(
        structure_id=data['structure_id'],
        committee_id=data['committee_id'],
        type=data['type'],
        scheduled_date=_parse_date(data['scheduled_date']),
        status=data.get('status', 'scheduled'),
        notes=data.get('notes'),
    )
    db.session.add(inspection)
    db.session.commit()
    return jsonify(inspection.to_dict()), 201


@inspections_bp.route('/api/inspections/<int:inspection_id>', methods=['GET'])
@jwt_required()
def get_inspection(inspection_id):
    inspection = Inspection.query.get_or_404(inspection_id)
    result = inspection.to_dict()
    if inspection.report:
        result['report'] = inspection.report.to_dict()
    result['committee'] = inspection.committee.to_dict(include_members=True) if inspection.committee else None
    # Include structure type info for checklist selection
    if inspection.structure and inspection.structure.structure_type:
        result['structure']['type'] = inspection.structure.structure_type.to_dict()
    return jsonify(result), 200


@inspections_bp.route('/api/inspections/<int:inspection_id>', methods=['PATCH'])
@jwt_required()
def update_inspection(inspection_id):
    user_id = int(get_jwt_identity())
    from ..registry.permissions import can_edit_structure
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    inspection = Inspection.query.get_or_404(inspection_id)
    data = request.get_json()
    for field in ['status', 'conclusion', 'notes', 'type']:
        if field in data:
            setattr(inspection, field, data[field])
    if 'scheduled_date' in data:
        inspection.scheduled_date = _parse_date(data['scheduled_date'])
    db.session.commit()
    return jsonify(inspection.to_dict()), 200


# --- Inspection Reports ---

@inspections_bp.route('/api/inspections/<int:inspection_id>/report', methods=['POST'])
@jwt_required()
def submit_report(inspection_id):
    user_id = int(get_jwt_identity())
    inspection = Inspection.query.get_or_404(inspection_id)

    findings = request.form.get('findings', '')
    recommendations = request.form.get('recommendations', '')
    protocol_number = request.form.get('protocol_number', '')
    conclusion = request.form.get('conclusion')
    checklist_json = request.form.get('checklist_data')
    checklist_data = None
    if checklist_json:
        import json
        try:
            checklist_data = json.loads(checklist_json)
        except (json.JSONDecodeError, TypeError):
            pass

    file_path = None
    if 'file' in request.files:
        file = request.files['file']
        if file and file.filename:
            filename = secure_filename(file.filename)
            upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'inspections')
            os.makedirs(upload_dir, exist_ok=True)
            full_path = os.path.join(upload_dir, f'{inspection_id}_{filename}')
            file.save(full_path)
            file_path = f'inspections/{inspection_id}_{filename}'

    report = InspectionReport(
        inspection_id=inspection_id,
        protocol_number=protocol_number,
        drafted_date=date.today(),
        findings=findings,
        recommendations=recommendations,
        checklist_data=checklist_data,
        file_path=file_path,
        status='submitted',
        submitted_by=user_id,
        submitted_at=datetime.utcnow(),
    )
    if conclusion:
        inspection.conclusion = conclusion
        inspection.status = 'completed'

    db.session.add(report)

    from ..oversight.notifications import notify_report_submitted
    notify_report_submitted(report, report_kind='inspection')

    db.session.commit()
    return jsonify(report.to_dict()), 201


@inspections_bp.route('/api/inspections/<int:inspection_id>/report', methods=['GET'])
@jwt_required()
def get_report(inspection_id):
    Inspection.query.get_or_404(inspection_id)
    report = InspectionReport.query.filter_by(inspection_id=inspection_id).first()
    if not report:
        return jsonify({'error': 'No report found'}), 404
    return jsonify(report.to_dict()), 200


@inspections_bp.route('/api/inspection-reports/<int:report_id>', methods=['PATCH'])
@jwt_required()
def update_report_status(report_id):
    user_id = int(get_jwt_identity())
    from ..registry.permissions import is_director
    from ..models import User
    user = User.query.get(user_id)
    if not is_director(user_id) and (not user or user.role != 'admin'):
        return jsonify({'error': 'Director or admin only'}), 403

    report = InspectionReport.query.get_or_404(report_id)
    data = request.get_json()
    if 'status' in data:
        report.status = data['status']
    db.session.commit()
    return jsonify(report.to_dict()), 200


# --- Committees ---

@inspections_bp.route('/api/committees', methods=['GET'])
@jwt_required()
def list_committees():
    committees = InspectionCommittee.query.order_by(InspectionCommittee.created_at.desc()).all()
    return jsonify([c.to_dict(include_members=True) for c in committees]), 200


@inspections_bp.route('/api/committees', methods=['POST'])
@jwt_required()
def create_committee():
    user_id = int(get_jwt_identity())
    from ..registry.permissions import can_edit_structure
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json()
    committee = InspectionCommittee(
        decision_number=data['decision_number'],
        appointed_date=_parse_date(data['appointed_date']),
        expiry_date=_parse_date(data.get('expiry_date')),
        status=data.get('status', 'active'),
        notes=data.get('notes'),
    )
    db.session.add(committee)
    db.session.commit()
    return jsonify(committee.to_dict()), 201


@inspections_bp.route('/api/committees/<int:committee_id>', methods=['GET'])
@jwt_required()
def get_committee(committee_id):
    committee = InspectionCommittee.query.get_or_404(committee_id)
    return jsonify(committee.to_dict(include_members=True, include_structures=True)), 200


@inspections_bp.route('/api/committees/<int:committee_id>', methods=['PUT'])
@jwt_required()
def update_committee(committee_id):
    user_id = int(get_jwt_identity())
    from ..registry.permissions import can_edit_structure
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    committee = InspectionCommittee.query.get_or_404(committee_id)
    data = request.get_json()
    for field in ['decision_number', 'status', 'notes']:
        if field in data:
            setattr(committee, field, data[field])
    if 'appointed_date' in data:
        committee.appointed_date = _parse_date(data['appointed_date'])
    if 'expiry_date' in data:
        committee.expiry_date = _parse_date(data['expiry_date'])
    db.session.commit()
    return jsonify(committee.to_dict(include_members=True)), 200


@inspections_bp.route('/api/committees/<int:committee_id>/members', methods=['POST'])
@jwt_required()
def add_committee_member(committee_id):
    user_id = int(get_jwt_identity())
    from ..registry.permissions import can_edit_structure
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    InspectionCommittee.query.get_or_404(committee_id)
    data = request.get_json()
    membership = CommitteeMembership(
        committee_id=committee_id,
        user_id=data['user_id'],
        role=data.get('role', 'member'),
    )
    db.session.add(membership)

    from ..oversight.notifications import notify_committee_appointment
    notify_committee_appointment(membership)

    db.session.commit()
    return jsonify(membership.to_dict()), 201


@inspections_bp.route('/api/committees/<int:committee_id>/members/<int:user_id>', methods=['DELETE'])
@jwt_required()
def remove_committee_member(committee_id, user_id):
    current_user_id = int(get_jwt_identity())
    from ..registry.permissions import can_edit_structure
    if not can_edit_structure(current_user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    membership = CommitteeMembership.query.filter_by(
        committee_id=committee_id, user_id=user_id
    ).first_or_404()
    db.session.delete(membership)
    db.session.commit()
    return jsonify({'message': 'Member removed'}), 200


# --- Checklist Templates ---

@inspections_bp.route('/api/checklist-templates', methods=['GET'])
@jwt_required()
def list_checklist_templates():
    templates = ChecklistTemplate.query.filter_by(is_active=True).all()
    return jsonify([t.to_dict() for t in templates]), 200


@inspections_bp.route('/api/checklist-templates/<int:type_id>', methods=['GET'])
@jwt_required()
def get_checklist_for_type(type_id):
    template = ChecklistTemplate.query.filter_by(
        structure_type_id=type_id, is_active=True
    ).order_by(ChecklistTemplate.version.desc()).first()
    if not template:
        return jsonify({'error': 'No checklist template for this type'}), 404
    return jsonify(template.to_dict()), 200


@inspections_bp.route('/api/committees/<int:committee_id>/structures', methods=['POST'])
@jwt_required()
def assign_structure_to_committee(committee_id):
    user_id = int(get_jwt_identity())
    from ..registry.permissions import can_edit_structure
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    InspectionCommittee.query.get_or_404(committee_id)
    data = request.get_json()
    assignment = CommitteeStructureAssignment(
        committee_id=committee_id,
        structure_id=data['structure_id'],
        assigned_date=_parse_date(data.get('assigned_date', date.today().isoformat())),
    )
    db.session.add(assignment)
    db.session.commit()
    return jsonify(assignment.to_dict()), 201
