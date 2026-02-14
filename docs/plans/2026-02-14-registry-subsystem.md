# Registry Subsystem Implementation Plan
# Μητρώο Δομών Κοινωνικής Φροντίδας & Ψηφιακή Εποπτεία

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a fourth subsystem to the SW Portal — a digital registry of social care structures with full inspection, licensing, and oversight workflows.

**Architecture:** Modular monolith. Three new Flask blueprints (`registry_bp`, `inspections_bp`, `oversight_bp`) in separate module directories under `backend/my_project/`. Existing `models.py` and `routes.py` remain untouched. Frontend uses a new `src/features/registry/` feature folder. Dual role system: existing flat `user.role` field stays for system roles; new `UserRole` table handles business roles tied to structures.

**Tech Stack:** Flask 2.3, SQLAlchemy, Flask-JWT-Extended 4.6, PostgreSQL+pgvector, React 18, React Router v7, shadcn/ui, Recharts, TipTap, Tailwind CSS 4, reportlab/openpyxl for reports.

**Requirements Document:** `PKM_Registry_System_Requirements.md`

---

## Phase 1 — Foundations (MVP)

### Task 1: Registry Module Scaffolding

**Files:**
- Create: `backend/my_project/registry/__init__.py`
- Create: `backend/my_project/registry/models.py`
- Create: `backend/my_project/registry/routes.py`
- Create: `backend/my_project/registry/permissions.py`
- Modify: `backend/my_project/__init__.py` (register blueprint + import models + seed)

**Step 1: Create registry module with empty blueprint**

Create `backend/my_project/registry/__init__.py`:
```python
from flask import Blueprint

registry_bp = Blueprint('registry', __name__)

from . import routes  # noqa: E402, F401
```

**Step 2: Create registry models**

Create `backend/my_project/registry/models.py` with `StructureType`, `Structure`, `License`, `Sanction` models. All use `db` from `my_project.extensions`.

```python
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
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'structure_id': self.structure_id,
            'inspection_id': self.inspection_id,
            'type': self.type, 'amount': self.amount,
            'imposed_date': self.imposed_date.isoformat() if self.imposed_date else None,
            'status': self.status, 'protocol_number': self.protocol_number,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
```

**Step 3: Create empty routes file**

Create `backend/my_project/registry/routes.py`:
```python
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import registry_bp
from ..extensions import db
from .models import Structure, StructureType, License, Sanction
```

**Step 4: Create permissions helper**

Create `backend/my_project/registry/permissions.py`:
```python
from ..extensions import db


def has_registry_access(user_id):
    """Check if user has any registry role."""
    from ..oversight.models import UserRole
    return UserRole.query.filter_by(user_id=user_id).first() is not None


def has_role(user_id, role_name, structure_id=None):
    """Check if user has a specific role, optionally for a specific structure."""
    from ..oversight.models import UserRole
    query = UserRole.query.filter_by(user_id=user_id, role=role_name)
    if structure_id:
        query = query.filter_by(structure_id=structure_id)
    return query.first() is not None


def is_director(user_id):
    """Check if user is director (full access)."""
    return has_role(user_id, 'director')


def is_administrative(user_id):
    """Check if user is administrative staff."""
    return has_role(user_id, 'administrative')


def can_view_structure(user_id, structure_id):
    """Check if user can view a specific structure."""
    from ..oversight.models import UserRole
    from ..models import User
    user = User.query.get(user_id)
    if user and user.role == 'admin':
        return True
    if is_director(user_id) or is_administrative(user_id):
        return True
    return UserRole.query.filter_by(
        user_id=user_id, structure_id=structure_id
    ).first() is not None


def can_edit_structure(user_id):
    """Check if user can create/edit structures."""
    from ..models import User
    user = User.query.get(user_id)
    if user and user.role == 'admin':
        return True
    return is_director(user_id) or is_administrative(user_id)
```

**Step 5: Register blueprint in create_app()**

Modify `backend/my_project/__init__.py`. After the line `app.register_blueprint(main_bp)`, add:
```python
    from .registry.routes import registry_bp  # noqa: this import is wrong
    # Actually:
    from .registry import registry_bp
    app.register_blueprint(registry_bp)
```

Also in the `with app.app_context():` block, add model imports so tables are created:
```python
        from .registry.models import Structure, StructureType, License, Sanction
```

Also add seed data for StructureType after the Category seeding block:
```python
        try:
            from .registry.models import StructureType
            if StructureType.query.count() == 0:
                print("Seeding structure types...")
                types = [
                    {'code': 'MFH', 'name': 'Μονάδα Φροντίδας Ηλικιωμένων', 'description': 'Γηροκομεία, μονάδες χρόνιας φροντίδας ηλικιωμένων'},
                    {'code': 'KDAP', 'name': 'Κέντρο Δημιουργικής Απασχόλησης Παιδιών', 'description': 'Δομές δημιουργικής απασχόλησης για παιδιά σχολικής ηλικίας'},
                    {'code': 'SYD', 'name': 'Στέγη Υποστηριζόμενης Διαβίωσης', 'description': 'Δομές αυτόνομης/ημιαυτόνομης διαβίωσης ΑμεΑ'},
                    {'code': 'KDHF-KAA', 'name': 'Κέντρο Διημέρευσης-Ημερήσιας Φροντίδας / Κέντρο Αποθεραπείας-Αποκατάστασης', 'description': 'Δομές ημερήσιας φροντίδας και αποκατάστασης'},
                    {'code': 'MFPAD', 'name': 'Μονάδα Φροντίδας Παιδιών και Ατόμων με Αναπηρία', 'description': 'Ιδρύματα/μονάδες φροντίδας για παιδιά και ΑμεΑ'},
                    {'code': 'CAMP', 'name': 'Παιδικές Κατασκηνώσεις', 'description': 'Εποχικές δομές κατασκήνωσης'},
                ]
                for t in types:
                    db.session.add(StructureType(**t))
                db.session.commit()
                print("Structure types seeded.")
        except Exception:
            db.session.rollback()
```

**Step 6: Write test for models**

Create `tests/test_registry/__init__.py` (empty) and `tests/test_registry/test_models.py`:
```python
import pytest

def test_structure_type_creation(app):
    from my_project.registry.models import StructureType
    from my_project.extensions import db
    with app.app_context():
        st = StructureType(code='TEST', name='Test Type')
        db.session.add(st)
        db.session.commit()
        assert st.id is not None
        assert st.to_dict()['code'] == 'TEST'

def test_structure_creation(app):
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db
    with app.app_context():
        st = StructureType.query.filter_by(code='TEST').first()
        if not st:
            st = StructureType(code='TEST2', name='Test Type 2')
            db.session.add(st)
            db.session.commit()
        s = Structure(code='S001', name='Test Structure', type_id=st.id, status='active')
        db.session.add(s)
        db.session.commit()
        assert s.id is not None
        d = s.to_dict()
        assert d['code'] == 'S001'
        assert d['status'] == 'active'
```

**Step 7: Run tests**

Run: `python -m pytest tests/test_registry/test_models.py -v`
Expected: PASS

**Step 8: Commit**

```bash
git add backend/my_project/registry/ tests/test_registry/
git add backend/my_project/__init__.py
git commit -m "feat(registry): scaffold registry module with Structure models and seeds"
```

---

### Task 2: Inspections Module Scaffolding

**Files:**
- Create: `backend/my_project/inspections/__init__.py`
- Create: `backend/my_project/inspections/models.py`
- Create: `backend/my_project/inspections/routes.py`
- Create: `backend/my_project/inspections/permissions.py`
- Modify: `backend/my_project/__init__.py` (register blueprint + import models)

**Step 1: Create inspections module with blueprint**

Create `backend/my_project/inspections/__init__.py`:
```python
from flask import Blueprint

inspections_bp = Blueprint('inspections', __name__)

from . import routes  # noqa: E402, F401
```

**Step 2: Create inspection models**

Create `backend/my_project/inspections/models.py` with `InspectionCommittee`, `CommitteeMembership`, `CommitteeStructureAssignment`, `Inspection`, `InspectionReport`.

```python
from datetime import datetime
from ..extensions import db


class InspectionCommittee(db.Model):
    __tablename__ = 'inspection_committees'
    id = db.Column(db.Integer, primary_key=True)
    decision_number = db.Column(db.String(100), nullable=False)
    appointed_date = db.Column(db.Date, nullable=False)
    expiry_date = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(50), default='active')
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    members = db.relationship('CommitteeMembership', backref='committee',
                              lazy=True, cascade='all, delete-orphan')
    structure_assignments = db.relationship('CommitteeStructureAssignment',
                                            backref='committee', lazy=True,
                                            cascade='all, delete-orphan')
    inspections = db.relationship('Inspection', backref='committee', lazy=True)

    def to_dict(self, include_members=False, include_structures=False):
        d = {
            'id': self.id, 'decision_number': self.decision_number,
            'appointed_date': self.appointed_date.isoformat() if self.appointed_date else None,
            'expiry_date': self.expiry_date.isoformat() if self.expiry_date else None,
            'status': self.status, 'notes': self.notes,
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
    committee_id = db.Column(db.Integer, db.ForeignKey('inspection_committees.id'), nullable=False)
    type = db.Column(db.String(50), nullable=False)
    scheduled_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(50), default='scheduled')
    conclusion = db.Column(db.String(50), nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    structure = db.relationship('Structure', backref='inspections')
    report = db.relationship('InspectionReport', backref='inspection', uselist=False)

    def to_dict(self):
        return {
            'id': self.id, 'structure_id': self.structure_id,
            'committee_id': self.committee_id, 'type': self.type,
            'scheduled_date': self.scheduled_date.isoformat() if self.scheduled_date else None,
            'status': self.status, 'conclusion': self.conclusion,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'structure': {'id': self.structure.id, 'name': self.structure.name} if self.structure else None,
        }


class InspectionReport(db.Model):
    __tablename__ = 'inspection_reports'
    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(db.Integer, db.ForeignKey('inspections.id'), nullable=False, unique=True)
    protocol_number = db.Column(db.String(100))
    drafted_date = db.Column(db.Date)
    findings = db.Column(db.Text)
    recommendations = db.Column(db.Text, nullable=True)
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
            'file_path': self.file_path, 'status': self.status,
            'submitted_by': self.submitted_by,
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
```

**Step 3: Create empty routes and permissions**

Create `backend/my_project/inspections/routes.py`:
```python
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import inspections_bp
from ..extensions import db
from .models import Inspection, InspectionReport, InspectionCommittee, CommitteeMembership, CommitteeStructureAssignment
```

Create `backend/my_project/inspections/permissions.py`:
```python
from ..extensions import db


def is_committee_member(user_id, committee_id=None):
    """Check if user is member of any/specific committee."""
    from .models import CommitteeMembership
    query = CommitteeMembership.query.filter_by(user_id=user_id)
    if committee_id:
        query = query.filter_by(committee_id=committee_id)
    return query.first() is not None


def can_submit_report(user_id, inspection_id):
    """Check if user can submit a report for an inspection."""
    from .models import Inspection, CommitteeMembership
    inspection = Inspection.query.get(inspection_id)
    if not inspection:
        return False
    return is_committee_member(user_id, inspection.committee_id)
```

**Step 4: Register in create_app()**

Add to `backend/my_project/__init__.py` after registry blueprint registration:
```python
    from .inspections import inspections_bp
    app.register_blueprint(inspections_bp)
```

And in model imports:
```python
        from .inspections.models import (InspectionCommittee, CommitteeMembership,
            CommitteeStructureAssignment, Inspection, InspectionReport)
```

**Step 5: Write tests**

Create `tests/test_registry/test_inspection_models.py`:
```python
import pytest
from datetime import date

def test_committee_creation(app):
    from my_project.inspections.models import InspectionCommittee
    from my_project.extensions import db
    with app.app_context():
        c = InspectionCommittee(decision_number='AP-001/2026', appointed_date=date(2026, 1, 15))
        db.session.add(c)
        db.session.commit()
        assert c.id is not None
        assert c.status == 'active'

def test_inspection_creation(app):
    from my_project.inspections.models import Inspection, InspectionCommittee
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db
    with app.app_context():
        st = StructureType.query.first() or StructureType(code='T1', name='T1')
        db.session.add(st)
        db.session.flush()
        s = Structure(code='INS-S1', name='Test', type_id=st.id)
        db.session.add(s)
        c = InspectionCommittee(decision_number='AP-002', appointed_date=date(2026, 1, 1))
        db.session.add(c)
        db.session.flush()
        insp = Inspection(structure_id=s.id, committee_id=c.id, type='regular', scheduled_date=date(2026, 3, 1))
        db.session.add(insp)
        db.session.commit()
        assert insp.id is not None
        assert insp.status == 'scheduled'
```

**Step 6: Run tests**

Run: `python -m pytest tests/test_registry/ -v`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add backend/my_project/inspections/ tests/test_registry/test_inspection_models.py
git add backend/my_project/__init__.py
git commit -m "feat(inspections): scaffold inspections module with Committee and Inspection models"
```

---

### Task 3: Oversight Module Scaffolding (UserRole + SocialAdvisorReport)

**Files:**
- Create: `backend/my_project/oversight/__init__.py`
- Create: `backend/my_project/oversight/models.py`
- Create: `backend/my_project/oversight/routes.py`
- Create: `backend/my_project/oversight/reports.py`
- Modify: `backend/my_project/__init__.py` (register blueprint + import models + seed roles)

**Step 1: Create oversight module**

Create `backend/my_project/oversight/__init__.py`:
```python
from flask import Blueprint

oversight_bp = Blueprint('oversight', __name__)

from . import routes  # noqa: E402, F401
```

**Step 2: Create UserRole and SocialAdvisorReport models**

Create `backend/my_project/oversight/models.py`:
```python
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
```

**Step 3: Create empty routes and reports**

Create `backend/my_project/oversight/routes.py`:
```python
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import oversight_bp
from ..extensions import db
from .models import UserRole, SocialAdvisorReport
```

Create `backend/my_project/oversight/reports.py`:
```python
"""Report generation utilities (PDF/XLSX). Implemented in Phase 3."""
```

**Step 4: Register in create_app() and seed demo user roles**

Add to `backend/my_project/__init__.py`:
```python
    from .oversight import oversight_bp
    app.register_blueprint(oversight_bp)
```

Model imports:
```python
        from .oversight.models import UserRole, SocialAdvisorReport
```

Seed data (after structure types seed):
```python
        # Seed user roles for demo
        try:
            from .oversight.models import UserRole
            if UserRole.query.count() == 0 and User.query.count() > 0:
                admin = User.query.filter_by(username='admin').first()
                staff = User.query.filter_by(username='staff').first()
                if admin:
                    db.session.add(UserRole(user_id=admin.id, role='director'))
                    db.session.add(UserRole(user_id=admin.id, role='administrative'))
                if staff:
                    db.session.add(UserRole(user_id=staff.id, role='social_advisor'))
                db.session.commit()
                print("User roles seeded.")
        except Exception:
            db.session.rollback()
```

**Step 5: Write tests**

Create `tests/test_registry/test_oversight_models.py`:
```python
import pytest
from datetime import date

def test_user_role_creation(app):
    from my_project.oversight.models import UserRole
    from my_project.models import User
    from my_project.extensions import db
    with app.app_context():
        user = User.query.first()
        if not user:
            user = User(username='roletest', email='role@test.com', role='staff')
            user.set_password('pass123')
            db.session.add(user)
            db.session.commit()
        ur = UserRole(user_id=user.id, role='director')
        db.session.add(ur)
        db.session.commit()
        assert ur.id is not None
        assert ur.role in UserRole.VALID_ROLES

def test_advisor_report_creation(app):
    from my_project.oversight.models import SocialAdvisorReport
    from my_project.registry.models import Structure, StructureType
    from my_project.models import User
    from my_project.extensions import db
    with app.app_context():
        user = User.query.first()
        st = StructureType.query.first() or StructureType(code='OT1', name='OT1')
        db.session.add(st)
        db.session.flush()
        s = Structure(code='OV-S1', name='Oversight Test', type_id=st.id)
        db.session.add(s)
        db.session.flush()
        report = SocialAdvisorReport(
            structure_id=s.id, author_id=user.id,
            drafted_date=date(2026, 2, 14), type='regular',
            assessment='Test assessment'
        )
        db.session.add(report)
        db.session.commit()
        assert report.id is not None
        assert report.status == 'draft'
```

**Step 6: Run all tests**

Run: `python -m pytest tests/ -v`
Expected: ALL PASS

**Step 7: Commit**

```bash
git add backend/my_project/oversight/ tests/test_registry/test_oversight_models.py
git add backend/my_project/__init__.py
git commit -m "feat(oversight): scaffold oversight module with UserRole and SocialAdvisorReport"
```

---

### Task 4: Structures CRUD API

**Files:**
- Modify: `backend/my_project/registry/routes.py`
- Create: `tests/test_registry/test_structures_api.py`

**Step 1: Write failing tests**

Create `tests/test_registry/test_structures_api.py`:
```python
import pytest

class TestStructuresAPI:
    def test_list_structures_requires_auth(self, client):
        response = client.get('/api/structures')
        assert response.status_code == 401

    def test_list_structures(self, client, auth_headers):
        response = client.get('/api/structures', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'structures' in data
        assert 'total' in data

    def test_create_structure_requires_auth(self, client):
        response = client.post('/api/structures', json={'name': 'Test'})
        assert response.status_code == 401

    def test_get_structure_types(self, client, auth_headers):
        response = client.get('/api/structure-types', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert isinstance(data, list)

    def test_create_structure(self, client, admin_headers, app):
        with app.app_context():
            from my_project.registry.models import StructureType
            st = StructureType.query.first()
            type_id = st.id if st else 1

        response = client.post('/api/structures', headers=admin_headers, json={
            'code': 'API-S001',
            'name': 'Γηροκομείο Αθηνών',
            'type_id': type_id,
            'city': 'Αθήνα',
            'status': 'active'
        })
        assert response.status_code == 201
        data = response.get_json()
        assert data['code'] == 'API-S001'

    def test_get_structure_detail(self, client, admin_headers, app):
        # First create one
        with app.app_context():
            from my_project.registry.models import Structure
            s = Structure.query.first()
            if s:
                sid = s.id
            else:
                sid = 999

        response = client.get(f'/api/structures/{sid}', headers=admin_headers)
        # Should be 200 if exists, 404 if not
        assert response.status_code in [200, 404]
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_registry/test_structures_api.py -v`
Expected: FAIL (404 — routes don't exist yet)

**Step 3: Implement routes**

Write `backend/my_project/registry/routes.py` with full CRUD:
```python
from flask import jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from . import registry_bp
from ..extensions import db
from .models import Structure, StructureType, License, Sanction
from .permissions import can_edit_structure, can_view_structure, is_director


@registry_bp.route('/api/structure-types', methods=['GET'])
@jwt_required()
def list_structure_types():
    types = StructureType.query.filter_by(active=True).all()
    return jsonify([t.to_dict() for t in types]), 200


@registry_bp.route('/api/structure-types', methods=['POST'])
@jwt_required()
def create_structure_type():
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    data = request.get_json()
    st = StructureType(code=data['code'], name=data['name'],
                       description=data.get('description'))
    db.session.add(st)
    db.session.commit()
    return jsonify(st.to_dict()), 201


@registry_bp.route('/api/structures', methods=['GET'])
@jwt_required()
def list_structures():
    user_id = int(get_jwt_identity())
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    query = Structure.query

    # Filters
    type_id = request.args.get('type_id', type=int)
    status = request.args.get('status')
    advisor_id = request.args.get('advisor_id', type=int)
    search = request.args.get('search')

    if type_id:
        query = query.filter_by(type_id=type_id)
    if status:
        query = query.filter_by(status=status)
    if advisor_id:
        query = query.filter_by(advisor_id=advisor_id)
    if search:
        query = query.filter(
            db.or_(
                Structure.name.ilike(f'%{search}%'),
                Structure.code.ilike(f'%{search}%')
            )
        )

    query = query.order_by(Structure.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'structures': [s.to_dict() for s in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }), 200


@registry_bp.route('/api/structures', methods=['POST'])
@jwt_required()
def create_structure():
    user_id = int(get_jwt_identity())
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    data = request.get_json()
    required = ['code', 'name', 'type_id']
    for field in required:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400

    if Structure.query.filter_by(code=data['code']).first():
        return jsonify({'error': 'Code already exists'}), 409

    structure = Structure(
        code=data['code'], name=data['name'], type_id=data['type_id'],
        street=data.get('street'), city=data.get('city'),
        postal_code=data.get('postal_code'),
        representative_name=data.get('representative_name'),
        representative_afm=data.get('representative_afm'),
        representative_phone=data.get('representative_phone'),
        representative_email=data.get('representative_email'),
        capacity=data.get('capacity'), status=data.get('status', 'active'),
        ownership=data.get('ownership'),
        license_number=data.get('license_number'),
        advisor_id=data.get('advisor_id'),
        notes=data.get('notes'),
    )
    db.session.add(structure)
    db.session.commit()
    return jsonify(structure.to_dict()), 201


@registry_bp.route('/api/structures/<int:structure_id>', methods=['GET'])
@jwt_required()
def get_structure(structure_id):
    structure = Structure.query.get_or_404(structure_id)
    return jsonify(structure.to_dict()), 200


@registry_bp.route('/api/structures/<int:structure_id>', methods=['PUT'])
@jwt_required()
def update_structure(structure_id):
    user_id = int(get_jwt_identity())
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403

    structure = Structure.query.get_or_404(structure_id)
    data = request.get_json()

    for field in ['name', 'type_id', 'street', 'city', 'postal_code',
                  'representative_name', 'representative_afm',
                  'representative_phone', 'representative_email',
                  'capacity', 'status', 'ownership', 'license_number',
                  'advisor_id', 'notes']:
        if field in data:
            setattr(structure, field, data[field])

    db.session.commit()
    return jsonify(structure.to_dict()), 200


# License endpoints
@registry_bp.route('/api/structures/<int:structure_id>/licenses', methods=['GET'])
@jwt_required()
def list_licenses(structure_id):
    Structure.query.get_or_404(structure_id)
    licenses = License.query.filter_by(structure_id=structure_id).order_by(License.issued_date.desc()).all()
    return jsonify([l.to_dict() for l in licenses]), 200


@registry_bp.route('/api/structures/<int:structure_id>/licenses', methods=['POST'])
@jwt_required()
def create_license(structure_id):
    user_id = int(get_jwt_identity())
    if not can_edit_structure(user_id):
        return jsonify({'error': 'Insufficient permissions'}), 403
    Structure.query.get_or_404(structure_id)
    data = request.get_json()
    lic = License(
        structure_id=structure_id, type=data['type'],
        protocol_number=data.get('protocol_number'),
        issued_date=data.get('issued_date'), expiry_date=data.get('expiry_date'),
        status=data.get('status', 'active'), notes=data.get('notes'),
    )
    db.session.add(lic)
    db.session.commit()
    return jsonify(lic.to_dict()), 201


# Sanction endpoints
@registry_bp.route('/api/structures/<int:structure_id>/sanctions', methods=['GET'])
@jwt_required()
def list_sanctions(structure_id):
    Structure.query.get_or_404(structure_id)
    sanctions = Sanction.query.filter_by(structure_id=structure_id).order_by(Sanction.imposed_date.desc()).all()
    return jsonify([s.to_dict() for s in sanctions]), 200


@registry_bp.route('/api/structures/<int:structure_id>/sanctions', methods=['POST'])
@jwt_required()
def create_sanction(structure_id):
    user_id = int(get_jwt_identity())
    if not is_director(user_id):
        from ..models import User
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Director or admin only'}), 403
    Structure.query.get_or_404(structure_id)
    data = request.get_json()
    sanction = Sanction(
        structure_id=structure_id, type=data['type'],
        inspection_id=data.get('inspection_id'),
        amount=data.get('amount'), imposed_date=data.get('imposed_date'),
        status=data.get('status', 'imposed'),
        protocol_number=data.get('protocol_number'),
        notes=data.get('notes'),
    )
    db.session.add(sanction)
    db.session.commit()
    return jsonify(sanction.to_dict()), 201


@registry_bp.route('/api/sanctions/<int:sanction_id>', methods=['PATCH'])
@jwt_required()
def update_sanction(sanction_id):
    user_id = int(get_jwt_identity())
    if not is_director(user_id):
        from ..models import User
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Director or admin only'}), 403
    sanction = Sanction.query.get_or_404(sanction_id)
    data = request.get_json()
    for field in ['status', 'notes', 'amount']:
        if field in data:
            setattr(sanction, field, data[field])
    db.session.commit()
    return jsonify(sanction.to_dict()), 200
```

**Step 4: Run tests**

Run: `python -m pytest tests/test_registry/test_structures_api.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/my_project/registry/routes.py tests/test_registry/test_structures_api.py
git commit -m "feat(registry): implement structures CRUD API with filters and permissions"
```

---

### Task 5: Inspections & Reports CRUD API

**Files:**
- Modify: `backend/my_project/inspections/routes.py`
- Create: `tests/test_registry/test_inspections_api.py`

**Step 1: Write tests**

Create `tests/test_registry/test_inspections_api.py`:
```python
import pytest

class TestInspectionsAPI:
    def test_list_inspections_requires_auth(self, client):
        assert client.get('/api/inspections').status_code == 401

    def test_list_inspections(self, client, auth_headers):
        response = client.get('/api/inspections', headers=auth_headers)
        assert response.status_code == 200

    def test_list_committees(self, client, auth_headers):
        response = client.get('/api/committees', headers=auth_headers)
        assert response.status_code == 200
```

**Step 2: Implement inspection routes**

Write full `backend/my_project/inspections/routes.py`:
- `GET/POST /api/inspections` — list/create inspections
- `GET/PATCH /api/inspections/<id>` — detail/update
- `POST /api/inspections/<id>/report` — submit report (multipart)
- `GET /api/inspections/<id>/report` — get report
- `PATCH /api/inspection-reports/<id>` — update report status
- `GET/POST /api/committees` — list/create
- `GET/PUT /api/committees/<id>` — detail/update
- `POST /api/committees/<id>/members` — add member
- `DELETE /api/committees/<id>/members/<uid>` — remove member
- `POST /api/committees/<id>/structures` — assign structure

File upload pattern for reports:
```python
@inspections_bp.route('/api/inspections/<int:inspection_id>/report', methods=['POST'])
@jwt_required()
def submit_report(inspection_id):
    user_id = int(get_jwt_identity())
    inspection = Inspection.query.get_or_404(inspection_id)

    # Handle multipart form data
    findings = request.form.get('findings', '')
    recommendations = request.form.get('recommendations', '')
    protocol_number = request.form.get('protocol_number', '')
    conclusion = request.form.get('conclusion')

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
        file_path=file_path,
        status='submitted',
        submitted_by=user_id,
        submitted_at=datetime.utcnow(),
    )
    # Update inspection conclusion
    if conclusion:
        inspection.conclusion = conclusion
        inspection.status = 'completed'

    db.session.add(report)
    db.session.commit()
    return jsonify(report.to_dict()), 201
```

**Step 3: Run tests**

Run: `python -m pytest tests/test_registry/ -v`
Expected: ALL PASS

**Step 4: Commit**

```bash
git add backend/my_project/inspections/routes.py tests/test_registry/test_inspections_api.py
git commit -m "feat(inspections): implement inspections and committees CRUD API"
```

---

### Task 6: Oversight API (Advisor Reports + User Roles)

**Files:**
- Modify: `backend/my_project/oversight/routes.py`
- Create: `tests/test_registry/test_oversight_api.py`

**Step 1: Implement oversight routes**

Write `backend/my_project/oversight/routes.py`:
- `GET/POST /api/structures/<id>/advisor-reports` — list/create
- `GET/PATCH /api/advisor-reports/<id>` — detail/update
- `PATCH /api/advisor-reports/<id>/approve` — director approval
- `GET/POST /api/user-roles` — list/assign roles
- `DELETE /api/user-roles/<id>` — remove role
- `GET /api/oversight/dashboard` — aggregated stats (placeholder)
- `GET /api/oversight/alerts` — expiring licenses, pending reports

Advisor report upload follows same multipart pattern as inspection reports.

Approval flow:
```python
@oversight_bp.route('/api/advisor-reports/<int:report_id>/approve', methods=['PATCH'])
@jwt_required()
def approve_report(report_id):
    user_id = int(get_jwt_identity())
    from ..registry.permissions import is_director
    from ..models import User
    user = User.query.get(user_id)
    if not is_director(user_id) and (not user or user.role != 'admin'):
        return jsonify({'error': 'Director or admin only'}), 403

    report = SocialAdvisorReport.query.get_or_404(report_id)
    data = request.get_json()
    action = data.get('action')  # 'approve' or 'return'

    if action == 'approve':
        report.status = 'approved'
        report.approved_by = user_id
        report.approved_at = datetime.utcnow()
    elif action == 'return':
        report.status = 'returned'
    else:
        return jsonify({'error': 'Invalid action'}), 400

    db.session.commit()
    return jsonify(report.to_dict()), 200
```

**Step 2: Write tests and run**

**Step 3: Commit**

```bash
git add backend/my_project/oversight/routes.py tests/test_registry/test_oversight_api.py
git commit -m "feat(oversight): implement advisor reports and user roles API"
```

---

### Task 7: conftest.py — Registry Test Fixtures

**Files:**
- Modify: `conftest.py` (add registry-specific fixtures)

**Step 1: Add fixtures**

Add to `conftest.py`:
```python
@pytest.fixture
def staff_headers(app, client):
    """Create staff user with social_advisor role and return JWT headers."""
    from my_project.models import User
    from my_project.oversight.models import UserRole
    from my_project.extensions import db as _db

    with app.app_context():
        user = User.query.filter_by(username='teststaff').first()
        if not user:
            user = User(username='teststaff', email='staff@test.com', role='staff')
            user.set_password('staffpass123')
            _db.session.add(user)
            _db.session.commit()
        # Add social_advisor role if not present
        if not UserRole.query.filter_by(user_id=user.id, role='social_advisor').first():
            _db.session.add(UserRole(user_id=user.id, role='social_advisor'))
            _db.session.commit()

    response = client.post('/api/auth/login', json={
        'username': 'teststaff', 'password': 'staffpass123'
    })
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def director_headers(app, client):
    """Create director user and return JWT headers."""
    from my_project.models import User
    from my_project.oversight.models import UserRole
    from my_project.extensions import db as _db

    with app.app_context():
        user = User.query.filter_by(username='testdirector').first()
        if not user:
            user = User(username='testdirector', email='director@test.com', role='staff')
            user.set_password('dirpass123')
            _db.session.add(user)
            _db.session.commit()
        if not UserRole.query.filter_by(user_id=user.id, role='director').first():
            _db.session.add(UserRole(user_id=user.id, role='director'))
            _db.session.commit()

    response = client.post('/api/auth/login', json={
        'username': 'testdirector', 'password': 'dirpass123'
    })
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}
```

**Step 2: Run all tests**

Run: `python -m pytest tests/ -v`
Expected: ALL PASS

**Step 3: Commit**

```bash
git add conftest.py
git commit -m "test: add registry-specific fixtures (staff, director headers)"
```

---

### Task 8: Demo Seed Data

**Files:**
- Create: `backend/scripts/seed_registry.py`

**Step 1: Create seed script**

Script creates realistic Greek demo data:
- 10-15 structures across all 6 types with real Greek city names/addresses
- 2-3 inspection committees with members
- 5-6 inspections (mix of scheduled/completed/cancelled)
- 3-4 inspection reports in various statuses
- 2-3 advisor reports (draft/submitted/approved)
- 2 sanctions
- Licenses with various expiry dates (active, expiring in 2 months, expired)

Run: `python backend/scripts/seed_registry.py`

**Step 2: Commit**

```bash
git add backend/scripts/seed_registry.py
git commit -m "feat: add registry demo seed data script"
```

---

### Task 9: Frontend — Registry API Client & Constants

**Files:**
- Create: `frontend/src/features/registry/lib/registryApi.js`
- Create: `frontend/src/features/registry/lib/constants.js`

**Step 1: Create API client**

```javascript
import api from '@/lib/api';

export const structuresApi = {
  list: (params) => api.get('/api/structures', { params }),
  get: (id) => api.get(`/api/structures/${id}`),
  create: (data) => api.post('/api/structures', data),
  update: (id, data) => api.put(`/api/structures/${id}`, data),
  types: () => api.get('/api/structure-types'),
  licenses: (id) => api.get(`/api/structures/${id}/licenses`),
  createLicense: (id, data) => api.post(`/api/structures/${id}/licenses`, data),
  sanctions: (id) => api.get(`/api/structures/${id}/sanctions`),
  createSanction: (id, data) => api.post(`/api/structures/${id}/sanctions`, data),
  advisorReports: (id) => api.get(`/api/structures/${id}/advisor-reports`),
  timeline: (id) => api.get(`/api/structures/${id}/timeline`),
};

export const inspectionsApi = {
  list: (params) => api.get('/api/inspections', { params }),
  get: (id) => api.get(`/api/inspections/${id}`),
  create: (data) => api.post('/api/inspections', data),
  update: (id, data) => api.patch(`/api/inspections/${id}`, data),
  submitReport: (id, formData) => api.post(`/api/inspections/${id}/report`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getReport: (id) => api.get(`/api/inspections/${id}/report`),
};

export const committeesApi = {
  list: () => api.get('/api/committees'),
  get: (id) => api.get(`/api/committees/${id}`),
  create: (data) => api.post('/api/committees', data),
  update: (id, data) => api.put(`/api/committees/${id}`, data),
  addMember: (id, data) => api.post(`/api/committees/${id}/members`, data),
  removeMember: (id, userId) => api.delete(`/api/committees/${id}/members/${userId}`),
  assignStructure: (id, data) => api.post(`/api/committees/${id}/structures`, data),
};

export const oversightApi = {
  dashboard: () => api.get('/api/oversight/dashboard'),
  alerts: () => api.get('/api/oversight/alerts'),
  reports: (type, params) => api.get(`/api/oversight/reports/${type}`, { params, responseType: 'blob' }),
  userRoles: () => api.get('/api/user-roles'),
  assignRole: (data) => api.post('/api/user-roles', data),
  removeRole: (id) => api.delete(`/api/user-roles/${id}`),
  submitAdvisorReport: (structureId, formData) => api.post(
    `/api/structures/${structureId}/advisor-reports`, formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  ),
  approveReport: (id, action) => api.patch(`/api/advisor-reports/${id}/approve`, { action }),
};
```

**Step 2: Create constants with Greek labels**

```javascript
export const STRUCTURE_STATUS = {
  active: { label: 'Ενεργή', color: 'green' },
  suspended: { label: 'Αναστολή', color: 'orange' },
  revoked: { label: 'Ανάκληση', color: 'red' },
  closed: { label: 'Κλειστή', color: 'gray' },
};

export const OWNERSHIP_TYPES = {
  public: 'Δημόσια',
  private_profit: 'Ιδιωτική κερδοσκοπική',
  private_nonprofit: 'Ιδιωτική μη κερδοσκοπική',
  npdd: 'ΝΠΔΔ',
  npid: 'ΝΠΙΔ',
};

export const INSPECTION_TYPES = {
  regular: 'Τακτικός',
  extraordinary: 'Έκτακτος',
  reinspection: 'Επανέλεγχος',
};

export const INSPECTION_STATUS = {
  scheduled: { label: 'Προγραμματισμένος', color: 'blue' },
  completed: { label: 'Ολοκληρωμένος', color: 'green' },
  cancelled: { label: 'Ακυρωμένος', color: 'gray' },
};

export const INSPECTION_CONCLUSIONS = {
  normal: { label: 'Κανονική λειτουργία', color: 'green' },
  observations: { label: 'Παρατηρήσεις', color: 'orange' },
  serious_violations: { label: 'Σοβαρές παραβάσεις', color: 'red' },
};

export const REPORT_STATUS = {
  draft: { label: 'Πρόχειρο', color: 'gray' },
  submitted: { label: 'Υποβληθέν', color: 'blue' },
  approved: { label: 'Εγκεκριμένο', color: 'green' },
  returned: { label: 'Επιστράφηκε', color: 'orange' },
};

export const LICENSE_STATUS = {
  active: { label: 'Ενεργή', color: 'green' },
  expiring: { label: 'Λήγουσα', color: 'orange' },
  expired: { label: 'Ληγμένη', color: 'red' },
  revoked: { label: 'Ανακληθείσα', color: 'red' },
};

export const SANCTION_TYPES = {
  fine: 'Πρόστιμο',
  suspension: 'Αναστολή λειτουργίας',
  revocation: 'Ανάκληση άδειας',
  warning: 'Σύσταση',
};

export const SANCTION_STATUS = {
  imposed: { label: 'Επιβληθείσα', color: 'red' },
  paid: { label: 'Εξοφληθείσα', color: 'green' },
  appealed: { label: 'Σε ένσταση', color: 'orange' },
  cancelled: { label: 'Ακυρωθείσα', color: 'gray' },
};

export const USER_ROLES = {
  social_advisor: 'Κοινωνικός Σύμβουλος',
  committee_member: 'Μέλος Επιτροπής Ελέγχου',
  administrative: 'Διοικητικός / Γραμματεία',
  director: 'Προϊστάμενος / Διευθυντής',
};

export const COMMITTEE_ROLES = {
  president: 'Πρόεδρος',
  member: 'Μέλος',
  secretary: 'Γραμματέας',
};

export const ADVISOR_REPORT_TYPES = {
  regular: 'Τακτική αξιολόγηση',
  extraordinary: 'Έκτακτη αξιολόγηση',
  incident: 'Αναφορά συμβάντος',
};
```

**Step 3: Commit**

```bash
git add frontend/src/features/registry/
git commit -m "feat(frontend): add registry API client and Greek constants"
```

---

### Task 10: Frontend — Registry List Page

**Files:**
- Create: `frontend/src/features/registry/hooks/useStructures.js`
- Create: `frontend/src/features/registry/components/StructureTable.jsx`
- Create: `frontend/src/features/registry/components/LicenseBadge.jsx`
- Create: `frontend/src/features/registry/pages/RegistryListPage.jsx`
- Modify: `frontend/src/App.jsx` (add route + navigation)

**Step 1: Create useStructures hook**

Custom hook wrapping `structuresApi.list()` with state management for filters, pagination, loading.

**Step 2: Create LicenseBadge component**

Calculates months until expiry. Red badge <3 months, orange <6 months, green otherwise.

**Step 3: Create StructureTable component**

Uses shadcn/ui `Table` with columns: Κωδικός, Επωνυμία, Τύπος, Κατάσταση, Λήξη Άδειας, Κοιν. Σύμβουλος. Clickable rows navigate to detail page. Uses `LicenseBadge` for expiry column.

**Step 4: Create RegistryListPage**

Full page with:
- Header with title + "Νέα Δομή" button
- Filter bar: type dropdown, status dropdown, search input
- StructureTable with server-side pagination
- Empty state when no structures

Design follows existing page patterns (large typography, generous spacing, Greek government palette).

**Step 5: Add route and navigation**

Modify `App.jsx`:
- Import `RegistryListPage`
- Add `<Route path="/registry" element={<RegistryListPage />} />` inside ProtectedRoute
- Add "Εποπτεία" section to navigation with sub-items

**Step 6: Commit**

```bash
git add frontend/src/features/registry/ frontend/src/App.jsx
git commit -m "feat(frontend): implement registry list page with filters and navigation"
```

---

### Task 11: Frontend — Structure Detail Page (Tabs)

**Files:**
- Create: `frontend/src/features/registry/pages/StructureDetailPage.jsx`
- Create: `frontend/src/features/registry/components/StructureTimeline.jsx`
- Modify: `frontend/src/App.jsx` (add route)

**Step 1: Create StructureDetailPage**

Tabbed layout using shadcn/ui `Tabs`:
- **Στοιχεία** — Structure info, representative, advisor
- **Αδειοδότηση** — License list + create button
- **Έλεγχοι** — Inspections list for this structure
- **Εκθέσεις** — Advisor reports for this structure
- **Κυρώσεις** — Sanctions list
- **Timeline** — Merged chronological view (Phase 3 placeholder)

Each tab lazy-loads data when selected.

**Step 2: Commit**

```bash
git add frontend/src/features/registry/ frontend/src/App.jsx
git commit -m "feat(frontend): implement structure detail page with tabs"
```

---

### Task 12: Frontend — Structure Create/Edit Form

**Files:**
- Create: `frontend/src/features/registry/pages/StructureFormPage.jsx`
- Modify: `frontend/src/App.jsx` (add routes)

**Step 1: Create StructureFormPage**

Form using `react-hook-form` + shadcn/ui form components:
- Fields matching Structure model
- StructureType dropdown (fetched from API)
- Advisor user picker (search users)
- Validation (required: code, name, type)
- Edit mode: pre-fills from existing structure
- Submit → `structuresApi.create()` or `structuresApi.update()`

**Step 2: Add routes**

```jsx
<Route path="/registry/new" element={<StructureFormPage />} />
<Route path="/registry/:id/edit" element={<StructureFormPage />} />
```

**Step 3: Commit**

```bash
git add frontend/src/features/registry/ frontend/src/App.jsx
git commit -m "feat(frontend): implement structure create/edit form"
```

---

### Task 13: Frontend — Inspection Report Form

**Files:**
- Create: `frontend/src/features/registry/pages/InspectionReportPage.jsx`
- Create: `frontend/src/features/registry/components/InspectionForm.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Create InspectionForm component**

Multipart form:
- Inspection info header (structure, committee, date — read-only)
- Type dropdown (regular/extraordinary/reinspection)
- Findings (TipTap rich text editor)
- Conclusion dropdown
- Recommendations (TipTap)
- File upload dropzone (PDF/DOCX)
- Save as Draft / Submit buttons

**Step 2: Create InspectionReportPage**

Wraps InspectionForm, fetches inspection data by ID from URL params.

**Step 3: Commit**

```bash
git add frontend/src/features/registry/ frontend/src/App.jsx
git commit -m "feat(frontend): implement inspection report form with file upload"
```

---

## Phase 2 — Workflows

### Task 14: Committees Management Page

**Files:**
- Create: `frontend/src/features/registry/pages/CommitteesPage.jsx`
- Create: `frontend/src/features/registry/components/CommitteeManager.jsx`

Committee CRUD UI: list, create dialog, member management (search users, assign roles), structure assignment. Uses `committeesApi`.

---

### Task 15: Licensing Workflow

**Files:**
- Modify: `backend/my_project/registry/routes.py` (add license date parsing)
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx` (license tab)

License tab on structure detail: license history, create new license, visual expiry timeline.

---

### Task 16: Document Lifecycle (Status Transitions)

**Files:**
- Modify: `backend/my_project/inspections/routes.py`
- Modify: `backend/my_project/oversight/routes.py`
- Frontend: status badges, transition buttons (Submit/Approve/Return)

Implement status state machine: draft → submitted → approved/returned.

---

### Task 17: Sanctions Workflow

**Files:**
- Create: `frontend/src/features/registry/components/SanctionForm.jsx`
- Modify: structure detail page sanctions tab

Sanction CRUD UI + status management (imposed/paid/appealed/cancelled).

---

### Task 18: Notifications Integration

**Files:**
- Modify: `backend/my_project/oversight/routes.py`
- Modify: existing notification creation helpers

Trigger notifications using existing `Notification` model for:
- License expiry warnings (3/6 months)
- New structure assignment
- Report submission/approval/return
- Committee appointment

---

## Phase 3 — Reports & Dashboard

### Task 19: Oversight Dashboard

**Files:**
- Modify: `backend/my_project/oversight/routes.py` (dashboard endpoint)
- Create: `frontend/src/features/registry/pages/OversightDashboardPage.jsx`
- Create: `frontend/src/features/registry/components/StatsCards.jsx`
- Create: `frontend/src/features/registry/components/OversightCharts.jsx`

Dashboard with:
- Stats cards (total structures, active, inspections this year, reports, sanctions)
- Alerts panel (expiring licenses, pending reports)
- Charts (Recharts): inspections/month, structures by type, sanctions trend
- Quick access: 5 most recent inspections, 5 most recent reports

---

### Task 20: Structure Timeline

**Files:**
- Modify: `backend/my_project/registry/routes.py` (timeline endpoint)
- Complete: `frontend/src/features/registry/components/StructureTimeline.jsx`

`GET /api/structures/<id>/timeline` merges and sorts all events (inspections, reports, licenses, sanctions) chronologically. Frontend renders as vertical timeline.

---

### Task 21: PDF/XLSX Report Generation

**Files:**
- Modify: `backend/my_project/oversight/reports.py`
- Modify: `backend/requirements.txt` (add reportlab, openpyxl)
- Create: `frontend/src/features/registry/pages/ReportsPage.jsx`

Backend: `reportlab` for PDF, `openpyxl` for XLSX. Reports:
- Registry status (all structures + license status)
- Pending inspections
- Inspection statistics (by type, month, committee)
- Sanctions statistics
- Annual summary

Frontend: ReportsPage with type selector, date range filters, format toggle (PDF/XLSX), download button.

---

## Phase 4 — Maturity

### Task 22: Structured Forms (instead of file upload)

Replace simple file upload with structured form fields per inspection category. Fields vary by structure type (ΜΦΗ has different criteria than ΚΔΑΠ).

### Task 23: Inline AI Assistant

Sidebar panel in advisor report form. User can ask the AI assistant questions while writing (e.g., "Τι προβλέπει ο νόμος για τη δυναμικότητα ΜΦΗ;"). Uses existing `/api/chat` endpoint.

### Task 24: Auto-tags for Legislation

Link structure types to relevant legislation documents via tags/categories in the existing knowledge base. Display on structure detail page.

### Task 25: Forum Categories per Structure Type

Seed forum categories: "Εποπτεία ΜΦΗ", "Αδειοδότηση ΚΔΑΠ", etc. Link from structure detail page.

### Task 26: Multi-tenant (Peripheral Units)

Add `peripheral_unit` field to User and Structure. Data isolation per unit. Director sees only their unit's data. Admin sees all.

---

## Appendix A: File Paths Reference

### Backend (new files)
```
backend/my_project/registry/__init__.py
backend/my_project/registry/models.py
backend/my_project/registry/routes.py
backend/my_project/registry/permissions.py
backend/my_project/inspections/__init__.py
backend/my_project/inspections/models.py
backend/my_project/inspections/routes.py
backend/my_project/inspections/permissions.py
backend/my_project/oversight/__init__.py
backend/my_project/oversight/models.py
backend/my_project/oversight/routes.py
backend/my_project/oversight/reports.py
backend/scripts/seed_registry.py
```

### Backend (modified files)
```
backend/my_project/__init__.py (register 3 new blueprints + model imports + seed data)
backend/requirements.txt (add reportlab, openpyxl in Phase 3)
conftest.py (add staff_headers, director_headers fixtures)
```

### Frontend (new files)
```
frontend/src/features/registry/lib/registryApi.js
frontend/src/features/registry/lib/constants.js
frontend/src/features/registry/hooks/useStructures.js
frontend/src/features/registry/hooks/useInspections.js
frontend/src/features/registry/hooks/useOversightStats.js
frontend/src/features/registry/components/StructureTable.jsx
frontend/src/features/registry/components/LicenseBadge.jsx
frontend/src/features/registry/components/StructureTimeline.jsx
frontend/src/features/registry/components/InspectionForm.jsx
frontend/src/features/registry/components/AdvisorReportForm.jsx
frontend/src/features/registry/components/CommitteeManager.jsx
frontend/src/features/registry/components/SanctionForm.jsx
frontend/src/features/registry/components/StatsCards.jsx
frontend/src/features/registry/components/OversightCharts.jsx
frontend/src/features/registry/pages/RegistryListPage.jsx
frontend/src/features/registry/pages/StructureDetailPage.jsx
frontend/src/features/registry/pages/StructureFormPage.jsx
frontend/src/features/registry/pages/InspectionsPage.jsx
frontend/src/features/registry/pages/InspectionReportPage.jsx
frontend/src/features/registry/pages/CommitteesPage.jsx
frontend/src/features/registry/pages/OversightDashboardPage.jsx
frontend/src/features/registry/pages/ReportsPage.jsx
```

### Frontend (modified files)
```
frontend/src/App.jsx (routes + navigation)
```

### Tests (new files)
```
tests/test_registry/__init__.py
tests/test_registry/test_models.py
tests/test_registry/test_inspection_models.py
tests/test_registry/test_oversight_models.py
tests/test_registry/test_structures_api.py
tests/test_registry/test_inspections_api.py
tests/test_registry/test_oversight_api.py
```

## Appendix B: Test Commands

```bash
# All tests
python -m pytest tests/ -v

# Registry tests only
python -m pytest tests/test_registry/ -v

# Specific test file
python -m pytest tests/test_registry/test_structures_api.py -v

# With coverage
python -m pytest tests/ --cov=backend/my_project --cov-report=html
```
