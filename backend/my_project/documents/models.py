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
    internal_number = db.Column(db.String(20), unique=True, index=True)
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
            'internal_number': self.internal_number,
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


class DocumentAuditLog(db.Model):
    """Audit trail for document composition actions."""
    __tablename__ = 'document_audit_logs'

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

    user = db.relationship('User', backref='document_audit_logs')

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
