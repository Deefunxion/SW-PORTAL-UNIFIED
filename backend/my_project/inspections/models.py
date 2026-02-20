from datetime import datetime
from ..extensions import db


class InspectionCommittee(db.Model):
    __tablename__ = 'inspection_committees'
    id = db.Column(db.Integer, primary_key=True)
    decision_number = db.Column(db.String(100), nullable=False)
    appointed_date = db.Column(db.Date, nullable=False)
    expiry_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(50), default='active')
    structure_type_id = db.Column(db.Integer, db.ForeignKey('structure_types.id'), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    members = db.relationship('CommitteeMembership', backref='committee',
                              lazy=True, cascade='all, delete-orphan')
    structure_assignments = db.relationship('CommitteeStructureAssignment',
                                            backref='committee', lazy=True,
                                            cascade='all, delete-orphan')
    inspections = db.relationship('Inspection', backref='committee', lazy=True)
    structure_type = db.relationship('StructureType', backref='committees')

    def to_dict(self, include_members=False, include_structures=False):
        d = {
            'id': self.id, 'decision_number': self.decision_number,
            'appointed_date': self.appointed_date.isoformat() if self.appointed_date else None,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'status': self.status, 'notes': self.notes,
            'structure_type_id': self.structure_type_id,
            'structure_type_name': self.structure_type.name if self.structure_type else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
        if include_members:
            d['members'] = [m.to_dict() for m in self.members]
        if include_structures:
            d['structures'] = [a.to_dict() for a in self.structure_assignments]
        return d


class CommitteeMembership(db.Model):
    __tablename__ = 'committee_memberships'
    id = db.Column(db.Integer, primary_key=True)
    committee_id = db.Column(db.Integer, db.ForeignKey('inspection_committees.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False)  # president, member, secretary
    __table_args__ = (db.UniqueConstraint('committee_id', 'user_id'),)

    user = db.relationship('User', backref='committee_memberships')

    def to_dict(self):
        return {
            'id': self.id, 'committee_id': self.committee_id,
            'user_id': self.user_id, 'role': self.role,
            'user': self.user.to_dict() if self.user else None,
        }


class CommitteeStructureAssignment(db.Model):
    __tablename__ = 'committee_structure_assignments'
    id = db.Column(db.Integer, primary_key=True)
    committee_id = db.Column(db.Integer, db.ForeignKey('inspection_committees.id'), nullable=False)
    structure_id = db.Column(db.Integer, db.ForeignKey('structures.id'), nullable=False)
    assigned_date = db.Column(db.Date, nullable=False)
    __table_args__ = (db.UniqueConstraint('committee_id', 'structure_id'),)

    structure = db.relationship('Structure', backref='committee_assignments')

    def to_dict(self):
        return {
            'id': self.id, 'committee_id': self.committee_id,
            'structure_id': self.structure_id,
            'assigned_date': self.assigned_date.isoformat() if self.assigned_date else None,
            'structure': self.structure.to_dict() if self.structure else None,
        }


class Inspection(db.Model):
    __tablename__ = 'inspections'
    id = db.Column(db.Integer, primary_key=True)
    structure_id = db.Column(db.Integer, db.ForeignKey('structures.id'), nullable=False)
    committee_id = db.Column(db.Integer, db.ForeignKey('inspection_committees.id'), nullable=True)
    inspector_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    type = db.Column(db.String(50), nullable=False)
    scheduled_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(50), default='scheduled')
    conclusion = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    structure = db.relationship('Structure', backref='inspections')
    inspector = db.relationship('User', backref='inspections_as_inspector',
                                foreign_keys=[inspector_id])
    report = db.relationship('InspectionReport', backref='inspection', uselist=False)

    def to_dict(self):
        d = {
            'id': self.id, 'structure_id': self.structure_id,
            'committee_id': self.committee_id,
            'inspector_id': self.inspector_id,
            'type': self.type,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'status': self.status, 'conclusion': self.conclusion,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'structure': {'id': self.structure.id, 'name': self.structure.name} if self.structure else None,
        }
        d['inspector'] = self.inspector.to_dict() if self.inspector else None
        return d


class ChecklistTemplate(db.Model):
    __tablename__ = 'checklist_templates'
    id = db.Column(db.Integer, primary_key=True)
    structure_type_id = db.Column(db.Integer, db.ForeignKey('structure_types.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    version = db.Column(db.Integer, default=1)
    items = db.Column(db.JSON, nullable=False)  # list of check item category objects
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    structure_type = db.relationship('StructureType', backref='checklist_templates')

    def to_dict(self):
        return {
            'id': self.id,
            'structure_type_id': self.structure_type_id,
            'name': self.name,
            'version': self.version,
            'items': self.items,
            'is_active': self.is_active,
            'structure_type': self.structure_type.to_dict() if self.structure_type else None,
        }


class InspectionReport(db.Model):
    __tablename__ = 'inspection_reports'
    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(db.Integer, db.ForeignKey('inspections.id'), nullable=False, unique=True)
    protocol_number = db.Column(db.String(100))
    drafted_date = db.Column(db.Date)
    findings = db.Column(db.Text)
    recommendations = db.Column(db.Text, nullable=True)
    checklist_data = db.Column(db.JSON, nullable=True)  # structured inspection criteria
    file_path = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(50), default='draft')
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    submitted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    submitter = db.relationship('User', backref='submitted_reports')

    def to_dict(self):
        return {
            'id': self.id, 'inspection_id': self.inspection_id,
            'protocol_number': self.protocol_number,
            'drafted_date': self.drafted_date.isoformat() if self.drafted_date else None,
            'findings': self.findings, 'recommendations': self.recommendations,
            'checklist_data': self.checklist_data,
            'file_path': self.file_path, 'status': self.status,
            'submitted_by': self.submitted_by,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
