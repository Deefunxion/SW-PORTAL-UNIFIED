"""Models for IRIDA integration tracking."""
import json
from datetime import datetime
from ..extensions import db


class IridaTransaction(db.Model):
    __tablename__ = 'irida_transactions'

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Direction & status
    direction = db.Column(db.String(10))     # 'outbound' | 'inbound'
    status = db.Column(db.String(20))        # 'pending' | 'sent' | 'failed'

    # Link to source record (polymorphic)
    source_type = db.Column(db.String(50))   # 'advisor_report', 'sanction_decision', etc.
    source_id = db.Column(db.Integer)

    # IRIDA response
    irida_reg_no = db.Column(db.String(50))
    irida_document_id = db.Column(db.String(100))

    # What was sent
    recipients_json = db.Column(db.Text)
    subject = db.Column(db.String(500))
    sender = db.Column(db.String(200))

    # Who sent it
    sent_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    sent_by = db.relationship('User', backref='irida_transactions')

    # Error handling
    error_message = db.Column(db.Text, nullable=True)

    # Inbound: stored file
    file_path = db.Column(db.String(500), nullable=True)

    def to_dict(self):
        recipients = []
        if self.recipients_json:
            try:
                recipients = json.loads(self.recipients_json)
            except (json.JSONDecodeError, TypeError):
                pass

        return {
            'id': self.id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'direction': self.direction,
            'status': self.status,
            'source_type': self.source_type,
            'source_id': self.source_id,
            'irida_reg_no': self.irida_reg_no,
            'irida_document_id': self.irida_document_id,
            'recipients': recipients,
            'subject': self.subject,
            'sender': self.sender,
            'sent_by_id': self.sent_by_id,
            'error_message': self.error_message,
        }
