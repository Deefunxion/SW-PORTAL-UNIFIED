# OPS Module Completion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete the remaining OPS (Oversight/Registry/Inspections/Sanctions) subsystems by building the sanctions engine, checklist templates, interoperability mock layer, and wiring the frontend to all real APIs.

**Architecture:** Modular monolith — each new capability lives in its own sub-module under `backend/my_project/`. New models share the existing `db` from `extensions.py`. New blueprints registered in `create_app()`. Frontend feature pages under `frontend/src/features/registry/`. The mockup branch (`unified-portal/main`) is a **design reference only** — we do NOT merge it because the existing JSX pages are already more complete and connected to real APIs.

**Tech Stack:** Flask 3.x, SQLAlchemy, PostgreSQL+pgvector, React 18, Vite, shadcn/ui, Tailwind CSS, Recharts, Framer Motion

---

## Current State Assessment

### Already Built (Backend)
- **Registry module** (`registry/`): Structure, StructureType, License, Sanction models + CRUD routes + timeline + permissions
- **Inspections module** (`inspections/`): InspectionCommittee, CommitteeMembership, CommitteeStructureAssignment, Inspection, InspectionReport models + full CRUD routes + report submission with file upload
- **Oversight module** (`oversight/`): UserRole, SocialAdvisorReport models + advisor report CRUD + approval workflow + dashboard aggregation + alerts + PDF/XLSX report generation
- **Notifications** (`oversight/notifications.py`): report submitted, report decision, committee appointment
- **Integrations** (`integrations/irida_export.py`): IRIDA-compatible ZIP export
- **Seed data** (`seed_demo.py`): 6 users, 6 structure types, 8 structures, 7 licenses, 2 committees, 7 inspections, 4 reports, 3 sanctions, 3 advisor reports, 8 forum discussions, notifications

### Already Built (Frontend — ~4,137 lines)
- 8 pages: RegistryListPage, StructureDetailPage, StructureFormPage, InspectionReportPage, AdvisorReportPage, CommitteesPage, OversightDashboardPage, ReportsPage
- 12 components: AdvisorReportForm, AiSidebar, CommitteeManager, InspectionChecklist, InspectionForm, LegislationPanel, LicenseBadge, OversightCharts, SanctionForm, StatsCards, StructureTable, StructureTimeline
- Routes integrated in App.jsx, navigation includes "Εποπτεία" tab

### What's Missing (from OPS_KM_Design_Report.md)
1. **SanctionRule model + fine calculation engine** — rules-based fine calculation with recidivism escalation
2. **Sanctions workflow endpoints** — draft→submitted→approved→certified→paid lifecycle
3. **ChecklistTemplate model** — per-structure-type inspection checklists stored in DB
4. **Interop module** — mock services for ΑΑΔΕ, ΙΡΙΔΑ protocol, criminal records, accounting
5. **Dedicated SanctionsPage** — fine calculator UI + sanctions list (mockup reference in `unified-portal`)
6. **AfmLookup component** — ΑΦΜ lookup in StructureFormPage
7. **Enhanced seed data** — more structures (15-20 total), sanction rules, checklist templates
8. **Enhanced Sanction model** — violation_category, base_amount, escalation_multiplier, final_amount, legal_basis, recidivism_count, appeal_deadline fields

### Design Reference (DO NOT MERGE)
The `unified-portal/main` branch contains TypeScript mockup pages with hardcoded data. Use as **visual/UX reference only**:
- `src/pages/SanctionsPage.tsx` → fine calculator layout (left: calculator, right: recent sanctions table)
- `src/data/mockData.ts` → `violationTypes` (10 types with base fines), `checklistGroups` (4 categories), `recentSanctions` (8 entries)
- `src/pages/OversightDashboardPage.tsx` → KPI cards + charts + alerts layout

---

## Phase 1: Sanctions Engine (Backend)

### Task 1.1: Create SanctionRule Model

**Files:**
- Create: `backend/my_project/sanctions/__init__.py`
- Create: `backend/my_project/sanctions/models.py`
- Test: `tests/test_sanctions/test_models.py`

**Step 1: Create the sanctions module package**

```python
# backend/my_project/sanctions/__init__.py
from flask import Blueprint

sanctions_bp = Blueprint('sanctions', __name__)

from . import routes  # noqa: E402, F401
```

**Step 2: Write the SanctionRule model**

```python
# backend/my_project/sanctions/models.py
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
```

**Step 3: Write test for SanctionRule creation**

```python
# tests/test_sanctions/test_models.py
def test_sanction_rule_to_dict(client, app):
    from my_project.sanctions.models import SanctionRule
    from my_project.extensions import db
    with app.app_context():
        rule = SanctionRule(
            violation_code='NO_LICENSE',
            violation_name='Λειτουργία χωρίς άδεια',
            base_fine=10000.0,
            legal_reference='Ν.4756/2020, Άρθρο 42'
        )
        db.session.add(rule)
        db.session.commit()
        d = rule.to_dict()
        assert d['violation_code'] == 'NO_LICENSE'
        assert d['base_fine'] == 10000.0
```

**Step 4: Run test**

Run: `python -m pytest tests/test_sanctions/test_models.py -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/my_project/sanctions/ tests/test_sanctions/
git commit -m "feat(sanctions): add SanctionRule model"
```

---

### Task 1.2: Create Fine Calculator Engine

**Files:**
- Create: `backend/my_project/sanctions/calculator.py`
- Test: `tests/test_sanctions/test_calculator.py`

**Step 1: Write calculator tests**

```python
# tests/test_sanctions/test_calculator.py
def test_calculate_fine_first_offense(client, app):
    """First offense should use base fine (multiplier 1)."""
    from my_project.sanctions.calculator import calculate_fine
    from my_project.sanctions.models import SanctionRule
    from my_project.registry.models import Structure
    from my_project.extensions import db

    with app.app_context():
        rule = SanctionRule.query.filter_by(violation_code='NO_LICENSE').first()
        if not rule:
            rule = SanctionRule(violation_code='NO_LICENSE', violation_name='Test',
                                base_fine=10000.0, escalation_2nd=2.0, escalation_3rd_plus=3.0)
            db.session.add(rule)
            db.session.commit()

        structure = Structure.query.first()
        result = calculate_fine(rule.violation_code, structure.id)
        assert result['base_fine'] == 10000.0
        assert result['recidivism_count'] == 0
        assert result['multiplier'] == 1.0
        assert result['final_amount'] == 10000.0


def test_calculate_fine_with_recidivism(client, app):
    """Second offense of same type should use escalation_2nd multiplier."""
    from my_project.sanctions.calculator import calculate_fine
    from my_project.sanctions.models import SanctionRule
    from my_project.registry.models import Structure, Sanction
    from my_project.extensions import db

    with app.app_context():
        rule = SanctionRule.query.filter_by(violation_code='NO_LICENSE').first()
        structure = Structure.query.first()

        # Create a prior sanction for the same violation
        prior = Sanction(structure_id=structure.id, type='fine',
                         amount=10000, status='imposed',
                         notes='violation_code:NO_LICENSE')
        db.session.add(prior)
        db.session.commit()

        result = calculate_fine(rule.violation_code, structure.id)
        assert result['recidivism_count'] >= 1
        assert result['multiplier'] == 2.0
        assert result['final_amount'] == 20000.0
```

**Step 2: Implement calculator**

```python
# backend/my_project/sanctions/calculator.py
from ..registry.models import Sanction
from .models import SanctionRule


def calculate_fine(violation_code, structure_id):
    """Calculate fine based on violation rules and recidivism history.

    Returns dict with: base_fine, multiplier, final_amount, legal_basis,
    recidivism_count, can_trigger_suspension.
    """
    rule = SanctionRule.query.filter_by(
        violation_code=violation_code, is_active=True
    ).first()
    if not rule:
        raise ValueError(f'No active rule for violation code: {violation_code}')

    # Count prior sanctions of the same violation type for this structure
    prior_count = Sanction.query.filter(
        Sanction.structure_id == structure_id,
        Sanction.notes.contains(f'violation_code:{violation_code}'),
        Sanction.status.notin_(['cancelled']),
    ).count()

    # Determine multiplier based on recidivism
    if prior_count == 0:
        multiplier = 1.0
    elif prior_count == 1:
        multiplier = rule.escalation_2nd
    else:
        multiplier = rule.escalation_3rd_plus

    final_amount = rule.base_fine * multiplier

    return {
        'violation_code': violation_code,
        'violation_name': rule.violation_name,
        'base_fine': rule.base_fine,
        'multiplier': multiplier,
        'final_amount': final_amount,
        'legal_basis': rule.legal_reference,
        'recidivism_count': prior_count,
        'can_trigger_suspension': (
            rule.can_trigger_suspension and
            prior_count + 1 >= rule.suspension_threshold
        ),
    }
```

**Step 3: Run tests**

Run: `python -m pytest tests/test_sanctions/ -v`
Expected: PASS

**Step 4: Commit**

```bash
git add backend/my_project/sanctions/calculator.py tests/test_sanctions/test_calculator.py
git commit -m "feat(sanctions): add fine calculator with recidivism escalation"
```

---

### Task 1.3: Sanctions API Routes

**Files:**
- Create: `backend/my_project/sanctions/routes.py`
- Test: `tests/test_sanctions/test_routes.py`

**Step 1: Write route tests**

```python
# tests/test_sanctions/test_routes.py
def test_list_sanction_rules(client, auth_headers):
    resp = client.get('/api/sanction-rules', headers=auth_headers)
    assert resp.status_code == 200

def test_calculate_fine_endpoint(client, auth_headers, app):
    from my_project.sanctions.models import SanctionRule
    from my_project.registry.models import Structure
    from my_project.extensions import db
    with app.app_context():
        rule = SanctionRule.query.first()
        structure = Structure.query.first()

    resp = client.post('/api/sanctions/calculate', headers=auth_headers, json={
        'violation_code': rule.violation_code if rule else 'NO_LICENSE',
        'structure_id': structure.id if structure else 1,
    })
    assert resp.status_code in (200, 404)  # 404 if no rule seeded in test DB
```

**Step 2: Implement routes**

```python
# backend/my_project/sanctions/routes.py
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import sanctions_bp
from ..extensions import db
from .models import SanctionRule
from .calculator import calculate_fine


@sanctions_bp.route('/api/sanction-rules', methods=['GET'])
@jwt_required()
def list_sanction_rules():
    rules = SanctionRule.query.filter_by(is_active=True).all()
    return jsonify([r.to_dict() for r in rules]), 200


@sanctions_bp.route('/api/sanction-rules', methods=['POST'])
@jwt_required()
def create_sanction_rule():
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    data = request.get_json()
    rule = SanctionRule(
        violation_code=data['violation_code'],
        violation_name=data['violation_name'],
        description=data.get('description'),
        base_fine=data['base_fine'],
        escalation_2nd=data.get('escalation_2nd', 2.0),
        escalation_3rd_plus=data.get('escalation_3rd_plus', 3.0),
        can_trigger_suspension=data.get('can_trigger_suspension', False),
        suspension_threshold=data.get('suspension_threshold', 3),
        legal_reference=data.get('legal_reference'),
        structure_type_id=data.get('structure_type_id'),
    )
    db.session.add(rule)
    db.session.commit()
    return jsonify(rule.to_dict()), 201


@sanctions_bp.route('/api/sanctions/calculate', methods=['POST'])
@jwt_required()
def calculate_fine_endpoint():
    """Preview fine calculation without creating a sanction."""
    data = request.get_json()
    violation_code = data.get('violation_code')
    structure_id = data.get('structure_id')

    if not violation_code or not structure_id:
        return jsonify({'error': 'violation_code and structure_id required'}), 400

    try:
        result = calculate_fine(violation_code, structure_id)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 404
```

**Step 3: Register blueprint in create_app()**

Add to `backend/my_project/__init__.py` after existing blueprint registrations:
```python
from .sanctions import sanctions_bp
app.register_blueprint(sanctions_bp)
```

Also import SanctionRule in the model imports block:
```python
from .sanctions.models import SanctionRule
```

**Step 4: Run tests**

Run: `python -m pytest tests/test_sanctions/ -v`
Expected: PASS

**Step 5: Commit**

```bash
git add backend/my_project/sanctions/routes.py backend/my_project/__init__.py tests/test_sanctions/
git commit -m "feat(sanctions): add sanction rules API and fine calculation endpoint"
```

---

### Task 1.4: Seed SanctionRule Data

**Files:**
- Modify: `backend/my_project/seed_demo.py` — add sanction rules section

**Step 1: Add sanction rules to seed_demo.py**

After the existing sanctions section, add:

```python
    # ─── SANCTION RULES ──────────────────────────────────────
    from .sanctions.models import SanctionRule

    rules_data = [
        ('NO_LICENSE', 'Λειτουργία χωρίς άδεια', 10000, 2.0, 3.0, True, 2, 'Ν.4756/2020, Άρθρο 42, §1'),
        ('OVER_CAPACITY', 'Υπέρβαση δυναμικότητας', 5000, 2.0, 3.0, True, 3, 'Ν.4756/2020, Άρθρο 42, §2'),
        ('STAFF_RATIO', 'Ελλιπής στελέχωση', 3000, 2.0, 3.0, False, 0, 'Ν.4756/2020, Άρθρο 38, §4'),
        ('FIRE_SAFETY', 'Παραβίαση πυρασφάλειας', 8000, 2.0, 3.0, True, 2, 'Ν.4756/2020, Άρθρο 42, §3'),
        ('HYGIENE', 'Παραβίαση υγιεινής', 4000, 2.0, 3.0, False, 0, 'Ν.4756/2020, Άρθρο 39, §2'),
        ('MISSING_DOCS', 'Έλλειψη τεκμηρίωσης', 2000, 1.5, 2.0, False, 0, 'Ν.4756/2020, Άρθρο 40, §1'),
        ('NO_INCIDENT_REPORT', 'Μη αναφορά συμβάντος', 5000, 2.0, 3.0, True, 3, 'Ν.4756/2020, Άρθρο 41, §2'),
        ('UNAUTHORIZED_MODS', 'Μη εξουσιοδοτημένες τροποποιήσεις', 6000, 2.0, 3.0, False, 0, 'Ν.4756/2020, Άρθρο 36, §5'),
        ('ACCESSIBILITY', 'Παραβίαση προσβασιμότητας', 4000, 2.0, 2.5, False, 0, 'Ν.4756/2020, Άρθρο 37, §3'),
        ('NON_COMPLIANCE', 'Μη συμμόρφωση σε υποδείξεις', 3000, 2.0, 3.0, True, 3, 'Ν.4756/2020, Άρθρο 43, §1'),
    ]
    for code, name, base, esc2, esc3, can_suspend, threshold, legal in rules_data:
        if not SanctionRule.query.filter_by(violation_code=code).first():
            db.session.add(SanctionRule(
                violation_code=code, violation_name=name, base_fine=base,
                escalation_2nd=esc2, escalation_3rd_plus=esc3,
                can_trigger_suspension=can_suspend, suspension_threshold=threshold,
                legal_reference=legal,
            ))
```

**Step 2: Run backend to verify seeding**

Run: `python backend/app.py` (verify "[seed]" output includes rules)

**Step 3: Commit**

```bash
git add backend/my_project/seed_demo.py
git commit -m "feat(seed): add 10 sanction rules with Greek legislation references"
```

---

## Phase 2: Checklist Templates (Backend)

### Task 2.1: Create ChecklistTemplate Model

**Files:**
- Create: `backend/my_project/inspections/checklist.py` (or add to existing models.py)
- Test: `tests/test_inspections/test_checklist.py`

**Step 1: Add ChecklistTemplate to inspections models**

Add to `backend/my_project/inspections/models.py`:

```python
class ChecklistTemplate(db.Model):
    __tablename__ = 'checklist_templates'
    id = db.Column(db.Integer, primary_key=True)
    structure_type_id = db.Column(db.Integer, db.ForeignKey('structure_types.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    version = db.Column(db.Integer, default=1)
    items = db.Column(db.JSON, nullable=False)  # list of check item objects
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
```

**Step 2: Add checklist template endpoints to inspections routes**

Add to `backend/my_project/inspections/routes.py`:

```python
from .models import ChecklistTemplate

@inspections_bp.route('/api/checklist-templates', methods=['GET'])
@jwt_required()
def list_checklist_templates():
    templates = ChecklistTemplate.query.filter_by(is_active=True).all()
    return jsonify([t.to_dict() for t in templates]), 200


@inspections_bp.route('/api/checklist-templates/<int:type_id>', methods=['GET'])
@jwt_required()
def get_checklist_for_type(type_id):
    template = ChecklistTemplate.query.filter_by(
        structure_type_id=type_id, is_active=True
    ).order_by(ChecklistTemplate.version.desc()).first()
    if not template:
        return jsonify({'error': 'No checklist template for this type'}), 404
    return jsonify(template.to_dict()), 200
```

**Step 3: Import in create_app()**

Add `ChecklistTemplate` to the model imports in `__init__.py`.

**Step 4: Write tests and run**

Run: `python -m pytest tests/test_inspections/ -v`

**Step 5: Commit**

```bash
git add backend/my_project/inspections/models.py backend/my_project/inspections/routes.py backend/my_project/__init__.py
git commit -m "feat(inspections): add ChecklistTemplate model and API endpoints"
```

---

### Task 2.2: Seed Checklist Templates

**Files:**
- Modify: `backend/my_project/seed_demo.py`

**Step 1: Add checklist templates for MFH and KDAP**

```python
    # ─── CHECKLIST TEMPLATES ─────────────────────────────────
    from .inspections.models import ChecklistTemplate

    mfh_checklist = {
        'name': 'Πρότυπο Ελέγχου ΜΦΗ',
        'type_code': 'MFH',
        'items': [
            {'category': 'Κτιριολογικά & Ασφάλεια', 'items': [
                {'id': 'B01', 'description': 'Πιστοποιητικό πυρασφάλειας σε ισχύ', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §36'},
                {'id': 'B02', 'description': 'Προσβασιμότητα ΑμεΑ (ράμπες, ανελκυστήρας)', 'is_required': True, 'legal_ref': 'Ν.4067/2012'},
                {'id': 'B03', 'description': 'Επαρκής φυσικός φωτισμός και αερισμός', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
                {'id': 'B04', 'description': 'Σήμανση εξόδων κινδύνου', 'is_required': True, 'legal_ref': 'ΠΔ 71/88'},
                {'id': 'B05', 'description': 'Καταλληλότητα χώρων υγιεινής', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            ]},
            {'category': 'Στελέχωση', 'items': [
                {'id': 'S01', 'description': 'Τήρηση αναλογίας προσωπικού/ωφελουμένων', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
                {'id': 'S02', 'description': 'Πτυχία και άδειες ασκήσεως σε ισχύ', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
                {'id': 'S03', 'description': 'Παρουσία νοσηλευτή κατά τη διάρκεια λειτουργίας', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
                {'id': 'S04', 'description': 'Πρόγραμμα εκπαίδευσης προσωπικού', 'is_required': False, 'legal_ref': ''},
            ]},
            {'category': 'Υγιεινή & Διατροφή', 'items': [
                {'id': 'H01', 'description': 'Πιστοποιητικό υγείας τροφίμων (HACCP)', 'is_required': True, 'legal_ref': 'Κανονισμός (ΕΚ) 852/2004'},
                {'id': 'H02', 'description': 'Καθαριότητα χώρων (κοινόχρηστοι, κουζίνα, W/C)', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
                {'id': 'H03', 'description': 'Τήρηση διαιτολογίου εγκεκριμένου από διαιτολόγο', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §39'},
                {'id': 'H04', 'description': 'Σωστή αποθήκευση φαρμάκων', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            ]},
            {'category': 'Τεκμηρίωση', 'items': [
                {'id': 'D01', 'description': 'Ατομικοί φάκελοι ωφελουμένων ενημερωμένοι', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §40'},
                {'id': 'D02', 'description': 'Βιβλίο συμβάντων ενημερωμένο', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §41'},
                {'id': 'D03', 'description': 'Σύμβαση εργασίας κάθε εργαζόμενου', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
                {'id': 'D04', 'description': 'Ασφαλιστική ενημερότητα', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
            ]},
        ],
    }

    kdap_checklist = {
        'name': 'Πρότυπο Ελέγχου ΚΔΑΠ',
        'type_code': 'KDAP',
        'items': [
            {'category': 'Κτιριολογικά & Ασφάλεια', 'items': [
                {'id': 'B01', 'description': 'Πιστοποιητικό πυρασφάλειας σε ισχύ', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §36'},
                {'id': 'B02', 'description': 'Ασφάλεια εξωτερικών χώρων (αυλή, περίφραξη)', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
                {'id': 'B03', 'description': 'Καταλληλότητα χώρων για ηλικιακή ομάδα', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
                {'id': 'B04', 'description': 'Σήμανση εξόδων κινδύνου', 'is_required': True, 'legal_ref': 'ΠΔ 71/88'},
            ]},
            {'category': 'Στελέχωση', 'items': [
                {'id': 'S01', 'description': 'Τήρηση αναλογίας παιδαγωγών/παιδιών (1:25)', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
                {'id': 'S02', 'description': 'Πτυχία παιδαγωγών σε ισχύ', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
                {'id': 'S03', 'description': 'Πιστοποίηση πρώτων βοηθειών', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            ]},
            {'category': 'Υγιεινή', 'items': [
                {'id': 'H01', 'description': 'Καθαριότητα χώρων & WC', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
                {'id': 'H02', 'description': 'Διαθεσιμότητα φαρμακείου πρώτων βοηθειών', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
                {'id': 'H03', 'description': 'Ασφάλεια υλικών δημιουργικής απασχόλησης', 'is_required': True, 'legal_ref': 'ΕΚ Directive 2009/48/EC'},
            ]},
            {'category': 'Τεκμηρίωση', 'items': [
                {'id': 'D01', 'description': 'Φάκελοι παιδιών με στοιχεία γονέων/κηδεμόνων', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §40'},
                {'id': 'D02', 'description': 'Πρόγραμμα δραστηριοτήτων', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §40'},
                {'id': 'D03', 'description': 'Βιβλίο συμβάντων', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §41'},
                {'id': 'D04', 'description': 'Ασφαλιστική ενημερότητα', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
            ]},
        ],
    }

    for tpl_data in [mfh_checklist, kdap_checklist]:
        stype = StructureType.query.filter_by(code=tpl_data['type_code']).first()
        if stype and not ChecklistTemplate.query.filter_by(
            structure_type_id=stype.id, is_active=True
        ).first():
            db.session.add(ChecklistTemplate(
                structure_type_id=stype.id,
                name=tpl_data['name'],
                items=tpl_data['items'],
            ))
```

**Step 2: Commit**

```bash
git add backend/my_project/seed_demo.py
git commit -m "feat(seed): add MFH and KDAP checklist templates with Greek legislation refs"
```

---

## Phase 3: Interop Mock Services (Backend)

### Task 3.1: Create Interop Module

**Files:**
- Create: `backend/my_project/interop/__init__.py`
- Create: `backend/my_project/interop/models.py` (InteropLog)
- Create: `backend/my_project/interop/base.py` (abstract service)
- Create: `backend/my_project/interop/aade.py` (ΑΦΜ lookup mock)
- Create: `backend/my_project/interop/mock_data.py` (Greek mock data)
- Create: `backend/my_project/interop/routes.py`
- Test: `tests/test_interop/test_aade.py`

**Step 1: InteropLog model**

```python
# backend/my_project/interop/models.py
from datetime import datetime
from ..extensions import db


class InteropLog(db.Model):
    __tablename__ = 'interop_logs'
    id = db.Column(db.Integer, primary_key=True)
    service_name = db.Column(db.String(50), nullable=False)
    request_type = db.Column(db.String(50), nullable=False)
    request_data = db.Column(db.JSON, nullable=True)
    response_data = db.Column(db.JSON, nullable=True)
    status = db.Column(db.String(20), default='success')
    response_time_ms = db.Column(db.Integer, nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'service_name': self.service_name,
            'request_type': self.request_type,
            'request_data': self.request_data,
            'response_data': self.response_data,
            'status': self.status,
            'response_time_ms': self.response_time_ms,
            'user_id': self.user_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
```

**Step 2: Abstract base + ΑΑΔΕ mock**

```python
# backend/my_project/interop/base.py
from abc import ABC, abstractmethod


class InteropService(ABC):
    @abstractmethod
    def lookup(self, query):
        pass

    @abstractmethod
    def verify(self, data):
        pass
```

```python
# backend/my_project/interop/mock_data.py
"""Realistic Greek mock data for interoperability services."""

AFM_DATABASE = {
    '012345678': {
        'name': 'ΕΛΕΝΗ ΔΗΜΗΤΡΙΟΥ',
        'legal_form': 'Ατομική Επιχείρηση',
        'address': 'Λεωφ. Κηφισίας 142, Αθήνα, 11525',
        'doy': 'ΔΟΥ Χολαργού',
        'activity': 'Υπηρεσίες κοινωνικής μέριμνας χωρίς παροχή καταλύματος',
        'status': 'Ενεργή',
    },
    '987654321': {
        'name': 'ΕΥΑΓΓΕΛΙΣΜΟΣ Α.Ε.',
        'legal_form': 'Ανώνυμη Εταιρεία',
        'address': 'Ακτή Μιαούλη 55, Πειραιάς, 18535',
        'doy': 'ΔΟΥ Πειραιά',
        'activity': 'Δραστηριότητες νοσοκομείων και κλινικών',
        'status': 'Ενεργή',
    },
    '456789123': {
        'name': 'ΔΗΜΟΣ ΑΘΗΝΑΙΩΝ — ΚΔΑΠ ΧΑΜΟΓΕΛΟ',
        'legal_form': 'ΝΠΔΔ',
        'address': 'Αχαρνών 78, Αθήνα, 10438',
        'doy': 'ΔΟΥ Α\' Αθηνών',
        'activity': 'Δραστηριότητες κοινωνικής μέριμνας με παροχή καταλύματος',
        'status': 'Ενεργή',
    },
    '654321789': {
        'name': 'ΕΛΠΙΔΑ — ΜΚΟ',
        'legal_form': 'Αστική Μη Κερδοσκοπική Εταιρεία',
        'address': 'Πατησίων 200, Αθήνα, 11256',
        'doy': 'ΔΟΥ Κ\' Αθηνών',
        'activity': 'Υπηρεσίες κοινωνικής μέριμνας ΑμεΑ',
        'status': 'Ενεργή',
    },
}

CRIMINAL_RECORD_CLEAN = {
    'status': 'clean',
    'message': 'Δεν υφίστανται ποινικές καταδίκες.',
    'issued_date': '2026-02-15',
    'valid_until': '2026-05-15',
}
```

```python
# backend/my_project/interop/aade.py
from .base import InteropService
from .mock_data import AFM_DATABASE


class AADEService(InteropService):
    """Mock ΑΑΔΕ/ΓΕΜΗ integration for ΑΦΜ lookup."""

    def lookup(self, afm):
        data = AFM_DATABASE.get(afm)
        if data:
            return {'found': True, **data}
        return {'found': False, 'message': f'ΑΦΜ {afm} δεν βρέθηκε στο μητρώο ΑΑΔΕ'}

    def verify(self, data):
        return {'verified': data.get('afm') in AFM_DATABASE}
```

**Step 3: Routes**

```python
# backend/my_project/interop/routes.py
import time
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from . import interop_bp
from ..extensions import db
from .models import InteropLog
from .aade import AADEService


@interop_bp.route('/api/interop/aade/lookup', methods=['POST'])
@jwt_required()
def aade_lookup():
    user_id = int(get_jwt_identity())
    data = request.get_json()
    afm = data.get('afm', '').strip()
    if not afm or len(afm) != 9:
        return jsonify({'error': 'ΑΦΜ πρέπει να είναι 9 ψηφία'}), 400

    start = time.time()
    service = AADEService()
    result = service.lookup(afm)
    elapsed = int((time.time() - start) * 1000)

    log = InteropLog(
        service_name='aade', request_type='lookup',
        request_data={'afm': afm}, response_data=result,
        status='success' if result.get('found') else 'not_found',
        response_time_ms=elapsed, user_id=user_id,
    )
    db.session.add(log)
    db.session.commit()

    return jsonify(result), 200


@interop_bp.route('/api/interop/log', methods=['GET'])
@jwt_required()
def interop_log():
    user_id = int(get_jwt_identity())
    from ..models import User
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    logs = InteropLog.query.order_by(InteropLog.created_at.desc()).limit(50).all()
    return jsonify([l.to_dict() for l in logs]), 200
```

**Step 4: Register blueprint**

```python
# backend/my_project/interop/__init__.py
from flask import Blueprint
interop_bp = Blueprint('interop', __name__)
from . import routes  # noqa
```

Add to `create_app()`:
```python
from .interop import interop_bp
app.register_blueprint(interop_bp)
```

**Step 5: Test, verify, commit**

Run: `python -m pytest tests/test_interop/ -v`

```bash
git add backend/my_project/interop/ tests/test_interop/ backend/my_project/__init__.py
git commit -m "feat(interop): add mock ΑΑΔΕ/ΓΕΜΗ service with InteropLog auditing"
```

---

## Phase 4: Frontend — Sanctions Page

### Task 4.1: Create SanctionsPage with Fine Calculator

**Files:**
- Create: `frontend/src/features/registry/pages/SanctionsPage.jsx`
- Modify: `frontend/src/App.jsx` — add route

**Design reference:** `unified-portal/main:src/pages/SanctionsPage.tsx` — two-column layout: left = interactive fine calculator with dropdowns for violation type and structure, right = recent sanctions table with status badges.

**Step 1: Build SanctionsPage**

The page should:
1. Fetch sanction rules from `GET /api/sanction-rules`
2. Fetch structures from `GET /api/structures`
3. On selection, call `POST /api/sanctions/calculate` to get fine breakdown
4. Display: base fine, recidivism multiplier, final amount, legal basis
5. "Create Sanction" button calls existing `POST /api/structures/{id}/sanctions`
6. Right side: table of recent sanctions from `GET /api/structures/{id}/sanctions`

Use the mockup TSX as visual reference but implement in JSX with the existing shadcn/ui components (Select, Card, Badge, Table) and the existing `api.js` client.

**Step 2: Add route in App.jsx**

```jsx
import SanctionsPage from '@/features/registry/pages/SanctionsPage';
// ...
<Route path="/sanctions" element={
  <ProtectedRoute><SanctionsPage /></ProtectedRoute>
} />
```

**Step 3: Add navigation link** (optional — link from OversightDashboard or StructureDetail)

**Step 4: Test manually in browser**

**Step 5: Commit**

```bash
git add frontend/src/features/registry/pages/SanctionsPage.jsx frontend/src/App.jsx
git commit -m "feat(frontend): add SanctionsPage with interactive fine calculator"
```

---

### Task 4.2: Wire InspectionChecklist to ChecklistTemplate API

**Files:**
- Modify: `frontend/src/features/registry/components/InspectionChecklist.jsx`

**Step 1: Update InspectionChecklist to fetch from API**

Currently the checklist is likely hardcoded or uses static data. Update it to:
1. Accept `structureTypeId` prop
2. Fetch `GET /api/checklist-templates/{type_id}` on mount
3. Render the checklist dynamically from the API response
4. Each item has: checkbox (compliant/violation/n-a), notes field, optional photo

**Step 2: Test with MFH and KDAP structures**

**Step 3: Commit**

```bash
git add frontend/src/features/registry/components/InspectionChecklist.jsx
git commit -m "feat(frontend): wire InspectionChecklist to ChecklistTemplate API"
```

---

## Phase 5: Frontend — Interop & Enhancements

### Task 5.1: Add AfmLookup Component to StructureFormPage

**Files:**
- Create: `frontend/src/features/registry/components/AfmLookup.jsx`
- Modify: `frontend/src/features/registry/pages/StructureFormPage.jsx`

**Step 1: Build AfmLookup component**

The component should:
1. Show an input field for ΑΦΜ (9 digits)
2. On "Αναζήτηση" button click, call `POST /api/interop/aade/lookup`
3. If found: auto-fill representative name, address, legal form
4. Show a green success badge or red "not found" alert
5. Display DOY and activity info in a secondary panel

**Step 2: Integrate in StructureFormPage**

Add AfmLookup above the manual fields. When it returns data, populate the form fields via state.

**Step 3: Test with known AFM values from mock_data.py**

**Step 4: Commit**

```bash
git add frontend/src/features/registry/components/AfmLookup.jsx frontend/src/features/registry/pages/StructureFormPage.jsx
git commit -m "feat(frontend): add AfmLookup component with ΑΑΔΕ mock integration"
```

---

### Task 5.2: Add Navigation Links

**Files:**
- Modify: `frontend/src/App.jsx` — ensure all new routes are registered
- Modify: relevant pages to link to each other

**Step 1: Verify these routes exist in App.jsx:**
- `/sanctions` → SanctionsPage
- `/registry` → RegistryListPage
- `/oversight` → OversightDashboardPage
- `/committees` → CommitteesPage
- `/reports` → ReportsPage

**Step 2: Add context-aware links:**
- StructureDetailPage: link to "Κυρώσεις" tab → SanctionsPage filtered by structure
- OversightDashboard: "Κυρώσεις" stats card links to SanctionsPage
- InspectionReportPage: after completing report with violations, link to SanctionsPage

**Step 3: Commit**

```bash
git add frontend/src/App.jsx frontend/src/features/registry/pages/
git commit -m "feat(frontend): add cross-linking between registry, sanctions, and oversight pages"
```

---

## Phase 6: Additional Seed Data & Polish

### Task 6.1: Expand Seed Data to 15+ Structures

**Files:**
- Modify: `backend/my_project/seed_demo.py`

**Step 1: Add 7-8 more structures across types**

Add structures in:
- 2 more ΜΦΗ (different statuses, different cities in Attica)
- 2 more ΚΔΑΠ (one municipal, one private)
- 1 ΚΔΑΠ-ΜΕΑ (new type — add to structure_types if missing)
- 1 more ΣΥΔ
- 1 ΒΣΟΦ (new type)

Include realistic Greek names, addresses in Attica, varied license statuses (some expiring soon, one expired).

**Step 2: Add more inspections and sanctions for the new structures**

**Step 3: Verify seeding works cleanly**

Run: `python backend/app.py`

**Step 4: Commit**

```bash
git add backend/my_project/seed_demo.py
git commit -m "feat(seed): expand demo to 15+ structures with diverse statuses"
```

---

### Task 6.2: Enhanced Oversight Dashboard

**Files:**
- Modify: `frontend/src/features/registry/pages/OversightDashboardPage.jsx`
- Modify: `frontend/src/features/registry/components/StatsCards.jsx`

**Step 1: Ensure dashboard fetches from real API**

The dashboard should call `GET /api/oversight/dashboard` and `GET /api/oversight/alerts` and display:
- KPI cards: total structures, active structures, inspections this year, total sanctions
- Charts: inspections by month (bar chart), structures by type (pie chart), sanctions by status
- Alerts feed: expiring licenses, pending reports, overdue inspections
- Recent activity: latest inspections and advisor reports

**Step 2: Add links from KPI cards to relevant pages**

**Step 3: Commit**

```bash
git add frontend/src/features/registry/pages/OversightDashboardPage.jsx frontend/src/features/registry/components/StatsCards.jsx
git commit -m "feat(frontend): enhance oversight dashboard with live data and navigation"
```

---

### Task 6.3: Mobile Viewport Polish

**Files:**
- Modify: `frontend/src/features/registry/pages/InspectionReportPage.jsx`
- Modify: `frontend/src/features/registry/components/InspectionForm.jsx`

**Step 1: Test at 375px width (iPhone SE)**

Verify:
- All form inputs have min 16px font size
- Touch targets are 44px minimum
- Single-column stacked layout on mobile
- Photo upload button uses `capture="environment"` for camera access
- Select dropdowns work on mobile

**Step 2: Fix any layout issues**

**Step 3: Commit**

```bash
git add frontend/src/features/registry/
git commit -m "fix(frontend): mobile viewport polish for inspection forms"
```

---

## Phase 7: Tests & Cleanup

### Task 7.1: Backend Test Suite for New Modules

**Files:**
- Create: `tests/test_sanctions/__init__.py`
- Create: `tests/test_interop/__init__.py`
- Ensure all routes have at least smoke tests

**Step 1: Write smoke tests for every new endpoint**

Every endpoint should have at minimum:
- Unauthenticated request → 401
- Authenticated GET → 200
- POST with missing data → 400

**Step 2: Run full test suite**

Run: `python -m pytest tests/ -v --tb=short`

**Step 3: Commit**

```bash
git add tests/
git commit -m "test: add comprehensive tests for sanctions and interop modules"
```

---

### Task 7.2: Final Integration Verification

**Step 1: Reset database and verify clean startup**

```bash
docker exec sw_portal_db psql -U sw_portal -d sw_portal -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; CREATE EXTENSION vector;"
python backend/app.py
```

Verify seed output shows all data created: 15+ structures, 10 sanction rules, 2 checklist templates.

**Step 2: Verify frontend build**

```bash
cd frontend && npx pnpm build
```

Must compile with zero errors.

**Step 3: Manual walkthrough**

1. Login as admin/admin123
2. Navigate to Εποπτεία → see dashboard with charts and alerts
3. Navigate to Μητρώο → see 15+ structures
4. Click a structure → see detail with timeline, licenses, sanctions
5. Click "Νέα Δομή" → fill ΑΦΜ → AfmLookup auto-fills
6. Navigate to Κυρώσεις → select violation + structure → see fine calculation
7. Navigate to an inspection → see dynamic checklist per structure type
8. Export PDF/XLSX from Reports page

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: final integration verification — all systems operational"
```

---

## Summary of Deliverables

| Phase | Tasks | New Backend Files | New Frontend Files | New Models |
|-------|-------|------------------|--------------------|------------|
| 1 | Sanctions Engine | `sanctions/` (4 files) | — | SanctionRule |
| 2 | Checklist Templates | checklist in `inspections/` | — | ChecklistTemplate |
| 3 | Interop Module | `interop/` (6 files) | — | InteropLog |
| 4 | Frontend Sanctions | — | SanctionsPage.jsx | — |
| 5 | Frontend Interop | — | AfmLookup.jsx | — |
| 6 | Seed Data & Polish | seed_demo.py updates | Dashboard/mobile fixes | — |
| 7 | Tests & Cleanup | — | — | — |

**Total estimated new files:** ~12 backend, ~2 frontend, ~4 test files
**Total estimated commits:** ~15

---

## Critical Rules

1. **New modules ONLY** — never modify existing `models.py` or `routes.py`
2. **Register new Blueprints** in `create_app()` inside `backend/my_project/__init__.py`
3. **Import new models** in `create_app()` so `db.create_all()` creates their tables
4. **Greek UI text** for all user-facing strings
5. **TDD** — write failing test, implement, verify pass, commit
6. **Diary entry** in `DIARY.md` after each completed phase
