from datetime import datetime
from ..extensions import db


class UserRole(db.Model):
    __tablename__ = 'user_roles'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False)
    structure_id = db.Column(db.Integer, db.ForeignKey('structures.id'), nullable=True)
    assigned_at = db.Column(db.DateTime, default=datetime.utcnow)
    assigned_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    user = db.relationship('User', foreign_keys=[user_id], backref='oversight_roles')
    assigner = db.relationship('User', foreign_keys=[assigned_by])
    structure = db.relationship('Structure', backref='role_assignments')

    __table_args__ = (db.UniqueConstraint('user_id', 'role', 'structure_id'),)

    VALID_ROLES = ('social_advisor', 'committee_member', 'administrative', 'director')

    def to_dict(self):
        return {
            'id': self.id, 'user_id': self.user_id, 'role': self.role,
            'structure_id': self.structure_id,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'assigned_by': self.assigned_by,
            'user': self.user.to_dict() if self.user else None,
        }


class SocialAdvisorReport(db.Model):
    __tablename__ = 'social_advisor_reports'
    id = db.Column(db.Integer, primary_key=True)
    structure_id = db.Column(db.Integer, db.ForeignKey('structures.id'), nullable=False)
    inspection_id = db.Column(db.Integer, db.ForeignKey('inspections.id'), nullable=True)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    drafted_date = db.Column(db.Date, nullable=False)
    type = db.Column(db.String(50), nullable=False)
    assessment = db.Column(db.Text)
    recommendations = db.Column(db.Text, nullable=True)
    file_path = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(50), default='draft')
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    structure = db.relationship('Structure', backref='advisor_reports')
    author = db.relationship('User', foreign_keys=[author_id], backref='authored_reports')
    approver = db.relationship('User', foreign_keys=[approved_by])

    def to_dict(self):
        return {
            'id': self.id, 'structure_id': self.structure_id,
            'inspection_id': self.inspection_id,
            'author_id': self.author_id,
            'author': self.author.to_dict() if self.author else None,
            'drafted_date': self.drafted_date.isoformat() if self.drafted_date else None,
            'type': self.type, 'assessment': self.assessment,
            'recommendations': self.recommendations,
            'file_path': self.file_path, 'status': self.status,
            'approved_by': self.approved_by,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
