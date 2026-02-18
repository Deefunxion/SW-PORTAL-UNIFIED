# Document Composition Engine & ΙΡΙΔΑ Integration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a template-based document composition system within the Πύλη that allows users to draft all types of administrative decisions (licenses, inspections, sanctions, transmittals, committee formations), view them in a unified Document Registry, and send/receive them via the ΙΡΙΔΑ government document management API.

**Architecture:** New `documents` module with DecisionTemplate + DecisionRecord models. Templates store DOCX-like body content with `{{placeholder}}` syntax. Data auto-fills from existing Structure/License/Inspection models. ΙΡΙΔΑ integration upgrades the existing Level 2 ZIP export to Level 3 direct API (OAuth2 → send document → receive protocol number). A new "Μητρώο Εγγράφων" page provides a unified filtered table across all document types.

**Tech Stack:** Flask + SQLAlchemy (backend models/API), ReportLab + python-docx (PDF/DOCX generation), React + shadcn/ui (frontend pages), requests (ΙΡΙΔΑ API client), existing JWT auth + RBAC.

---

## Existing Codebase Reference

### Backend Models (already exist)
- `backend/my_project/registry/models.py` — Structure, StructureType, License, Sanction
- `backend/my_project/inspections/models.py` — Inspection, InspectionReport, InspectionCommittee, CommitteeMembership, ChecklistTemplate
- `backend/my_project/oversight/models.py` — UserRole, SocialAdvisorReport
- `backend/my_project/sanctions/models.py` — SanctionRule, SanctionDecision

### Existing Report/Export Code (to extend)
- `backend/my_project/oversight/reports.py` — PDF/XLSX report generation (ReportLab + openpyxl)
- `backend/my_project/sanctions/pdf_generator.py` — Formal sanction decision PDFs
- `backend/my_project/integrations/irida_export.py` — Level 2 ΙΡΙΔΑ ZIP export (metadata + document)

### Frontend Pages (already exist)
- `frontend/src/App.jsx` — Routes (line 382-521), nav items
- `frontend/src/pages/ForumPage.jsx` — Forum with bug (discussions don't load on first visit)
- `frontend/src/features/registry/pages/` — RegistryListPage, StructureDetailPage, SanctionsPage, etc.

### API Patterns (follow these)
- Blueprint registration in `backend/my_project/__init__.py` (line 96-113)
- Route patterns: `@blueprint.route('/api/...', methods=['GET'])`, `@jwt_required()`, `int(get_jwt_identity())`
- Response pattern: `return jsonify({...}), 200`

---

## Phase 0: Bug Fix — Forum Page

### Task 0.1: Fix ForumPage discussions not loading on first visit

**Root cause:** `isLoading` is set to `false` when `fetchCategories()` completes (line 123 of ForumPage.jsx), but `fetchDiscussions()` may not have completed yet. The page renders with empty discussions.

**Files:**
- Modify: `frontend/src/pages/ForumPage.jsx:102-129`

**Step 1: Fix the loading state to track both fetches**

Replace lines 102-129 with:

```jsx
const [isLoading, setIsLoading] = useState(true);
const [discussionsLoaded, setDiscussionsLoaded] = useState(false);
const [categoriesLoaded, setCategoriesLoaded] = useState(false);

useEffect(() => {
  fetchDiscussions();
  fetchCategories();
}, []);

useEffect(() => {
  if (discussionsLoaded && categoriesLoaded) {
    setIsLoading(false);
  }
}, [discussionsLoaded, categoriesLoaded]);

const fetchDiscussions = async () => {
  try {
    const { data } = await api.get('/api/discussions');
    setDiscussions(data);
  } catch (error) {
    console.error('Error fetching discussions:', error);
    setDiscussions([]);
  } finally {
    setDiscussionsLoaded(true);
  }
};

const fetchCategories = async () => {
  try {
    const { data } = await api.get('/api/categories');
    setCategories(data);
  } catch (error) {
    console.error('Error fetching categories:', error);
    setCategories([]);
  } finally {
    setCategoriesLoaded(true);
  }
};
```

**Step 2: Verify fix**

Run the frontend dev server. Navigate to another page, then click "Φόρουμ" in the nav. Discussions should appear without requiring a page refresh.

**Step 3: Commit**

```bash
git add frontend/src/pages/ForumPage.jsx
git commit -m "fix: forum discussions not loading on first visit

Track loading state for both discussions and categories fetches
independently. Only hide loading spinner when both complete."
```

---

## Phase 1: Document Composition Engine — Backend

### Task 1.1: Create the `documents` module with models

**Files:**
- Create: `backend/my_project/documents/__init__.py`
- Create: `backend/my_project/documents/models.py`

**Step 1: Create module init**

```python
# backend/my_project/documents/__init__.py
from flask import Blueprint

documents_bp = Blueprint('documents', __name__)

from . import routes  # noqa: E402, F401
```

**Step 2: Create models**

```python
# backend/my_project/documents/models.py
from datetime import datetime, date
from ..extensions import db


class DecisionTemplate(db.Model):
    """Template for generating administrative decisions/documents."""
    __tablename__ = 'decision_templates'

    id = db.Column(db.Integer, primary_key=True)
    type = db.Column(db.String(50), nullable=False, index=True)
    # Types: camp_license, mfh_license, kdap_license, syd_license,
    #        kdhf_license, mfpad_license, sanction_fine,
    #        sanction_suspension, committee_formation, transmittal,
    #        advisor_report, inspection_report
    title = db.Column(db.String(300), nullable=False)
    description = db.Column(db.Text)
    body_template = db.Column(db.Text, nullable=False)
    # body_template contains HTML with {{placeholder}} syntax
    legal_references = db.Column(db.JSON, default=list)
    # JSON array of legal reference strings
    schema = db.Column(db.JSON, nullable=False, default=dict)
    # JSON schema: {"fields": [{"key": "...", "label": "...",
    #   "type": "text|date|number|select", "required": true, "options": [...]}]}
    recipients_template = db.Column(db.JSON, default=list)
    # JSON array: [{"name": "...", "address": "..."}]
    structure_type_code = db.Column(db.String(20))
    # Optional: restrict template to specific structure types
    is_active = db.Column(db.Boolean, default=True)
    version = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)

    decisions = db.relationship('DecisionRecord', backref='template',
                                lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'title': self.title,
            'description': self.description,
            'body_template': self.body_template,
            'legal_references': self.legal_references or [],
            'schema': self.schema or {},
            'recipients_template': self.recipients_template or [],
            'structure_type_code': self.structure_type_code,
            'is_active': self.is_active,
            'version': self.version,
        }


class DecisionRecord(db.Model):
    """A composed document/decision instance."""
    __tablename__ = 'decision_records'

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer,
                            db.ForeignKey('decision_templates.id'),
                            nullable=False)
    structure_id = db.Column(db.Integer,
                             db.ForeignKey('structures.id'))
    # Filled form data — JSON matching template schema
    data = db.Column(db.JSON, nullable=False, default=dict)
    # Rendered body (HTML with placeholders filled)
    rendered_body = db.Column(db.Text)

    # Workflow status
    status = db.Column(db.String(30), default='draft', index=True)
    # draft → sent_to_irida → protocol_received
    protocol_number = db.Column(db.String(50))
    ada_code = db.Column(db.String(50))

    # Generated files
    pdf_path = db.Column(db.String(300))
    docx_path = db.Column(db.String(300))

    # Tracking
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow)
    sent_to_irida_at = db.Column(db.DateTime)
    protocol_received_at = db.Column(db.DateTime)

    # Relationships
    structure = db.relationship('Structure', backref='decision_records')
    author = db.relationship('User', backref='authored_decisions',
                             foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id': self.id,
            'template_id': self.template_id,
            'template_type': self.template.type if self.template else None,
            'template_title': self.template.title if self.template else None,
            'structure_id': self.structure_id,
            'structure_name': (self.structure.name
                               if self.structure else None),
            'data': self.data or {},
            'status': self.status,
            'protocol_number': self.protocol_number,
            'ada_code': self.ada_code,
            'pdf_path': self.pdf_path,
            'docx_path': self.docx_path,
            'created_by': self.created_by,
            'author_name': (self.author.username
                            if self.author else None),
            'created_at': (self.created_at.isoformat()
                           if self.created_at else None),
            'updated_at': (self.updated_at.isoformat()
                           if self.updated_at else None),
            'sent_to_irida_at': (self.sent_to_irida_at.isoformat()
                                 if self.sent_to_irida_at else None),
            'protocol_received_at': (
                self.protocol_received_at.isoformat()
                if self.protocol_received_at else None),
        }


class AuditLog(db.Model):
    """Audit trail for document actions."""
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'),
                        nullable=False)
    action = db.Column(db.String(50), nullable=False)
    # Actions: create_draft, update_draft, generate_pdf,
    #          send_to_irida, receive_protocol, delete
    entity_type = db.Column(db.String(50), nullable=False)
    entity_id = db.Column(db.Integer, nullable=False)
    details = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='audit_logs')

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else None,
            'action': self.action,
            'entity_type': self.entity_type,
            'entity_id': self.entity_id,
            'details': self.details,
            'created_at': (self.created_at.isoformat()
                           if self.created_at else None),
        }
```

**Step 3: Register blueprint in create_app()**

In `backend/my_project/__init__.py`, add to the blueprint registration section (around line 96-113):

```python
from .documents import documents_bp
app.register_blueprint(documents_bp)
```

**Step 4: Commit**

```bash
git add backend/my_project/documents/
git commit -m "feat: add documents module with DecisionTemplate, DecisionRecord, AuditLog models"
```

---

### Task 1.2: Create document generation engine

**Files:**
- Create: `backend/my_project/documents/generator.py`

This module renders templates by filling placeholders with data from Structure + user-provided fields.

```python
# backend/my_project/documents/generator.py
import re
import io
from datetime import date, datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                Table, TableStyle)
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT


def resolve_placeholders(template_body, structure, user_data):
    """
    Replace {{placeholder}} in template body with actual values.

    Args:
        template_body: HTML string with {{key}} placeholders
        structure: Structure model instance (or None)
        user_data: dict of user-provided field values

    Returns:
        Rendered HTML string
    """
    # Build context from structure
    ctx = {}
    if structure:
        ctx.update({
            'όνομα_δομής': structure.name,
            'κωδικός_δομής': structure.code or '',
            'πόλη': structure.city or '',
            'οδός': structure.street or '',
            'ΤΚ': structure.postal_code or '',
            'εκπρόσωπος': structure.representative_name or '',
            'ΑΦΜ_εκπροσώπου': structure.representative_afm or '',
            'τηλέφωνο_εκπροσώπου': structure.representative_phone or '',
            'email_εκπροσώπου': structure.representative_email or '',
            'δυναμικότητα': str(structure.capacity or ''),
            'κατάσταση': structure.status or '',
            'ιδιοκτησία': structure.ownership or '',
            'αριθμός_αδείας': structure.license_number or '',
        })
        if structure.license_date:
            ctx['ημερομηνία_αδείας'] = structure.license_date.isoformat()
        if structure.license_expiry:
            ctx['λήξη_αδείας'] = structure.license_expiry.isoformat()
        if hasattr(structure, 'structure_type') and structure.structure_type:
            ctx['τύπος_δομής'] = structure.structure_type.name

    # Overlay user-provided data (takes precedence)
    ctx.update(user_data)

    # Format dates nicely
    for key, val in ctx.items():
        if isinstance(val, (date, datetime)):
            ctx[key] = val.strftime('%d/%m/%Y')

    # Replace placeholders
    def replacer(match):
        key = match.group(1).strip()
        return str(ctx.get(key, f'[{key}]'))

    rendered = re.sub(r'\{\{(.+?)\}\}', replacer, template_body)
    return rendered


def generate_decision_pdf(rendered_html, title, recipients=None):
    """
    Generate a PDF from rendered HTML decision text.

    Args:
        rendered_html: HTML string (rendered template)
        title: Document title for header
        recipients: list of recipient dicts

    Returns:
        PDF bytes
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2.5*cm, rightMargin=2.5*cm)

    # Try to register Greek-capable font
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        import os
        font_paths = [
            'C:/Windows/Fonts/arial.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        ]
        for fp in font_paths:
            if os.path.exists(fp):
                pdfmetrics.registerFont(TTFont('Greek', fp))
                break
        font_name = 'Greek'
    except Exception:
        font_name = 'Helvetica'

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        'GreekTitle', parent=styles['Title'],
        fontName=font_name, fontSize=14, alignment=TA_CENTER,
        spaceAfter=12))
    styles.add(ParagraphStyle(
        'GreekBody', parent=styles['Normal'],
        fontName=font_name, fontSize=11, alignment=TA_JUSTIFY,
        leading=16, spaceAfter=8))
    styles.add(ParagraphStyle(
        'GreekSmall', parent=styles['Normal'],
        fontName=font_name, fontSize=9, alignment=TA_JUSTIFY,
        leading=12, spaceAfter=4))

    story = []

    # Title
    story.append(Paragraph(title, styles['GreekTitle']))
    story.append(Spacer(1, 0.5*cm))

    # Body — split by paragraphs (HTML <p> or newlines)
    # Simple approach: split on double newlines or <p> tags
    import html
    clean = re.sub(r'<br\s*/?>', '\n', rendered_html)
    clean = re.sub(r'<p>', '', clean)
    clean = re.sub(r'</p>', '\n\n', clean)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = html.unescape(clean)

    for para_text in clean.split('\n\n'):
        text = para_text.strip()
        if text:
            story.append(Paragraph(text, styles['GreekBody']))

    # Recipients table
    if recipients:
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph('ΠΙΝΑΚΑΣ ΑΠΟΔΕΚΤΩΝ', styles['GreekTitle']))
        for i, r in enumerate(recipients, 1):
            name = r.get('name', '')
            story.append(
                Paragraph(f'{i}. {name}', styles['GreekSmall']))

    doc.build(story)
    buf.seek(0)
    return buf.read()
```

**Step 2: Commit**

```bash
git add backend/my_project/documents/generator.py
git commit -m "feat: add document template rendering engine with placeholder resolution and PDF generation"
```

---

### Task 1.3: Create document API routes

**Files:**
- Create: `backend/my_project/documents/routes.py`

```python
# backend/my_project/documents/routes.py
import os
from datetime import datetime
from flask import jsonify, request, current_app, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import documents_bp
from ..extensions import db
from .models import DecisionTemplate, DecisionRecord, AuditLog
from .generator import resolve_placeholders, generate_decision_pdf


def _audit(user_id, action, entity_type, entity_id, details=None):
    log = AuditLog(user_id=user_id, action=action,
                   entity_type=entity_type, entity_id=entity_id,
                   details=details)
    db.session.add(log)


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
    structure = Structure.query.get(record.structure_id) if record.structure_id else None

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


# --- Document Registry (unified view) ---

@documents_bp.route('/api/document-registry', methods=['GET'])
@jwt_required()
def document_registry():
    """Unified view of all documents across all types."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    doc_type = request.args.get('type')  # filter by document type
    status = request.args.get('status')
    structure_id = request.args.get('structure_id', type=int)
    search = request.args.get('search')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    documents = []

    # 1. DecisionRecords (templates)
    if not doc_type or doc_type in ('license', 'sanction_decision',
                                     'committee', 'transmittal',
                                     'all'):
        for rec in DecisionRecord.query.all():
            documents.append({
                'id': rec.id,
                'source': 'decision_record',
                'type': rec.template.type if rec.template else 'unknown',
                'type_label': rec.template.title if rec.template else '',
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
    if not doc_type or doc_type in ('inspection_report', 'all'):
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
    if not doc_type or doc_type in ('advisor_report', 'all'):
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
    if not doc_type or doc_type in ('sanction_decision', 'all'):
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
    """View audit log (admin only)."""
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    logs = AuditLog.query.order_by(
        AuditLog.created_at.desc()).limit(100).all()
    return jsonify([l.to_dict() for l in logs]), 200
```

**Step 2: Commit**

```bash
git add backend/my_project/documents/routes.py
git commit -m "feat: add document API routes — templates, decisions, registry, audit log"
```

---

### Task 1.4: Seed camp license template

**Files:**
- Modify: `backend/my_project/seed_demo.py`

Add at the end of `seed_demo()`, before the final commit, a section that seeds the camp license template based on the real ΑΠΟΦΑΣΗ_ΚΑΤΑΣΚΗΝΩΣΗΣ_TEMPLATE.docx that exists in the project root.

The template body should contain the actual legal text from the DOCX with `{{placeholder}}` syntax. The schema should define all variable fields from the Excel.

**Template body:** Use the actual text from the camp license decision template (paragraphs 0-46 from the DOCX), replacing variable parts with `{{key}}` placeholders.

**Schema fields** (from the Excel columns):
- `έτος` (number, required)
- `τίτλος_κατασκήνωσης` (text, required)
- `επωνυμία_εταιρείας` (text, required)
- `τοποθεσία` (text, required)
- `ημερομηνία_έναρξης` (date, required)
- `ημερομηνία_λήξης` (date, required)
- `αριθμός_περιόδων` (number, required)
- `δυναμικότητα` (number, required)
- `περιγραφή_ηλικιών_και_διαχωρισμού` (text, required)
- `εκτός_περιόδου` (text)
- `τοπικό_ΑΤ` (text)
- `αριθμός_αίτησης` (text)
- `ημερομηνία_αίτησης` (date)
- `ημερομηνία_πρακτικού` (date)
- `αριθμός_πυρασφάλειας` (text)
- `λήξη_πυρασφάλειας` (date)
- `όνομα_υπαλλήλου` (text)
- `τηλέφωνο` (text)
- `email` (text)
- `ονοματεπώνυμο_αντιπεριφερειάρχη` (text)

**Step 1: Add template seeding to seed_demo.py**

Add import and seeding code at the appropriate location in `seed_demo()`.

**Step 2: Commit**

```bash
git add backend/my_project/seed_demo.py
git commit -m "feat: seed camp license decision template with real legal text and schema"
```

---

## Phase 2: Frontend — Document Registry Page

### Task 2.1: Create DocumentRegistryPage

**Files:**
- Create: `frontend/src/pages/DocumentRegistryPage.jsx`

A page with:
- Filter bar: document type dropdown, status dropdown, structure dropdown, date range, search input
- Data table with columns: Α/Α, Τύπος, Αρ. Πρωτ., Δομή, Ημ/νία, Κατάσταση, Ενέργειες
- Pagination
- Status badges with colors (draft=gray, sent_to_irida=blue, protocol_received=green)
- Actions: Προβολή, PDF, Επεξεργασία (for drafts only)

Use shadcn/ui components: Card, Table, Badge, Button, Input, Select.
Follow the existing UI pattern from `RegistryListPage`.

**Step 1: Create the page component**

**Step 2: Add route in App.jsx**

Add to App.jsx routes section:
```jsx
import DocumentRegistryPage from '@/pages/DocumentRegistryPage';
// ...
<Route path="/documents" element={<ProtectedRoute><DocumentRegistryPage /></ProtectedRoute>} />
```

**Step 3: Add nav item in App.jsx**

In the `navItems` array (line 64-70), add:
```jsx
{ path: '/documents', label: 'Έγγραφα', icon: FileText },
```

**Step 4: Commit**

```bash
git add frontend/src/pages/DocumentRegistryPage.jsx frontend/src/App.jsx
git commit -m "feat: add Document Registry page with unified table view and filters"
```

---

### Task 2.2: Create DocumentComposePage (wizard)

**Files:**
- Create: `frontend/src/pages/DocumentComposePage.jsx`

A multi-step wizard:
1. Step 1: Template selection (card grid)
2. Step 2: Structure selection (dropdown, auto-fills known fields)
3. Step 3: Variable fields form (dynamically generated from template schema)
4. Step 4: Live preview (rendered HTML)
5. Actions: Save Draft, Export PDF, Send to ΙΡΙΔΑ (Phase 3)

**Step 1: Create the page component**

Use existing UI patterns. The form fields are generated dynamically from the template's `schema.fields` array.

**Step 2: Add route in App.jsx**

```jsx
import DocumentComposePage from '@/pages/DocumentComposePage';
// ...
<Route path="/documents/new" element={<ProtectedRoute><DocumentComposePage /></ProtectedRoute>} />
<Route path="/documents/:id/edit" element={<ProtectedRoute><DocumentComposePage /></ProtectedRoute>} />
```

**Step 3: Commit**

```bash
git add frontend/src/pages/DocumentComposePage.jsx frontend/src/App.jsx
git commit -m "feat: add Document Compose page with template wizard and live preview"
```

---

## Phase 3: ΙΡΙΔΑ API Integration

### Task 3.1: Create ΙΡΙΔΑ API client

**Files:**
- Create: `backend/my_project/integrations/irida_client.py`

Upgrade from Level 2 (ZIP export) to Level 3 (direct API):

```python
# backend/my_project/integrations/irida_client.py
"""
ΙΡΙΔΑ API Client — Level 3 Direct Integration.

Authentication: OAuth 2.0 password grant
Base URL: https://iridacloud.gov.gr
Token endpoint: /auth/connect/token
API base: /iris/api/v2/external

Environment variables:
  IRIDA_BASE_URL, IRIDA_CLIENT_ID, IRIDA_CLIENT_SECRET,
  IRIDA_USERNAME, IRIDA_PASSWORD
"""
import os
import time
import logging
import requests
from threading import Lock

logger = logging.getLogger(__name__)

_token_cache = {'token': None, 'expires_at': 0}
_token_lock = Lock()


def _get_config():
    return {
        'base_url': os.environ.get(
            'IRIDA_BASE_URL', 'https://iridacloud.gov.gr'),
        'client_id': os.environ.get(
            'IRIDA_CLIENT_ID', 'iris.client'),
        'client_secret': os.environ.get(
            'IRIDA_CLIENT_SECRET', ''),
        'username': os.environ.get('IRIDA_USERNAME', ''),
        'password': os.environ.get('IRIDA_PASSWORD', ''),
        'x_profile': os.environ.get('IRIDA_X_PROFILE', ''),
        'scope': 'iris_api ddr_api auth_api',
    }


def _authenticate():
    """Get or refresh OAuth2 access token."""
    with _token_lock:
        now = time.time()
        if (_token_cache['token']
                and _token_cache['expires_at'] > now + 60):
            return _token_cache['token']

        cfg = _get_config()
        if not cfg['username'] or not cfg['password']:
            raise RuntimeError(
                'IRIDA_USERNAME and IRIDA_PASSWORD must be set')

        resp = requests.post(
            f"{cfg['base_url']}/auth/connect/token",
            data={
                'client_id': cfg['client_id'],
                'client_secret': cfg['client_secret'],
                'grant_type': 'password',
                'username': cfg['username'],
                'password': cfg['password'],
                'scope': cfg['scope'],
            },
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        _token_cache['token'] = data['access_token']
        _token_cache['expires_at'] = now + data.get('expires_in', 3600)
        logger.info('ΙΡΙΔΑ: Authenticated successfully')
        return _token_cache['token']


def _headers():
    cfg = _get_config()
    token = _authenticate()
    h = {
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
    }
    if cfg['x_profile']:
        h['x-profile'] = cfg['x_profile']
    return h


def send_document(subject, pdf_bytes, filename,
                   recipients=None, folder=None):
    """
    Send a document to ΙΡΙΔΑ for protocol assignment.

    Args:
        subject: Document subject line
        pdf_bytes: PDF file content as bytes
        filename: Filename for the attachment
        recipients: list of ΙΡΙΔΑ recipient IDs (optional)
        folder: ΙΡΙΔΑ folder name (optional)

    Returns:
        dict with protocol_number and irida_id
    """
    cfg = _get_config()
    url = f"{cfg['base_url']}/iris/api/v2/external"

    files = {'file': (filename, pdf_bytes, 'application/pdf')}
    data = {'Subject': subject}
    if recipients:
        data['Recipients'] = ','.join(recipients)
    if folder:
        data['Folder'] = folder

    resp = requests.post(url, headers=_headers(),
                         files=files, data=data, timeout=60)
    resp.raise_for_status()

    result = resp.json()
    logger.info(f'ΙΡΙΔΑ: Document sent — {result}')
    return result


def get_inbox(received=False, page=1, size=20):
    """
    Fetch inbox items from ΙΡΙΔΑ.

    Args:
        received: if False, get pending (not yet received) items
        page: page number
        size: items per page

    Returns:
        list of inbox items
    """
    cfg = _get_config()
    url = (f"{cfg['base_url']}/iris/api/v2/external"
           f"/inbox/{str(received).lower()}")

    resp = requests.post(url, headers=_headers(), json={
        'pagination': {'page': page, 'size': size},
    }, timeout=30)
    resp.raise_for_status()
    return resp.json()


def is_configured():
    """Check if ΙΡΙΔΑ credentials are configured."""
    cfg = _get_config()
    return bool(cfg['username'] and cfg['password']
                and cfg['client_secret'])
```

**Step 2: Add env variables to .env.example**

```
# ΙΡΙΔΑ Integration
IRIDA_BASE_URL=https://iridacloud.gov.gr
IRIDA_CLIENT_ID=iris.client
IRIDA_CLIENT_SECRET=
IRIDA_USERNAME=
IRIDA_PASSWORD=
IRIDA_X_PROFILE=
```

**Step 3: Add route for sending to ΙΡΙΔΑ**

In `backend/my_project/documents/routes.py`, add:

```python
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

    # Generate PDF
    recipients = (record.template.recipients_template
                  if record.template else [])
    title = record.template.title if record.template else 'Έγγραφο'
    pdf_bytes = generate_decision_pdf(
        record.rendered_body, title, recipients)

    try:
        result = send_document(
            subject=title,
            pdf_bytes=pdf_bytes,
            filename=f'decision_{record.id}.pdf',
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
```

**Step 4: Commit**

```bash
git add backend/my_project/integrations/irida_client.py
git add backend/my_project/documents/routes.py
git commit -m "feat: add ΙΡΙΔΑ Level 3 API client with OAuth2 auth, send document, and inbox"
```

---

### Task 3.2: Add ΙΡΙΔΑ inbox sync route

**Files:**
- Modify: `backend/my_project/documents/routes.py`

Add endpoint that fetches incoming documents from ΙΡΙΔΑ:

```python
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
```

**Step 2: Commit**

```bash
git add backend/my_project/documents/routes.py
git commit -m "feat: add ΙΡΙΔΑ inbox sync and status check endpoints"
```

---

## Phase 4: Additional Templates & Seed Data

### Task 4.1: Seed templates for all document types

**Files:**
- Modify: `backend/my_project/seed_demo.py`

Add templates for:
- MFH license, KDAP license, SYD license, KDHF license, MFPAD license
- Sanction fine decision, Sanction suspension decision
- Committee formation decision
- Transmittal (Διαβιβαστικό)
- Advisor report template
- Inspection report template

Each template needs: type, title, body_template (with placeholders), schema (field definitions), legal_references, recipients_template, structure_type_code.

### Task 4.2: Seed sample DecisionRecords

Create 3-5 sample decision records using the camp template with data from the ΔΕΔΟΜΕΝΑ_ΑΠΟΦΑΣΕΩΝ.xlsx, in various statuses (draft, sent_to_irida, protocol_received).

---

## Implementation Notes

### Security Requirements
- All document routes require `@jwt_required()`
- AuditLog tracks every action (create, update, generate, send, receive protocol)
- ΙΡΙΔΑ credentials stored in `.env` (server-side only), never sent to frontend
- All ΙΡΙΔΑ API calls happen server-side (backend→ΙΡΙΔΑ), never browser→ΙΡΙΔΑ
- RBAC enforced: only authorized users can compose/send documents

### Future Enhancements (designed for, not built now)
- 2FA authentication
- Digital signatures on PDF documents
- IP whitelisting for ΙΡΙΔΑ API access
- HTTPS/TLS (depends on hosting)
- Bulk document generation (CSV upload → multiple decisions)
- Real-time ΙΡΙΔΑ webhook for protocol number notifications

### Testing Strategy
- Backend: pytest with SQLite in-memory (skip ΙΡΙΔΑ API tests unless env vars set)
- Test DecisionTemplate/DecisionRecord CRUD
- Test placeholder resolution with mock Structure data
- Test PDF generation produces valid bytes
- Frontend: Vitest + Testing Library for page components

### File Structure Summary
```
backend/my_project/documents/
  __init__.py          — Blueprint definition
  models.py            — DecisionTemplate, DecisionRecord, AuditLog
  routes.py            — All API endpoints
  generator.py         — Template rendering + PDF generation

backend/my_project/integrations/
  irida_client.py      — ΙΡΙΔΑ Level 3 API client (NEW)
  irida_export.py      — ΙΡΙΔΑ Level 2 ZIP export (EXISTING, kept as fallback)

frontend/src/pages/
  DocumentRegistryPage.jsx  — Unified document table
  DocumentComposePage.jsx   — Template wizard for composing documents
```
