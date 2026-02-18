import os
from datetime import datetime
from flask import jsonify, request, current_app, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import documents_bp
from ..extensions import db
from .models import DecisionTemplate, DecisionRecord, DocumentAuditLog
from .generator import resolve_placeholders, generate_decision_pdf, generate_decision_docx


def _audit(user_id, action, entity_type, entity_id, details=None):
    log = DocumentAuditLog(user_id=user_id, action=action,
                           entity_type=entity_type, entity_id=entity_id,
                           details=details)
    db.session.add(log)


def _next_internal_number():
    """Generate next internal document number: ΠΚΜ-YYYY/NNNN."""
    year = datetime.utcnow().year
    prefix = f'ΠΚΜ-{year}/'
    last = (DecisionRecord.query
            .filter(DecisionRecord.internal_number.like(f'{prefix}%'))
            .order_by(DecisionRecord.internal_number.desc())
            .first())
    if last and last.internal_number:
        seq = int(last.internal_number.split('/')[1]) + 1
    else:
        seq = 1
    return f'{prefix}{seq:04d}'


# --- Templates ---

@documents_bp.route('/api/templates', methods=['GET'])
@jwt_required()
def list_templates():
    """List all active decision templates."""
    type_filter = request.args.get('type')
    structure_type = request.args.get('structure_type')
    query = DecisionTemplate.query.filter_by(is_active=True)
    if type_filter:
        query = query.filter_by(type=type_filter)
    if structure_type:
        query = query.filter(
            db.or_(
                DecisionTemplate.structure_type_code == structure_type,
                DecisionTemplate.structure_type_code.is_(None)
            )
        )
    templates = query.order_by(DecisionTemplate.title).all()
    return jsonify([t.to_dict() for t in templates]), 200


@documents_bp.route('/api/templates/<int:template_id>', methods=['GET'])
@jwt_required()
def get_template(template_id):
    template = DecisionTemplate.query.get_or_404(template_id)
    return jsonify(template.to_dict()), 200


# --- Decision Records ---

@documents_bp.route('/api/decisions', methods=['GET'])
@jwt_required()
def list_decisions():
    """List decision records with filters."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    template_type = request.args.get('type')
    structure_id = request.args.get('structure_id', type=int)
    search = request.args.get('search')

    query = DecisionRecord.query
    if status:
        query = query.filter_by(status=status)
    if template_type:
        query = query.join(DecisionTemplate).filter(
            DecisionTemplate.type == template_type)
    if structure_id:
        query = query.filter_by(structure_id=structure_id)
    if search:
        query = query.filter(
            db.or_(
                DecisionRecord.protocol_number.ilike(f'%{search}%'),
                DecisionRecord.rendered_body.ilike(f'%{search}%'),
            )
        )

    query = query.order_by(DecisionRecord.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page,
                                error_out=False)

    return jsonify({
        'decisions': [d.to_dict() for d in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }), 200


@documents_bp.route('/api/decisions', methods=['POST'])
@jwt_required()
def create_decision():
    """Create a new decision record (draft)."""
    user_id = int(get_jwt_identity())
    data = request.get_json()

    template = DecisionTemplate.query.get_or_404(data['template_id'])

    from ..registry.models import Structure
    structure = None
    if data.get('structure_id'):
        structure = Structure.query.get(data['structure_id'])

    # Render template with provided data
    user_data = data.get('data', {})
    rendered = resolve_placeholders(
        template.body_template, structure, user_data)

    record = DecisionRecord(
        template_id=template.id,
        structure_id=data.get('structure_id'),
        data=user_data,
        rendered_body=rendered,
        status='draft',
        created_by=user_id,
        internal_number=_next_internal_number(),
    )
    db.session.add(record)
    db.session.flush()

    _audit(user_id, 'create_draft', 'decision_record', record.id)
    db.session.commit()

    return jsonify(record.to_dict()), 201


@documents_bp.route('/api/decisions/<int:decision_id>', methods=['GET'])
@jwt_required()
def get_decision(decision_id):
    record = DecisionRecord.query.get_or_404(decision_id)
    result = record.to_dict()
    # Include template schema for the edit form
    if record.template:
        result['template_schema'] = record.template.schema
        result['legal_references'] = record.template.legal_references
        result['recipients_template'] = record.template.recipients_template
    return jsonify(result), 200


@documents_bp.route('/api/decisions/<int:decision_id>', methods=['PUT'])
@jwt_required()
def update_decision(decision_id):
    """Update a draft decision."""
    user_id = int(get_jwt_identity())
    record = DecisionRecord.query.get_or_404(decision_id)

    if record.status != 'draft':
        return jsonify({'error': 'Μόνο πρόχειρα έγγραφα μπορούν να '
                        'τροποποιηθούν'}), 400

    data = request.get_json()
    user_data = data.get('data', record.data)

    from ..registry.models import Structure
    structure = (Structure.query.get(record.structure_id)
                 if record.structure_id else None)

    record.data = user_data
    record.rendered_body = resolve_placeholders(
        record.template.body_template, structure, user_data)

    _audit(user_id, 'update_draft', 'decision_record', record.id)
    db.session.commit()

    return jsonify(record.to_dict()), 200


@documents_bp.route('/api/decisions/<int:decision_id>/preview',
                     methods=['GET'])
@jwt_required()
def preview_decision(decision_id):
    """Return rendered HTML for live preview."""
    record = DecisionRecord.query.get_or_404(decision_id)
    return jsonify({
        'html': record.rendered_body,
        'title': record.template.title if record.template else '',
    }), 200


@documents_bp.route('/api/decisions/<int:decision_id>/pdf',
                     methods=['GET'])
@jwt_required()
def generate_pdf(decision_id):
    """Generate and return PDF for a decision."""
    user_id = int(get_jwt_identity())
    record = DecisionRecord.query.get_or_404(decision_id)

    recipients = (record.template.recipients_template
                  if record.template else [])
    title = record.template.title if record.template else 'Έγγραφο'

    pdf_bytes = generate_decision_pdf(
        record.rendered_body, title, recipients)

    _audit(user_id, 'generate_pdf', 'decision_record', record.id)
    db.session.commit()

    return Response(
        pdf_bytes,
        mimetype='application/pdf',
        headers={
            'Content-Disposition':
                f'attachment; filename="decision_{record.id}.pdf"'
        },
    )


@documents_bp.route('/api/decisions/<int:decision_id>/docx',
                     methods=['GET'])
@jwt_required()
def generate_docx(decision_id):
    """Generate and return DOCX for a decision."""
    user_id = int(get_jwt_identity())
    record = DecisionRecord.query.get_or_404(decision_id)

    recipients = (record.template.recipients_template
                  if record.template else [])
    title = record.template.title if record.template else 'Έγγραφο'
    legal_refs = (record.template.legal_references
                  if record.template else [])

    docx_bytes = generate_decision_docx(
        record.rendered_body, title, recipients, legal_refs,
        protocol_number=record.protocol_number)

    _audit(user_id, 'generate_docx', 'decision_record', record.id)
    db.session.commit()

    return Response(
        docx_bytes,
        mimetype='application/vnd.openxmlformats-officedocument'
                 '.wordprocessingml.document',
        headers={
            'Content-Disposition':
                f'attachment; filename="decision_{record.id}.docx"'
        },
    )


@documents_bp.route(
    '/api/decisions/<int:decision_id>/set-protocol', methods=['PATCH'])
@jwt_required()
def set_protocol(decision_id):
    """Manually set protocol number (from ΙΡΙΔΑ)."""
    user_id = int(get_jwt_identity())
    record = DecisionRecord.query.get_or_404(decision_id)
    data = request.get_json()

    record.protocol_number = data.get('protocol_number')
    record.ada_code = data.get('ada_code')
    record.status = 'protocol_received'
    record.protocol_received_at = datetime.utcnow()

    _audit(user_id, 'receive_protocol', 'decision_record', record.id,
           {'protocol': record.protocol_number})
    db.session.commit()

    return jsonify(record.to_dict()), 200


# --- ΙΡΙΔΑ Integration ---

@documents_bp.route(
    '/api/decisions/<int:decision_id>/send-to-irida', methods=['POST'])
@jwt_required()
def send_to_irida(decision_id):
    """Send a decision to ΙΡΙΔΑ for protocol assignment."""
    user_id = int(get_jwt_identity())
    record = DecisionRecord.query.get_or_404(decision_id)

    if record.status not in ('draft',):
        return jsonify({'error': 'Μόνο πρόχειρα έγγραφα μπορούν να '
                        'σταλούν'}), 400

    from ..integrations.irida_client import (send_document,
                                             is_configured)
    if not is_configured():
        return jsonify({'error': 'Η σύνδεση ΙΡΙΔΑ δεν έχει '
                        'ρυθμιστεί'}), 503

    # Generate DOCX for ΙΡΙΔΑ (ΙΡΙΔΑ converts to PDF internally)
    recipients = (record.template.recipients_template
                  if record.template else [])
    title = record.template.title if record.template else 'Έγγραφο'
    legal_refs = (record.template.legal_references
                  if record.template else [])
    docx_bytes = generate_decision_docx(
        record.rendered_body, title, recipients, legal_refs,
        protocol_number=record.protocol_number)

    try:
        result = send_document(
            subject=title,
            pdf_bytes=docx_bytes,
            filename=f'decision_{record.id}.docx',
        )
        record.status = 'sent_to_irida'
        record.sent_to_irida_at = datetime.utcnow()

        # If ΙΡΙΔΑ returns protocol number immediately
        if result.get('protocol_number'):
            record.protocol_number = result['protocol_number']
            record.status = 'protocol_received'
            record.protocol_received_at = datetime.utcnow()

        _audit(user_id, 'send_to_irida', 'decision_record',
               record.id, result)
        db.session.commit()
        return jsonify(record.to_dict()), 200

    except Exception as e:
        return jsonify({'error': f'Σφάλμα ΙΡΙΔΑ: {str(e)}'}), 502


# --- Document Registry (unified view) ---

@documents_bp.route('/api/document-registry', methods=['GET'])
@jwt_required()
def document_registry():
    """Unified view of all documents across all types."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    doc_type = request.args.get('type')
    status = request.args.get('status')
    structure_id = request.args.get('structure_id', type=int)
    search = request.args.get('search')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    documents = []

    # 1. DecisionRecords (composed documents)
    if not doc_type or doc_type == 'all' or doc_type == 'decision':
        for rec in DecisionRecord.query.all():
            documents.append({
                'id': rec.id,
                'source': 'decision_record',
                'type': rec.template.type if rec.template else 'unknown',
                'type_label': rec.template.title if rec.template else '',
                'internal_number': rec.internal_number,
                'protocol_number': rec.protocol_number,
                'structure_id': rec.structure_id,
                'structure_name': (rec.structure.name
                                   if rec.structure else None),
                'date': (rec.created_at.isoformat()
                         if rec.created_at else None),
                'status': rec.status,
                'author': (rec.author.username
                           if rec.author else None),
            })

    # 2. InspectionReports
    if not doc_type or doc_type == 'all' or doc_type == 'inspection_report':
        from ..inspections.models import InspectionReport
        for rpt in InspectionReport.query.all():
            insp = rpt.inspection
            documents.append({
                'id': rpt.id,
                'source': 'inspection_report',
                'type': 'inspection_report',
                'type_label': 'Έκθεση Επιθεώρησης',
                'protocol_number': rpt.protocol_number,
                'structure_id': insp.structure_id if insp else None,
                'structure_name': (insp.structure.name
                                   if insp and insp.structure else None),
                'date': (rpt.drafted_date.isoformat()
                         if rpt.drafted_date else None),
                'status': rpt.status,
                'author': None,
            })

    # 3. SocialAdvisorReports
    if not doc_type or doc_type == 'all' or doc_type == 'advisor_report':
        from ..oversight.models import SocialAdvisorReport
        for rpt in SocialAdvisorReport.query.all():
            documents.append({
                'id': rpt.id,
                'source': 'advisor_report',
                'type': 'advisor_report',
                'type_label': 'Έκθεση Κοιν. Συμβούλου',
                'protocol_number': None,
                'structure_id': rpt.structure_id,
                'structure_name': (rpt.structure.name
                                   if rpt.structure else None),
                'date': (rpt.drafted_date.isoformat()
                         if rpt.drafted_date else None),
                'status': rpt.status,
                'author': (rpt.author.username
                           if rpt.author else None),
            })

    # 4. SanctionDecisions (existing workflow)
    if not doc_type or doc_type == 'all' or doc_type == 'sanction_decision':
        from ..sanctions.models import SanctionDecision
        for dec in SanctionDecision.query.all():
            sanction = dec.sanction
            structure = (sanction.structure if sanction else None)
            documents.append({
                'id': dec.id,
                'source': 'sanction_decision',
                'type': 'sanction_decision',
                'type_label': 'Απόφαση Κύρωσης',
                'protocol_number': dec.protocol_number,
                'structure_id': (structure.id if structure else None),
                'structure_name': (structure.name
                                   if structure else None),
                'date': (dec.drafted_at.isoformat()
                         if dec.drafted_at else None),
                'status': dec.status,
                'author': None,
            })

    # Apply filters
    if status:
        documents = [d for d in documents if d['status'] == status]
    if structure_id:
        documents = [d for d in documents
                     if d['structure_id'] == structure_id]
    if search:
        s = search.lower()
        documents = [d for d in documents
                     if s in (d.get('protocol_number') or '').lower()
                     or s in (d.get('structure_name') or '').lower()
                     or s in (d.get('type_label') or '').lower()]
    if date_from:
        documents = [d for d in documents
                     if d['date'] and d['date'] >= date_from]
    if date_to:
        documents = [d for d in documents
                     if d['date'] and d['date'] <= date_to]

    # Sort newest first
    documents.sort(key=lambda d: d['date'] or '', reverse=True)

    # Paginate
    total = len(documents)
    start = (page - 1) * per_page
    end = start + per_page
    page_docs = documents[start:end]

    return jsonify({
        'documents': page_docs,
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page,
    }), 200


# --- Audit Log ---

@documents_bp.route('/api/audit-log', methods=['GET'])
@jwt_required()
def list_audit_log():
    """View document audit log (admin only)."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    logs = DocumentAuditLog.query.order_by(
        DocumentAuditLog.created_at.desc()).limit(100).all()
    return jsonify([l.to_dict() for l in logs]), 200


# --- ΙΡΙΔΑ Inbox ---

@documents_bp.route('/api/irida/inbox', methods=['GET'])
@jwt_required()
def irida_inbox():
    """Fetch pending items from ΙΡΙΔΑ inbox."""
    from ..integrations.irida_client import get_inbox, is_configured
    if not is_configured():
        return jsonify({'error': 'Η σύνδεση ΙΡΙΔΑ δεν έχει '
                        'ρυθμιστεί', 'items': []}), 503
    try:
        page = request.args.get('page', 1, type=int)
        size = request.args.get('size', 20, type=int)
        result = get_inbox(received=False, page=page, size=size)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({'error': str(e), 'items': []}), 502


@documents_bp.route('/api/irida/status', methods=['GET'])
@jwt_required()
def irida_status():
    """Check if ΙΡΙΔΑ integration is configured and reachable."""
    from ..integrations.irida_client import is_configured
    return jsonify({
        'configured': is_configured(),
    }), 200
