# Sanctions System Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the existing sanctions/fines module into a production-grade system with accurate legal framework (Ν.5041/2023), per-structure-type violation rules, 5-step approval workflow, administrative PDF generation, and OPS interoperability.

**Architecture:** Extend existing `SanctionRule` and `Sanction` models, add new `SanctionDecision` model for workflow tracking. Calculator enhanced with min/max ranges and structure-type filtering. PDF generation via ReportLab matching real Περιφέρεια Αττικής format. Export module for OPS Χρηματικός Κατάλογος integration.

**Tech Stack:** Flask/SQLAlchemy (backend), React/shadcn (frontend), ReportLab (PDF), existing JWT auth, PostgreSQL

---

## Context & References

### Legal Framework
- **Ν.5041/2023 Άρθρο 100** — Primary sanctions law for social care structures
- **Ν.2345/1995** — Original organized services law (updated by Ν.4921/2022 art. 67)
- **Ν.4555/2018 Αρ.118** — Appeal process (Ειδική Διοικητική Προσφυγή)

### Real Document Template
Based on `ΩΝ9Δ7Λ7-ΠΘΨ.pdf` — actual Περιφέρεια Αττικής fine decision for unlicensed MFH (€60,000).

Document structure:
1. **Header**: issuing authority hierarchy, protocol number, date, ADA code
2. **ΘΕΜΑ**: subject line (what, where, who)
3. **Έχοντας υπόψη**: 10-16 numbered legal references
4. **ΑΠΟΦΑΣΙΖΟΥΜΕ**: amount, obligor (name + father + AFM), reason, payment terms, revenue split, appeal rights
5. **Πίνακας Αποδεκτών**: recipients for action (obligor, ΔΟΥ, police) + notification (9 bodies)
6. **Signature**: title + name of signing authority

### System Boundaries
- **Πύλη (our system)**: Inspection → Finding → Calculation → Draft → Approval → PDF → Export
- **ΟΠΣ Περιφέρειας (external)**: Χρηματικός Κατάλογος → ΙΡΙΔΑ signatures → ΑΑΔΕ certification → Collection
- **Integration point**: JSON/CSV export from Πύλη → manual import into ΟΠΣ

### Existing Codebase
- `backend/my_project/sanctions/models.py` — SanctionRule model
- `backend/my_project/sanctions/calculator.py` — Fine calculator
- `backend/my_project/sanctions/routes.py` — Sanction rules API
- `backend/my_project/registry/models.py` — Sanction model (lines ~105-128)
- `backend/my_project/registry/routes.py` — Sanctions CRUD (lines ~187-248)
- `frontend/src/features/registry/pages/SanctionsPage.jsx` — Sanctions UI
- `frontend/src/features/registry/lib/registryApi.js` — API client
- `frontend/src/features/registry/lib/constants.js` — Status/type constants

---

## Phase 1: Data Model & Legal Framework Update

### Task 1: Update SanctionRule model

**Files:**
- Modify: `backend/my_project/sanctions/models.py`
- Modify: `backend/my_project/seed_demo.py`

**Step 1: Add new fields to SanctionRule**

Add these columns to the existing `SanctionRule` model:

```python
# In class SanctionRule(db.Model):
min_fine = db.Column(db.Float, nullable=True)      # Minimum fine in range (e.g., 500)
max_fine = db.Column(db.Float, nullable=True)      # Maximum fine in range (e.g., 100000)
category = db.Column(db.String(50), default='general')  # 'safety', 'hygiene', 'admin', 'staff', 'general'
payment_deadline_days = db.Column(db.Integer, default=60)  # Default 2 months
appeal_deadline_days = db.Column(db.Integer, default=15)   # Default 15 days
revenue_split_state_pct = db.Column(db.Integer, default=50)  # % to state (ΑΛΕ)
revenue_split_state_ale = db.Column(db.String(20), default='1560989001')
revenue_split_region_pct = db.Column(db.Integer, default=50)  # % to region (ΚΑΕ)
revenue_split_region_kae = db.Column(db.String(20), default='64008')
```

Also update `to_dict()` to include the new fields.

**Step 2: Run backend to verify migration**

Run: `cd backend && python app.py`
Expected: Server starts, new columns created (auto-migrate)

**Step 3: Commit**

```bash
git add backend/my_project/sanctions/models.py
git commit -m "feat: add min/max range, category, revenue split to SanctionRule"
```

---

### Task 2: Create SanctionDecision model

**Files:**
- Modify: `backend/my_project/sanctions/models.py`

**Step 1: Add SanctionDecision model**

```python
class SanctionDecision(db.Model):
    __tablename__ = 'sanction_decisions'

    id = db.Column(db.Integer, primary_key=True)
    sanction_id = db.Column(db.Integer, db.ForeignKey('sanctions.id'), nullable=False)

    # Workflow status
    status = db.Column(db.String(30), default='draft')
    # Valid: draft, submitted, approved, returned, exported, notified, paid, appealed, overdue, cancelled

    # Draft phase
    drafted_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    drafted_at = db.Column(db.DateTime, default=db.func.now())
    violation_code = db.Column(db.String(50))  # FK to SanctionRule.violation_code
    inspection_finding = db.Column(db.Text)  # Finding that triggered this
    calculated_amount = db.Column(db.Float)  # Calculator output
    final_amount = db.Column(db.Float)  # Approved amount (may differ)
    justification = db.Column(db.Text)  # Αιτιολογία

    # Approval phase
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    approved_at = db.Column(db.DateTime, nullable=True)
    return_comments = db.Column(db.Text, nullable=True)
    protocol_number = db.Column(db.String(50), nullable=True)
    ada_code = db.Column(db.String(30), nullable=True)  # ΔΙΑΥΓΕΙΑ code

    # Notification phase
    notified_at = db.Column(db.DateTime, nullable=True)
    notification_method = db.Column(db.String(50), nullable=True)  # postal, email, police_service

    # Payment tracking
    payment_deadline = db.Column(db.Date, nullable=True)
    appeal_deadline = db.Column(db.Date, nullable=True)
    paid_at = db.Column(db.DateTime, nullable=True)
    paid_amount = db.Column(db.Float, nullable=True)

    # Revenue split
    amount_state = db.Column(db.Float, nullable=True)  # ΑΛΕ portion
    amount_region = db.Column(db.Float, nullable=True)  # ΚΑΕ portion

    # PDF
    pdf_path = db.Column(db.String(500), nullable=True)

    # Obligor details (snapshot at decision time)
    obligor_name = db.Column(db.String(200))
    obligor_father_name = db.Column(db.String(100))
    obligor_afm = db.Column(db.String(20))
    obligor_doy = db.Column(db.String(100))
    obligor_address = db.Column(db.String(300))

    # Timestamps
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    # Relationships
    sanction = db.relationship('Sanction', backref=db.backref('decision', uselist=False))
    drafter = db.relationship('User', foreign_keys=[drafted_by])
    approver = db.relationship('User', foreign_keys=[approved_by])
```

Add `to_dict()` method.

**Step 2: Add relationship fields to Sanction model**

In `backend/my_project/registry/models.py`, add to Sanction:
```python
violation_code = db.Column(db.String(50), nullable=True)
calculated_amount = db.Column(db.Float, nullable=True)
final_amount = db.Column(db.Float, nullable=True)
inspection_finding = db.Column(db.Text, nullable=True)
```

**Step 3: Run backend to verify**

Run: `cd backend && python app.py`
Expected: New `sanction_decisions` table created

**Step 4: Commit**

```bash
git add backend/my_project/sanctions/models.py backend/my_project/registry/models.py
git commit -m "feat: add SanctionDecision model for workflow tracking"
```

---

### Task 3: Update violation rules to Ν.5041/2023

**Files:**
- Modify: `backend/my_project/seed_demo.py`

**Step 1: Update sanction rules seed data**

Replace the existing 10 rules with updated rules per Ν.5041/2023. Create rules in categories:

**General rules (all structure types):**
```python
{'violation_code': 'NO_LICENSE', 'violation_name': 'Λειτουργία χωρίς άδεια',
 'base_fine': 60000, 'min_fine': 60000, 'max_fine': 60000,
 'category': 'admin', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §1',
 'can_trigger_suspension': True, 'suspension_threshold': 1,
 'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
 'payment_deadline_days': 60, 'appeal_deadline_days': 15,
 'revenue_split_state_pct': 50, 'revenue_split_state_ale': '1560989001',
 'revenue_split_region_pct': 50, 'revenue_split_region_kae': '64008'},

{'violation_code': 'TERMS_VIOLATION', 'violation_name': 'Παράβαση όρων λειτουργίας',
 'base_fine': 5000, 'min_fine': 500, 'max_fine': 100000,
 'category': 'general', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
 'can_trigger_suspension': True, 'suspension_threshold': 3,
 'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0},
```

**MFH-specific rules** (structure_type_id linked to ΜΦΗ type):
```python
{'violation_code': 'MFH_OVER_CAPACITY', 'violation_name': 'Υπέρβαση δυναμικότητας ΜΦΗ', ...},
{'violation_code': 'MFH_STAFF_RATIO', 'violation_name': 'Ελλιπής στελέχωση ΜΦΗ', ...},
{'violation_code': 'MFH_SAFETY', 'violation_name': 'Παραβίαση ασφάλειας ηλικιωμένων', ...},
{'violation_code': 'MFH_HYGIENE', 'violation_name': 'Παράβαση υγιεινής ΜΦΗ', ...},
{'violation_code': 'MFH_FIRE_SAFETY', 'violation_name': 'Παραβίαση πυρασφάλειας ΜΦΗ', ...},
```

**KDAP-specific rules:**
```python
{'violation_code': 'KDAP_CHILD_SAFETY', 'violation_name': 'Παράβαση ασφάλειας παιδιών', ...},
{'violation_code': 'KDAP_STAFF_CERTS', 'violation_name': 'Ελλιπή πιστοποιητικά προσωπικού ΚΔΑΠ', ...},
{'violation_code': 'KDAP_SPACE_REQS', 'violation_name': 'Ακαταλληλότητα χώρων ΚΔΑΠ', ...},
```

**KIHI-specific rules:**
```python
{'violation_code': 'KIHI_ACCESSIBILITY', 'violation_name': 'Παράβαση προσβασιμότητας ΚΗΦΗ', ...},
{'violation_code': 'KIHI_PROGRAM', 'violation_name': 'Μη τήρηση προγράμματος ΚΗΦΗ', ...},
```

**COVID-era rules (inactive):**
```python
{'violation_code': 'COVID_MEASURES', 'violation_name': 'Μη τήρηση υγειονομικών μέτρων',
 'base_fine': 3000, 'min_fine': 3000, 'max_fine': 10000,
 'legal_reference': 'ΥΑ Δ1α/ΓΠ.οικ. 5432/2023',
 'is_active': False},
```

Make seed idempotent (check if rule exists before creating).

**Step 2: Run seed and verify**

Run: `cd backend && python app.py`
Expected: New rules created, old rules updated

**Step 3: Run tests**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All tests pass

**Step 4: Commit**

```bash
git add backend/my_project/seed_demo.py
git commit -m "feat: update sanction rules to Ν.5041/2023 with per-structure-type rules"
```

---

## Phase 2: Calculator Enhancement

### Task 4: Update calculator for min/max ranges

**Files:**
- Modify: `backend/my_project/sanctions/calculator.py`
- Modify: `backend/my_project/sanctions/routes.py`

**Step 1: Enhance calculate_fine function**

Update `calculate_fine()` to:
- Accept optional `custom_amount` parameter (for manual override within range)
- Return `min_fine`, `max_fine` in response
- Filter rules by `structure_type_id` when provided
- Validate custom_amount is within min/max range
- Include `payment_deadline_days`, `appeal_deadline_days`, `revenue_split_*` in response

```python
def calculate_fine(violation_code, structure_id, custom_amount=None):
    rule = SanctionRule.query.filter_by(violation_code=violation_code, is_active=True).first()
    if not rule:
        return {'error': f'Unknown violation: {violation_code}'}

    # Check structure type compatibility
    if rule.structure_type_id:
        structure = Structure.query.get(structure_id)
        if structure and structure.type_id != rule.structure_type_id:
            return {'error': 'Rule not applicable to this structure type'}

    # Count prior sanctions (non-cancelled) for recidivism
    prior_count = Sanction.query.filter(
        Sanction.structure_id == structure_id,
        Sanction.notes.contains(f'violation_code:{violation_code}'),
        Sanction.status != 'cancelled'
    ).count()

    # Determine multiplier
    if prior_count == 0:
        multiplier = 1.0
    elif prior_count == 1:
        multiplier = rule.escalation_2nd or 2.0
    else:
        multiplier = rule.escalation_3rd_plus or 3.0

    base = custom_amount if custom_amount else rule.base_fine
    final_amount = base * multiplier

    # Validate range
    effective_min = (rule.min_fine or rule.base_fine) * multiplier
    effective_max = (rule.max_fine or rule.base_fine) * multiplier

    return {
        'violation_code': rule.violation_code,
        'violation_name': rule.violation_name,
        'category': rule.category,
        'base_fine': rule.base_fine,
        'min_fine': rule.min_fine,
        'max_fine': rule.max_fine,
        'multiplier': multiplier,
        'final_amount': final_amount,
        'effective_min': effective_min,
        'effective_max': effective_max,
        'legal_basis': rule.legal_reference,
        'recidivism_count': prior_count,
        'can_trigger_suspension': rule.can_trigger_suspension and
            prior_count >= (rule.suspension_threshold or 999),
        'payment_deadline_days': rule.payment_deadline_days or 60,
        'appeal_deadline_days': rule.appeal_deadline_days or 15,
        'revenue_split': {
            'state_pct': rule.revenue_split_state_pct or 50,
            'state_ale': rule.revenue_split_state_ale or '1560989001',
            'region_pct': rule.revenue_split_region_pct or 50,
            'region_kae': rule.revenue_split_region_kae or '64008',
        },
    }
```

**Step 2: Update `/api/sanctions/calculate` endpoint**

Accept `custom_amount` in request body. Accept `structure_type_id` for filtering.

**Step 3: Add `/api/sanction-rules` filtering by structure type**

Add query parameter `?structure_type_id=N` to filter rules by structure type:
```python
@sanctions_bp.route('/api/sanction-rules', methods=['GET'])
@jwt_required()
def list_rules():
    q = SanctionRule.query.filter_by(is_active=True)
    structure_type_id = request.args.get('structure_type_id', type=int)
    if structure_type_id:
        q = q.filter(
            db.or_(
                SanctionRule.structure_type_id == structure_type_id,
                SanctionRule.structure_type_id.is_(None)  # General rules always included
            )
        )
    rules = q.order_by(SanctionRule.category, SanctionRule.violation_name).all()
    return jsonify([r.to_dict() for r in rules]), 200
```

**Step 4: Run tests**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All tests pass

**Step 5: Commit**

```bash
git add backend/my_project/sanctions/calculator.py backend/my_project/sanctions/routes.py
git commit -m "feat: enhance calculator with min/max ranges, structure type filtering"
```

---

### Task 5: Update frontend calculator UI

**Files:**
- Modify: `frontend/src/features/registry/pages/SanctionsPage.jsx`
- Modify: `frontend/src/features/registry/lib/registryApi.js`
- Modify: `frontend/src/features/registry/lib/constants.js`

**Step 1: Update API client**

In `registryApi.js`, update `sanctionsApi.rules()` to accept structure_type_id:
```javascript
rules: (structureTypeId) => api.get('/api/sanction-rules', {
  params: structureTypeId ? { structure_type_id: structureTypeId } : {}
}),
```

**Step 2: Update SanctionsPage calculator**

When user selects a structure:
1. Look up structure's `type_id`
2. Fetch filtered rules via `sanctionsApi.rules(typeId)`
3. Show rules grouped by category (safety, hygiene, admin, staff)
4. When rule has min ≠ max, show:
   - Range display: "€500 — €100.000"
   - Input field for custom amount (default: base_fine)
   - Slider between min and max
5. Show recidivism info prominently
6. Show revenue split info

**Step 3: Update constants**

Add violation categories to constants:
```javascript
export const VIOLATION_CATEGORIES = {
  safety: { label: 'Ασφάλεια', icon: 'Shield' },
  hygiene: { label: 'Υγιεινή', icon: 'Droplets' },
  admin: { label: 'Διοικητικά', icon: 'FileText' },
  staff: { label: 'Προσωπικό', icon: 'Users' },
  general: { label: 'Γενικά', icon: 'AlertTriangle' },
};
```

Add new sanction statuses:
```javascript
export const SANCTION_DECISION_STATUSES = {
  draft: { label: 'Προσχέδιο', className: 'bg-gray-50 text-gray-700 border-gray-200' },
  submitted: { label: 'Υποβληθείσα', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  approved: { label: 'Εγκεκριμένη', className: 'bg-green-50 text-green-700 border-green-200' },
  returned: { label: 'Επιστράφηκε', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  exported: { label: 'Εξαγόμενη', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  notified: { label: 'Κοινοποιηθείσα', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  paid: { label: 'Εξοφληθείσα', className: 'bg-green-50 text-green-700 border-green-200' },
  appealed: { label: 'Σε ένσταση', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  overdue: { label: 'Εκπρόθεσμη', className: 'bg-red-50 text-red-700 border-red-200' },
  cancelled: { label: 'Ακυρωθείσα', className: 'bg-gray-50 text-gray-500 border-gray-200' },
};
```

**Step 4: Verify in browser**

Open `http://localhost:5173/registry/sanctions`, select a structure, verify rules are filtered.

**Step 5: Commit**

```bash
git add frontend/src/features/registry/pages/SanctionsPage.jsx frontend/src/features/registry/lib/registryApi.js frontend/src/features/registry/lib/constants.js
git commit -m "feat: sanctions calculator with per-structure-type rules and amount ranges"
```

---

## Phase 3: Decision Workflow

### Task 6: Decision CRUD API

**Files:**
- Modify: `backend/my_project/sanctions/routes.py`

**Step 1: Add decision endpoints**

```python
# Create decision from calculation
@sanctions_bp.route('/api/sanction-decisions', methods=['POST'])
@jwt_required()
def create_decision():
    """Create a draft sanction decision."""
    user_id = int(get_jwt_identity())
    data = request.get_json()
    # Validate: structure_id, violation_code, calculated_amount required
    # Create Sanction + SanctionDecision in one transaction
    ...

# Get decision
@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>', methods=['GET'])
@jwt_required()
def get_decision(decision_id):
    ...

# List decisions (with filters: status, structure_id)
@sanctions_bp.route('/api/sanction-decisions', methods=['GET'])
@jwt_required()
def list_decisions():
    ...

# Update decision (draft only: edit justification, amount)
@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>', methods=['PATCH'])
@jwt_required()
def update_decision(decision_id):
    ...

# Submit for approval
@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/submit', methods=['POST'])
@jwt_required()
def submit_decision(decision_id):
    # Status: draft → submitted
    # Notify director
    ...

# Approve or return
@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/approve', methods=['POST'])
@jwt_required()
def approve_decision(decision_id):
    # Director/admin only
    # Action: 'approve' → approved, 'return' → returned
    # On approve: assign protocol_number, set deadlines
    ...

# Mark as notified
@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/notify', methods=['POST'])
@jwt_required()
def notify_decision(decision_id):
    # Status: approved → notified
    # Set payment_deadline and appeal_deadline
    ...

# Update payment status
@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/payment', methods=['POST'])
@jwt_required()
def update_payment(decision_id):
    # Status: notified → paid/appealed/cancelled
    ...

# Export decision data for OPS
@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/export', methods=['GET'])
@jwt_required()
def export_decision(decision_id):
    # Returns JSON with all fields needed for ΧΚ creation in OPS
    ...
```

**Step 2: Run tests**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All pass

**Step 3: Commit**

```bash
git add backend/my_project/sanctions/routes.py
git commit -m "feat: sanction decision CRUD + workflow endpoints"
```

---

### Task 7: Decision workflow frontend — Draft & Submit

**Files:**
- Create: `frontend/src/features/registry/pages/SanctionDecisionPage.jsx`
- Modify: `frontend/src/features/registry/lib/registryApi.js`
- Modify: `frontend/src/App.jsx` (add route)

**Step 1: Create SanctionDecisionPage**

Multi-step form:
1. **Step 1 — Calculation** (reuse calculator): structure, violation, amount
2. **Step 2 — Justification**: text area for αιτιολογία, inspection reference
3. **Step 3 — Obligor details**: name, father, AFM, ΔΟΥ, address (auto-fill from structure)
4. **Step 4 — Preview**: show formatted decision, revenue split, deadlines
5. **Submit button**: creates draft → redirects to decision view

**Step 2: Add API methods**

```javascript
export const decisionsApi = {
  list: (params) => api.get('/api/sanction-decisions', { params }),
  get: (id) => api.get(`/api/sanction-decisions/${id}`),
  create: (data) => api.post('/api/sanction-decisions', data),
  update: (id, data) => api.patch(`/api/sanction-decisions/${id}`, data),
  submit: (id) => api.post(`/api/sanction-decisions/${id}/submit`),
  approve: (id, data) => api.post(`/api/sanction-decisions/${id}/approve`, data),
  notify: (id, data) => api.post(`/api/sanction-decisions/${id}/notify`, data),
  payment: (id, data) => api.post(`/api/sanction-decisions/${id}/payment`, data),
  export: (id) => api.get(`/api/sanction-decisions/${id}/export`),
};
```

**Step 3: Add route**

In `App.jsx`:
```jsx
<Route path="/registry/decisions/new" element={<SanctionDecisionPage />} />
<Route path="/registry/decisions/:id" element={<SanctionDecisionPage />} />
```

**Step 4: Verify in browser**

**Step 5: Commit**

```bash
git add frontend/src/features/registry/pages/SanctionDecisionPage.jsx frontend/src/features/registry/lib/registryApi.js frontend/src/App.jsx
git commit -m "feat: sanction decision creation workflow UI"
```

---

### Task 8: Decision approval page

**Files:**
- Create: `frontend/src/features/registry/pages/DecisionApprovalPage.jsx`
- Modify: `frontend/src/App.jsx` (add route)

**Step 1: Create approval page**

For directors/admins:
- List of pending decisions (status: submitted)
- Decision detail view with:
  - Full decision preview (same as step 4 of creation)
  - Approve button → sets protocol number, moves to approved
  - Return button → requires comments, moves to returned
- Notification sent on action

**Step 2: Add route**

```jsx
<Route path="/registry/decisions" element={<DecisionApprovalPage />} />
```

**Step 3: Verify in browser**

**Step 4: Commit**

```bash
git add frontend/src/features/registry/pages/DecisionApprovalPage.jsx frontend/src/App.jsx
git commit -m "feat: sanction decision approval page for directors"
```

---

### Task 9: Decision tracking & OPS export

**Files:**
- Modify: `frontend/src/features/registry/pages/SanctionsPage.jsx`

**Step 1: Add decisions tab to SanctionsPage**

Add a tab or section showing recent decisions with status badges:
- Filterable by status
- Each row links to decision detail
- Export button (JSON/CSV) for OPS import
- Status update buttons (notified, paid, appealed)

**Step 2: Create export format**

JSON export structure matching OPS ΧΚ requirements:
```json
{
  "catalog_type": "64004/04",
  "decision_number": "665822",
  "decision_date": "2022-07-12",
  "irida_protocol": "",
  "doy": "Α' Αθηνών",
  "organizational_unit": "Τμήμα Κοινωνικής Αλληλεγγύης",
  "reason": "1560989001 - Πρόστιμο Ν.5041/2023 Συν.Ποσό 60.000€",
  "obligor": {
    "category": "ΙΔΙΩΤΕΣ",
    "name": "Κάκος Νικόλαος",
    "afm": "034538000",
    "doy": "Α' Αθηνών",
    "address": "Μάχης Κρήτης 11, Αγ. Ανάργυροι 13562"
  },
  "amounts": {
    "state_budget": 30000.00,
    "region_budget": 30000.00,
    "legal_reference": "Ν.5041/2023 αρ.100 παρ.1"
  }
}
```

**Step 3: Commit**

```bash
git add frontend/src/features/registry/pages/SanctionsPage.jsx
git commit -m "feat: decision tracking tab with OPS export format"
```

---

## Phase 4: PDF Generation

### Task 10: PDF template matching real administrative format

**Files:**
- Create: `backend/my_project/sanctions/pdf_generator.py`
- Modify: `backend/my_project/sanctions/routes.py`

**Step 1: Install ReportLab (if not already)**

Check if `reportlab` is in requirements.txt. If not, add it.

**Step 2: Create PDF generator**

Based on `ΩΝ9Δ7Λ7-ΠΘΨ.pdf` template:

```python
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def generate_decision_pdf(decision, output_path):
    """Generate administrative fine decision PDF matching Περιφέρεια format."""
    doc = SimpleDocTemplate(output_path, pagesize=A4,
        topMargin=2*cm, bottomMargin=2*cm, leftMargin=2.5*cm, rightMargin=2.5*cm)

    story = []

    # 1. Header: ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ + hierarchy
    # Left: authority hierarchy, Right: location + protocol + date + ADA

    # 2. ΘΕΜΑ line (bold)

    # 3. Έχοντας υπόψη (numbered list)
    # Template legal references + dynamic references (inspection, advisor reports, etc.)

    # 4. ΑΠΟΦΑΣΙΖΟΥΜΕ (bold, centered)
    # Main text: fine amount (bold), obligor details, reason, payment terms, split, appeal

    # 5. Πίνακας Αποδεκτών
    # A. For action: obligor, ΔΟΥ, police
    # B. For notification: 9 standard bodies

    # 6. Signature block (right-aligned)

    doc.build(story)
```

**Step 3: Add PDF generation endpoint**

```python
@sanctions_bp.route('/api/sanction-decisions/<int:decision_id>/pdf', methods=['GET'])
@jwt_required()
def generate_pdf(decision_id):
    decision = SanctionDecision.query.get_or_404(decision_id)
    # Generate PDF to temp file
    # Return as attachment
    ...
```

**Step 4: Add "Έχοντας υπόψη" template**

Create a configurable template for the legal references section. Default template includes:
1. Ν.3852/2010 (Καλλικράτης)
2. Π.Δ. 145/2010 (Οργανισμός Περιφέρειας)
3. Εγκύκλιος αρμοδιοτήτων
4. Απόφαση μεταβίβασης αρμοδιοτήτων
5. Ν.3861/2010 (ΔΙΑΥΓΕΙΑ)
6. **Dynamic**: Applicable law for this violation type
7. **Dynamic**: ΥΑ for structure type (MFH/KDAP licensing)
8. **Dynamic**: Previous decisions/inspections
9. **Dynamic**: Advisor reports
10. **Dynamic**: Hearing records

**Step 5: Commit**

```bash
git add backend/my_project/sanctions/pdf_generator.py backend/my_project/sanctions/routes.py
git commit -m "feat: PDF generation for sanction decisions matching administrative format"
```

---

### Task 11: Frontend PDF preview

**Files:**
- Modify: `frontend/src/features/registry/pages/SanctionDecisionPage.jsx`

**Step 1: Add PDF preview in decision workflow**

In step 4 (Preview) of the decision creation:
- Add "Προεπισκόπηση PDF" button
- Opens PDF in new tab via `/api/sanction-decisions/{id}/pdf`
- Also available after decision is approved

**Step 2: Add download button to decision list**

**Step 3: Commit**

```bash
git add frontend/src/features/registry/pages/SanctionDecisionPage.jsx
git commit -m "feat: PDF preview and download in decision workflow"
```

---

## Phase 5: Dashboard & Alerts

### Task 12: Sanctions dashboard widget

**Files:**
- Modify: `backend/my_project/oversight/routes.py` (dashboard endpoint)
- Modify: `frontend/src/features/registry/pages/OversightDashboardPage.jsx`

**Step 1: Add sanctions stats to dashboard API**

In `oversight_dashboard()`, add:
```python
# Sanctions workflow stats
decision_stats = {
    'draft': SanctionDecision.query.filter_by(status='draft').count(),
    'submitted': SanctionDecision.query.filter_by(status='submitted').count(),
    'approved': SanctionDecision.query.filter_by(status='approved').count(),
    'notified': SanctionDecision.query.filter_by(status='notified').count(),
    'overdue': SanctionDecision.query.filter(
        SanctionDecision.status == 'notified',
        SanctionDecision.payment_deadline < date.today()
    ).count(),
    'total_amount_pending': ...,
    'total_amount_paid': ...,
}
```

**Step 2: Add dashboard cards**

In OversightDashboardPage, add:
- "Εκκρεμείς Αποφάσεις" card (draft + submitted count)
- "Αναμένουν Έγκριση" card (submitted count, links to approval page)
- "Εκπρόθεσμες Πληρωμές" card (overdue count, red highlight)
- Mini chart: sanctions by month

**Step 3: Add sanctions alerts**

In `oversight_alerts()`, add:
- Overdue payment alerts (notified + past deadline)
- Approaching payment deadlines (within 7 days)
- Approaching appeal deadlines (within 3 days)
- Returned decisions requiring revision

**Step 4: Commit**

```bash
git add backend/my_project/oversight/routes.py frontend/src/features/registry/pages/OversightDashboardPage.jsx
git commit -m "feat: sanctions dashboard widgets and deadline alerts"
```

---

### Task 13: Sanctions reporting

**Files:**
- Modify: `backend/my_project/oversight/reports.py`

**Step 1: Add sanctions report generator**

Add to `REPORT_GENERATORS`:
```python
'sanctions': {
    'pdf': generate_sanctions_report_pdf,
    'xlsx': generate_sanctions_report_xlsx,
}
```

Report includes:
- Summary: total sanctions, total amount, by status
- Detail table: each sanction with structure, type, amount, status, dates
- Filterable by date range, structure type, status

**Step 2: Commit**

```bash
git add backend/my_project/oversight/reports.py
git commit -m "feat: sanctions report generation PDF/XLSX"
```

---

## Phase 6: Seed Data & Demo

### Task 14: Create realistic demo decisions

**Files:**
- Modify: `backend/my_project/seed_demo.py`

**Step 1: Add demo SanctionDecisions**

Create 5-6 decisions in various stages:
1. **Draft**: ΜΦΗ Ηλιαχτίδα — υπέρβαση δυναμικότητας, €10.000 (calculated)
2. **Submitted**: ΚΔΑΠ Αστέρι — ελλιπή πιστοποιητικά, €3.000
3. **Approved**: ΜΦΗ BELLE VUE — λειτουργία χωρίς άδεια, €60.000 (protocol assigned)
4. **Notified**: ΚΗΦΗ — παράβαση προσβασιμότητας, €6.000 (deadline set)
5. **Paid**: Previous sanction — €5.000 (fully paid)
6. **Overdue**: Old sanction — €8.000 (past deadline, unpaid)

**Step 2: Run seed and verify**

**Step 3: Commit**

```bash
git add backend/my_project/seed_demo.py
git commit -m "feat: realistic demo sanction decisions across workflow stages"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1. Data Model | 1-3 | SanctionRule update, SanctionDecision model, Ν.5041/2023 rules |
| 2. Calculator | 4-5 | Min/max ranges, structure-type filtering, enhanced UI |
| 3. Workflow | 6-9 | Decision CRUD, approval page, tracking, OPS export |
| 4. PDF | 10-11 | ReportLab template matching real administrative format |
| 5. Dashboard | 12-13 | Widgets, alerts, reporting |
| 6. Demo | 14 | Realistic seed data |

**Dependencies:**
- Tasks 1-3 must complete before Tasks 4-5
- Tasks 4-5 must complete before Tasks 6-9
- Task 6 must complete before Task 10
- Tasks 10-11 can run parallel with Tasks 12-13
- Task 14 depends on Tasks 6 and 10

**Blocked on user input:**
- Exact fine amounts per violation per structure type (using estimates until confirmed)
- Additional "Έχοντας υπόψη" templates per case type
- OPS export field mapping (using best guess from manual)
- Greek font files for ReportLab (GFS Didot or similar for official look)
