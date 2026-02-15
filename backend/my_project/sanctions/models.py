from datetime import datetime
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
            'escalation_2nd': self.escalation_2nd,
            'escalation_3rd_plus': self.escalation_3rd_plus,
            'can_trigger_suspension': self.can_trigger_suspension,
            'suspension_threshold': self.suspension_threshold,
            'legal_reference': self.legal_reference,
            'structure_type_id': self.structure_type_id,
            'is_active': self.is_active,
        }
