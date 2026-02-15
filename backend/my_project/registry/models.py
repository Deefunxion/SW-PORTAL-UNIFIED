from datetime import datetime, date
from ..extensions import db


class StructureType(db.Model):
    __tablename__ = 'structure_types'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    active = db.Column(db.Boolean, default=True)
    structures = db.relationship('Structure', backref='structure_type', lazy=True)

    def to_dict(self):
        return {
            'id': self.id, 'code': self.code, 'name': self.name,
            'description': self.description, 'active': self.active
        }


class Structure(db.Model):
    __tablename__ = 'structures'
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    type_id = db.Column(db.Integer, db.ForeignKey('structure_types.id'), nullable=False)
    name = db.Column(db.String(300), nullable=False)

    # Address
    street = db.Column(db.String(200))
    city = db.Column(db.String(100))
    postal_code = db.Column(db.String(10))

    # Legal representative
    representative_name = db.Column(db.String(200))
    representative_afm = db.Column(db.String(9))
    representative_phone = db.Column(db.String(20))
    representative_email = db.Column(db.String(120))

    capacity = db.Column(db.Integer)
    status = db.Column(db.String(50), default='active')
    ownership = db.Column(db.String(50))

    license_number = db.Column(db.String(100))
    license_date = db.Column(db.Date, nullable=True)
    license_expiry = db.Column(db.Date, nullable=True)

    advisor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    peripheral_unit = db.Column(db.String(100), nullable=True)
    notes = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    advisor = db.relationship('User', foreign_keys=[advisor_id], backref='advised_structures')
    licenses = db.relationship('License', backref='structure', lazy=True, cascade='all, delete-orphan')
    sanctions = db.relationship('Sanction', backref='structure', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'code': self.code, 'name': self.name,
            'type_id': self.type_id,
            'type': self.structure_type.to_dict() if self.structure_type else None,
            'street': self.street, 'city': self.city, 'postal_code': self.postal_code,
            'representative_name': self.representative_name,
            'representative_afm': self.representative_afm,
            'representative_phone': self.representative_phone,
            'representative_email': self.representative_email,
            'capacity': self.capacity, 'status': self.status, 'ownership': self.ownership,
            'license_number': self.license_number,
            'license_date': self.license_date.isoformat() if self.license_date else None,
            'license_expiry': self.license_expiry.isoformat() if self.license_expiry else None,
            'advisor_id': self.advisor_id,
            'advisor': self.advisor.to_dict() if self.advisor else None,
            'peripheral_unit': self.peripheral_unit,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class License(db.Model):
    __tablename__ = 'licenses'
    id = db.Column(db.Integer, primary_key=True)
    structure_id = db.Column(db.Integer, db.ForeignKey('structures.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    protocol_number = db.Column(db.String(100))
    issued_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    status = db.Column(db.String(50), default='active')
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'structure_id': self.structure_id,
            'type': self.type, 'protocol_number': self.protocol_number,
            'issued_date': self.issued_date.isoformat() if self.issued_date else None,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'status': self.status, 'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Sanction(db.Model):
    __tablename__ = 'sanctions'
    id = db.Column(db.Integer, primary_key=True)
    structure_id = db.Column(db.Integer, db.ForeignKey('structures.id'), nullable=False)
    inspection_id = db.Column(db.Integer, db.ForeignKey('inspections.id'), nullable=True)
    type = db.Column(db.String(50), nullable=False)
    amount = db.Column(db.Float, nullable=True)
    imposed_date = db.Column(db.Date)
    status = db.Column(db.String(50), default='imposed')
    protocol_number = db.Column(db.String(100))
    notes = db.Column(db.Text, nullable=True)
    violation_code = db.Column(db.String(50), nullable=True)
    calculated_amount = db.Column(db.Float, nullable=True)
    final_amount = db.Column(db.Float, nullable=True)
    inspection_finding = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'structure_id': self.structure_id,
            'inspection_id': self.inspection_id,
            'type': self.type, 'amount': self.amount,
            'imposed_date': self.imposed_date.isoformat() if self.imposed_date else None,
            'status': self.status, 'protocol_number': self.protocol_number,
            'notes': self.notes,
            'violation_code': self.violation_code,
            'calculated_amount': self.calculated_amount,
            'final_amount': self.final_amount,
            'inspection_finding': self.inspection_finding,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
