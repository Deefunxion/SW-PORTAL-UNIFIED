from datetime import datetime, date, timedelta
from ..extensions import db


class SanctionRule(db.Model):
    __tablename__ = 'sanction_rules'
    id = db.Column(db.Integer, primary_key=True)
    violation_code = db.Column(db.String(50), unique=True, nullable=False)
    violation_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    base_fine = db.Column(db.Float, nullable=False)
    escalation_2nd = db.Column(db.Float, default=2.0)  # multiplier for 2nd offense
    escalation_3rd_plus = db.Column(db.Float, default=3.0)  # multiplier for 3rd+ offense
    can_trigger_suspension = db.Column(db.Boolean, default=False)
    suspension_threshold = db.Column(db.Integer, default=3)  # offenses before suspension
    legal_reference = db.Column(db.Text, nullable=True)
    structure_type_id = db.Column(db.Integer, db.ForeignKey('structure_types.id'), nullable=True)
    min_fine = db.Column(db.Float, nullable=True)
    max_fine = db.Column(db.Float, nullable=True)
    category = db.Column(db.String(50), default='general')  # safety, hygiene, admin, staff, general
    payment_deadline_days = db.Column(db.Integer, default=60)
    appeal_deadline_days = db.Column(db.Integer, default=15)
    revenue_split_state_pct = db.Column(db.Integer, default=50)
    revenue_split_state_ale = db.Column(db.String(20), default='1560989001')
    revenue_split_region_pct = db.Column(db.Integer, default=50)
    revenue_split_region_kae = db.Column(db.String(20), default='64008')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    structure_type = db.relationship('StructureType', backref='sanction_rules')

    def to_dict(self):
        return {
            'id': self.id,
            'violation_code': self.violation_code,
            'violation_name': self.violation_name,
            'description': self.description,
            'base_fine': self.base_fine,
            'min_fine': self.min_fine,
            'max_fine': self.max_fine,
            'category': self.category,
            'escalation_2nd': self.escalation_2nd,
            'escalation_3rd_plus': self.escalation_3rd_plus,
            'can_trigger_suspension': self.can_trigger_suspension,
            'suspension_threshold': self.suspension_threshold,
            'legal_reference': self.legal_reference,
            'structure_type_id': self.structure_type_id,
            'is_active': self.is_active,
            'payment_deadline_days': self.payment_deadline_days,
            'appeal_deadline_days': self.appeal_deadline_days,
            'revenue_split': {
                'state_pct': self.revenue_split_state_pct,
                'state_ale': self.revenue_split_state_ale,
                'region_pct': self.revenue_split_region_pct,
                'region_kae': self.revenue_split_region_kae,
            },
        }


class SanctionDecision(db.Model):
    __tablename__ = 'sanction_decisions'

    id = db.Column(db.Integer, primary_key=True)
    sanction_id = db.Column(db.Integer, db.ForeignKey('sanctions.id'), nullable=False)

    # Workflow status: draft → submitted → approved/returned → exported → notified → paid/appealed/overdue/cancelled
    status = db.Column(db.String(30), default='draft')

    # Draft phase
    drafted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    drafted_at = db.Column(db.DateTime, default=datetime.utcnow)
    violation_code = db.Column(db.String(50))
    inspection_finding = db.Column(db.Text)
    calculated_amount = db.Column(db.Float)
    final_amount = db.Column(db.Float)
    justification = db.Column(db.Text)

    # Approval phase
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    return_comments = db.Column(db.Text, nullable=True)
    protocol_number = db.Column(db.String(50), nullable=True)
    ada_code = db.Column(db.String(30), nullable=True)

    # Notification phase
    notified_at = db.Column(db.DateTime, nullable=True)
    notification_method = db.Column(db.String(50), nullable=True)

    # Payment tracking
    payment_deadline = db.Column(db.Date, nullable=True)
    appeal_deadline = db.Column(db.Date, nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    paid_amount = db.Column(db.Float, nullable=True)

    # Revenue split
    amount_state = db.Column(db.Float, nullable=True)
    amount_region = db.Column(db.Float, nullable=True)

    # PDF
    pdf_path = db.Column(db.String(500), nullable=True)

    # Obligor details (snapshot at decision time)
    obligor_name = db.Column(db.String(200))
    obligor_father_name = db.Column(db.String(100))
    obligor_afm = db.Column(db.String(20))
    obligor_doy = db.Column(db.String(100))
    obligor_address = db.Column(db.String(300))

    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sanction = db.relationship('Sanction', backref=db.backref('decision', uselist=False))
    drafter = db.relationship('User', foreign_keys=[drafted_by])
    approver = db.relationship('User', foreign_keys=[approved_by])

    def to_dict(self):
        return {
            'id': self.id,
            'sanction_id': self.sanction_id,
            'status': self.status,
            'drafted_by': self.drafted_by,
            'drafted_at': self.drafted_at.isoformat() if self.drafted_at else None,
            'drafter_name': self.drafter.full_name if self.drafter and hasattr(self.drafter, 'full_name') else None,
            'violation_code': self.violation_code,
            'inspection_finding': self.inspection_finding,
            'calculated_amount': self.calculated_amount,
            'final_amount': self.final_amount,
            'justification': self.justification,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'approver_name': self.approver.full_name if self.approver and hasattr(self.approver, 'full_name') else None,
            'return_comments': self.return_comments,
            'protocol_number': self.protocol_number,
            'ada_code': self.ada_code,
            'notified_at': self.notified_at.isoformat() if self.notified_at else None,
            'notification_method': self.notification_method,
            'payment_deadline': self.payment_deadline.isoformat() if self.payment_deadline else None,
            'appeal_deadline': self.appeal_deadline.isoformat() if self.appeal_deadline else None,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'paid_amount': self.paid_amount,
            'amount_state': self.amount_state,
            'amount_region': self.amount_region,
            'pdf_path': self.pdf_path,
            'obligor_name': self.obligor_name,
            'obligor_father_name': self.obligor_father_name,
            'obligor_afm': self.obligor_afm,
            'obligor_doy': self.obligor_doy,
            'obligor_address': self.obligor_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
