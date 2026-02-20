# 9-Point Portal Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken features and implement 9 improvement points for the Social Welfare Portal (file management, workflow unification, auto-population, clickable dashboard, daily agenda).

**Architecture:** Backend changes to Flask models/routes + frontend React component updates. All file operations follow the existing inspection-report upload pattern (multipart form → content/ directory → relative path in DB). Frontend uses shadcn/ui components with existing design system.

**Tech Stack:** Flask/SQLAlchemy backend, React 18 + shadcn/ui frontend, PostgreSQL + pgvector, Vite dev server.

---

## Task 1: Fix Documents Compose 500 Error (Critical Bug)

**Context:** `POST /api/decisions` fails because `decision_records` table is missing columns `internal_number`, `source_type`, `source_id` that the ORM expects. The `_migrate_columns` list in `create_app()` doesn't include these columns.

**Files:**
- Modify: `backend/my_project/__init__.py` (lines ~142-162, the `_migrate_columns` list)

**Step 1: Add missing columns to auto-migration**

In `backend/my_project/__init__.py`, find the `_migrate_columns` list and add:

```python
('decision_records', 'internal_number', 'VARCHAR(20)'),
('decision_records', 'source_type', 'VARCHAR(50)'),
('decision_records', 'source_id', 'INTEGER'),
```

**Step 2: Add unique index for internal_number**

After the `ALTER TABLE` loop in `create_app()`, add:

```python
try:
    db.session.execute(db.text(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_decision_records_internal_number "
        "ON decision_records (internal_number) WHERE internal_number IS NOT NULL"
    ))
    db.session.commit()
except Exception:
    db.session.rollback()
```

**Step 3: Restart backend and verify**

Run: `cd backend && python app.py`

Then test: `POST /api/decisions` with a valid template_id — should return 201 instead of 500.

**Step 4: Also fix handlePreview race condition in frontend**

In `frontend/src/pages/DocumentComposePage.jsx`, the `handlePreview` function calls `await handleSaveDraft()` then checks `decisionId` state — but React state hasn't updated yet. Fix by having `handleSaveDraft` return the ID:

In `handleSaveDraft` (~line 115): Make it return `decisionId` or the new `data.id`.

In `handlePreview`: Use the returned ID directly instead of reading state.

**Step 5: Commit**

```bash
git add backend/my_project/__init__.py frontend/src/pages/DocumentComposePage.jsx
git commit -m "fix: resolve 500 error on document compose — add missing DB columns and fix preview race condition"
```

---

## Task 2: Documents Auto-Populate Fields from Registry (Point 7)

**Context:** When user picks a structure in Step 2 of DocumentComposePage, the form fields in Step 3 appear empty even though the backend has `resolve_placeholders`. The user must manually type structure data that already exists in the registry. Fix: pre-fill form fields on the frontend when structure is selected.

**Files:**
- Modify: `frontend/src/pages/DocumentComposePage.jsx` (~line 348 area, step 2 → step 3 transition)
- Modify: `frontend/src/features/registry/lib/registryApi.js` (if structure detail API needed)

**Step 1: Fetch structure details when structure selected**

When `selectedStructureId` changes (and is not `_none`), fetch the full structure via `GET /api/structures/<id>`. Store in state `selectedStructureData`.

**Step 2: Pre-fill form fields from structure data**

When transitioning from Step 2 to Step 3, map structure fields to template form fields:

```javascript
const structureFieldMapping = {
  'όνομα_δομής': structure.name,
  'κωδικός_δομής': structure.code,
  'πόλη': structure.city,
  'οδός': structure.address,
  'ΤΚ': structure.postal_code,
  'εκπρόσωπος': structure.representative_name,
  'ΑΦΜ_εκπροσώπου': structure.representative_afm,
  'τηλέφωνο_εκπροσώπου': structure.representative_phone,
  'email_εκπροσώπου': structure.representative_email,
  'δυναμικότητα': structure.capacity,
  'κατάσταση': structure.status,
  'ιδιοκτησία': structure.ownership,
  'αριθμός_αδείας': structure.license_number,
  'ημερομηνία_αδείας': structure.license_date,
  'λήξη_αδείας': structure.license_expiry,
  'τύπος_δομής': structure.type_name,
};
```

Pre-populate `formData` state with these values. Fields remain editable so user can override.

**Step 3: Show visual indicator for auto-filled fields**

Add a subtle badge or different background to fields that were auto-populated from the registry (optional, nice-to-have).

**Step 4: Test**

1. Start backend + frontend (`npx pnpm start` from frontend/)
2. Go to Έγγραφα → Νέα Απόφαση
3. Pick a template → Pick a structure → Go to Step 3
4. Verify fields are pre-filled with structure data
5. Verify save works (no 500)
6. Verify preview works

**Step 5: Commit**

```bash
git add frontend/src/pages/DocumentComposePage.jsx
git commit -m "feat: auto-populate document form fields from structure registry data"
```

---

## Task 3: License File Upload & Download (Point 1)

**Context:** License model has no file field. Users need to upload existing license decision PDFs and download them from the licenses list. Also support auto-linking to DecisionRecords created in the Documents module.

**Files:**
- Modify: `backend/my_project/registry/models.py` (License class, lines 82-102)
- Modify: `backend/my_project/registry/routes.py` (license endpoints, lines 160-185)
- Modify: `backend/my_project/__init__.py` (add `_migrate_columns` entry for new columns)
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx` (LicensesTab, CreateLicenseDialog)

### Backend Changes

**Step 1: Add file columns to License model**

In `backend/my_project/registry/models.py`, add to the `License` class after `notes` (line 91):

```python
file_path = db.Column(db.String(500), nullable=True)
decision_record_id = db.Column(db.Integer, db.ForeignKey('decision_records.id'), nullable=True)
```

Update `to_dict()` to include `file_path` and `decision_record_id`.

**Step 2: Add auto-migration entries**

In `backend/my_project/__init__.py`, add to `_migrate_columns`:

```python
('licenses', 'file_path', 'VARCHAR(500)'),
('licenses', 'decision_record_id', 'INTEGER'),
```

**Step 3: Update license create endpoint to handle file upload**

In `backend/my_project/registry/routes.py`, change `create_license` (line 168) from JSON to multipart:

```python
@registry_bp.route('/api/structures/<int:structure_id>/licenses', methods=['POST'])
@jwt_required()
def create_license(structure_id):
    structure = Structure.query.get_or_404(structure_id)

    # Support both JSON and multipart
    if request.content_type and 'multipart' in request.content_type:
        data = request.form
    else:
        data = request.get_json()

    license = License(
        structure_id=structure_id,
        type=data.get('type', ''),
        protocol_number=data.get('protocol_number'),
        issued_date=parse_date(data.get('issued_date')),
        expiry_date=parse_date(data.get('expiry_date')),
        status=data.get('status', 'active'),
        notes=data.get('notes')
    )
    db.session.add(license)
    db.session.flush()  # Get ID for filename

    # Handle file upload
    if 'file' in request.files:
        file = request.files['file']
        if file and file.filename:
            from werkzeug.utils import secure_filename
            filename = secure_filename(file.filename)
            upload_dir = os.path.join(current_app.config['UPLOAD_FOLDER'], 'licenses')
            os.makedirs(upload_dir, exist_ok=True)
            full_path = os.path.join(upload_dir, f'{license.id}_{filename}')
            file.save(full_path)
            license.file_path = f'licenses/{license.id}_{filename}'

    db.session.commit()
    return jsonify(license.to_dict()), 201
```

**Step 4: Add file download endpoint**

```python
@registry_bp.route('/api/licenses/<int:license_id>/file', methods=['GET'])
@jwt_required()
def download_license_file(license_id):
    license = License.query.get_or_404(license_id)
    if not license.file_path:
        return jsonify({'error': 'No file attached'}), 404
    content_dir = current_app.config['UPLOAD_FOLDER']
    if not os.path.isabs(content_dir):
        content_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), content_dir)
    return send_file(os.path.join(content_dir, license.file_path), as_attachment=True)
```

### Frontend Changes

**Step 5: Update CreateLicenseDialog to include file upload**

In `StructureDetailPage.jsx`, find the `CreateLicenseDialog` component. Add a file input field. Change the submit handler from JSON `api.post` to `FormData` with multipart.

**Step 6: Add download/preview buttons to license table**

In the `LicensesTab` table rows, add an actions column:

```jsx
{license.file_path && (
  <div className="flex gap-1">
    <Button variant="ghost" size="sm" asChild>
      <a href={`/content/${license.file_path}`} target="_blank" title="Προεπισκόπηση">
        <Eye className="w-4 h-4" />
      </a>
    </Button>
    <Button variant="ghost" size="sm" asChild>
      <a href={`/api/licenses/${license.id}/file`} download title="Λήψη">
        <Download className="w-4 h-4" />
      </a>
    </Button>
  </div>
)}
```

**Step 7: Test and commit**

Test: Create a license with PDF upload → verify it appears in the list → click preview (new tab) → click download.

```bash
git add backend/my_project/registry/models.py backend/my_project/registry/routes.py backend/my_project/__init__.py frontend/src/features/registry/pages/StructureDetailPage.jsx
git commit -m "feat: add file upload/download for license decisions"
```

---

## Task 4: Inspections List Clickable Preview (Point 2)

**Context:** The inspections list in StructureDetailPage shows inspection rows but they're not clickable for preview. User wants to click an inspection and see its report in a new tab.

**Files:**
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx` (InspectionsTab, around lines where inspection rows are rendered)

**Step 1: Make inspection rows clickable**

In the `InspectionsTab`, each inspection row should have a clickable action. For inspections with reports, link to `/inspections/<id>/report` (which is the `InspectionReportPage`). Open in new tab.

Add to the table row actions:

```jsx
<Button variant="ghost" size="sm" asChild>
  <a href={`/inspections/${inspection.id}/report`} target="_blank" title="Προβολή Ελέγχου">
    <Eye className="w-4 h-4" />
  </a>
</Button>
```

For inspections that have a report with `file_path`, also add a download button:

```jsx
{inspection.report?.file_path && (
  <Button variant="ghost" size="sm" asChild>
    <a href={`/content/${inspection.report.file_path}`} target="_blank" title="Λήψη Αρχείου">
      <Download className="w-4 h-4" />
    </a>
  </Button>
)}
```

**Step 2: Ensure backend returns report file_path in inspection list**

Check that `GET /api/structures/<id>/inspections` includes report data. If not, modify the backend to include `report.file_path` in the inspection serialization.

**Step 3: Test and commit**

```bash
git add frontend/src/features/registry/pages/StructureDetailPage.jsx
git commit -m "feat: add clickable preview and download to inspections list"
```

---

## Task 5: Advisor Reports — Remove Approval Workflow + Add Preview (Point 3)

**Context:** The current workflow has Draft → Submit → Approve/Return, but the user says approval isn't needed. Simplify: advisor creates report and it's final. Also add preview to the reports list.

**Files:**
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx` (ReportsTab, lines 533-700)
- Modify: `backend/my_project/oversight/routes.py` (optional: simplify status handling)
- Modify: `frontend/src/features/registry/pages/AdvisorReportPage.jsx` (the creation form)

### Frontend Changes

**Step 1: Remove workflow buttons from ReportsTab**

In the `ReportsTab` (StructureDetailPage.jsx lines ~533-700), remove:
- The "Υποβολή" button (lines ~640-650)
- The "Έγκριση" button (lines ~653-662)
- The "Επιστροφή" button (lines ~663-672)
- The `handleSubmit`, `handleApprove`, `handleReturn` functions (lines ~550-580)

Keep the "Ίριδα" export button for approved reports.

**Step 2: Change default status on creation**

In `AdvisorReportPage.jsx`, when creating a new report, set status directly to `submitted` or `approved` (instead of `draft`) so it appears as final immediately. Or simpler: just set to `approved` on the backend when created.

**Step 3: Add preview button to reports list**

For each report row in `ReportsTab`, add a clickable preview link:

```jsx
<Button variant="ghost" size="sm" asChild>
  <a href={`/registry/${structureId}/advisor-report/${report.id}`} target="_blank" title="Προβολή">
    <Eye className="w-4 h-4" />
  </a>
</Button>
```

Also if `report.file_path` exists, add download:

```jsx
{report.file_path && (
  <Button variant="ghost" size="sm" asChild>
    <a href={`/content/${report.file_path}`} target="_blank" title="Λήψη Αρχείου">
      <Download className="w-4 h-4" />
    </a>
  </Button>
)}
```

### Backend Changes

**Step 4: Auto-approve on creation**

In `backend/my_project/oversight/routes.py`, in `create_advisor_report` (line ~33), change default status from `'draft'` to `'approved'`:

```python
report = SocialAdvisorReport(
    ...
    status='approved',  # was 'draft'
    ...
)
```

This means reports are immediately final and visible for ΙΡΙΔΑ export.

**Step 5: Test and commit**

```bash
git add frontend/src/features/registry/pages/StructureDetailPage.jsx frontend/src/features/registry/pages/AdvisorReportPage.jsx backend/my_project/oversight/routes.py
git commit -m "feat: simplify advisor reports — remove approval workflow, add preview links"
```

---

## Task 6: Unify Sanctions Workflows (Point 5)

**Context:** There are 3 ways to create a sanction, which is confusing. Unify into one flow: Calculator → Decision Wizard. Remove bare Sanction creation paths.

**Files:**
- Modify: `frontend/src/features/registry/pages/SanctionsPage.jsx` (lines 240-740)
- Modify: `frontend/src/features/registry/pages/SanctionDecisionPage.jsx` (remove step 1 calculator duplicate, lines 307-458)
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx` (SanctionsTab, lines 703-845)
- Delete or stop using: `frontend/src/features/registry/components/SanctionForm.jsx`

### SanctionsPage Changes

**Step 1: Replace "Επιβολή Κύρωσης" with "Συνέχεια σε Απόφαση"**

In `SanctionsPage.jsx`, find the "Επιβολή Κύρωσης" button (line ~464). Replace with a Link to the decision wizard that passes the calculation data:

```jsx
<Button asChild className="w-full bg-blue-700 hover:bg-blue-800">
  <Link to={`/sanctions/decisions/new?structure=${selectedStructure}&rule=${selectedRule}&amount=${calculation.final_amount}`}>
    <FileText className="w-4 h-4 mr-2" />
    Συνέχεια σε Απόφαση
  </Link>
</Button>
```

Remove the `handleCreateSanction` function that calls `structuresApi.createSanction`.

**Step 2: Remove Κυρώσεις tab, keep only Αποφάσεις**

Remove the tab switcher (lines ~526-550). Remove the "Κυρώσεις" tab content (lines ~552-637). Show only the Αποφάσεις list directly. Change header from "Κυρώσεις / Αποφάσεις" to "Αποφάσεις".

### SanctionDecisionPage Changes

**Step 3: Remove calculator duplicate from Step 1**

In `SanctionDecisionPage.jsx`, replace Step 1 (lines ~307-458) with a summary of the pre-selected calculation from URL params. If no params, show a message to go to the calculator first.

Read URL params:
```jsx
const searchParams = new URLSearchParams(location.search);
const preSelectedStructure = searchParams.get('structure');
const preSelectedRule = searchParams.get('rule');
const preSelectedAmount = searchParams.get('amount');
```

Step 1 becomes a confirmation/review step that shows the pre-calculated fine, not a duplicate calculator.

**Step 4: Update STEPS array**

Change from `['calculate', 'justification', 'obligor', 'preview']` to `['review', 'justification', 'obligor', 'preview']`.

### StructureDetailPage Changes

**Step 5: Remove "Νέα Κύρωση" quick form**

In `StructureDetailPage.jsx` SanctionsTab (line ~703):
- Remove the "Νέα Κύρωση" button (lines ~744-751)
- Remove the `SanctionForm` usage (lines ~837-842)
- Replace with a link to the sanctions calculator pre-filtered for this structure:

```jsx
<Button asChild>
  <Link to={`/sanctions?structure=${structureId}`}>
    <Calculator className="w-4 h-4 mr-2" />
    Νέα Κύρωση
  </Link>
</Button>
```

**Step 6: Add download/preview buttons for decisions in SanctionsTab**

For each sanction decision with a PDF, add:

```jsx
{decision.pdf_path && (
  <div className="flex gap-1">
    <Button variant="ghost" size="sm" asChild>
      <a href={`/content/${decision.pdf_path}`} target="_blank" title="Προεπισκόπηση PDF">
        <Eye className="w-4 h-4" />
      </a>
    </Button>
  </div>
)}
```

**Step 7: Test and commit**

Test the full flow: Sanctions page → Calculator → "Συνέχεια σε Απόφαση" → Wizard → Save.

```bash
git add frontend/src/features/registry/pages/SanctionsPage.jsx frontend/src/features/registry/pages/SanctionDecisionPage.jsx frontend/src/features/registry/pages/StructureDetailPage.jsx
git commit -m "feat: unify sanctions workflow — single calculator-to-decision flow"
```

---

## Task 7: Committees Linked to Structure Types (Point 6)

**Context:** Committees are generic. They should be linked to a specific structure type (ΜΦΗ, ΚΔΗΦ+ΚΑΑ, etc.) per ministerial decisions.

**Files:**
- Modify: `backend/my_project/inspections/models.py` (InspectionCommittee, lines 5-34)
- Modify: `backend/my_project/inspections/routes.py` (committee CRUD endpoints)
- Modify: `backend/my_project/__init__.py` (add migration column)
- Modify: `frontend/src/features/registry/components/CommitteeManager.jsx` (CreateCommitteeDialog, lines 23-116)

### Backend Changes

**Step 1: Add structure_type_id to InspectionCommittee**

In `backend/my_project/inspections/models.py`, add to `InspectionCommittee`:

```python
structure_type_id = db.Column(db.Integer, db.ForeignKey('structure_types.id'), nullable=True)
structure_type = db.relationship('StructureType', backref='committees')
```

Update `to_dict()` to include `structure_type_id` and `structure_type_name`.

**Step 2: Add auto-migration entry**

In `backend/my_project/__init__.py`, add:

```python
('inspection_committees', 'structure_type_id', 'INTEGER'),
```

**Step 3: Add validation to inspection creation**

In the inspection creation endpoint, validate that the selected committee's `structure_type_id` matches the target structure's `structure_type_id`. Return 400 if mismatch.

### Frontend Changes

**Step 4: Add structure type dropdown to CreateCommitteeDialog**

In `CommitteeManager.jsx`, add a `<Select>` for structure type in the creation dialog. Fetch structure types from `GET /api/structure-types`. Make it required.

Display the structure type in the committee card header (e.g., "Επιτροπή ΜΦΗ").

**Step 5: Filter structure assignments by type**

In `AssignStructureDialog`, filter the structure dropdown to only show structures matching the committee's structure type.

**Step 6: Test and commit**

```bash
git add backend/my_project/inspections/models.py backend/my_project/inspections/routes.py backend/my_project/__init__.py frontend/src/features/registry/components/CommitteeManager.jsx
git commit -m "feat: link committees to structure types per ministerial decisions"
```

---

## Task 8: Dashboard Stat Cards Clickable (Point 8)

**Context:** The 6 stat cards on the oversight dashboard are cosmetic — no links. User wants each to navigate to the relevant data view.

**Files:**
- Modify: `frontend/src/features/registry/components/StatsCards.jsx` (lines 5-75)

**Step 1: Add link destinations to CARDS array**

```javascript
const CARDS = [
  { key: 'total_structures', label: 'Συνολικές Δομές', icon: Building, color: 'blue', link: '/registry' },
  { key: 'active_structures', label: 'Ενεργές Δομές', icon: BuildingCheck, color: 'green', link: '/registry?status=active' },
  { key: 'total_inspections', label: 'Έλεγχοι', icon: Search, color: 'indigo', link: '/committees' },
  { key: 'completed_inspections', label: 'Ολοκληρωμένοι', icon: ListCheck, color: 'teal', link: '/committees' },
  { key: 'submitted_reports', label: 'Εκκρεμείς Εκθέσεις', icon: FileWarning, color: 'orange', link: '/reports' },
  { key: 'total_sanctions', label: 'Κυρώσεις', icon: Gavel, color: 'red', link: '/sanctions' },
];
```

**Step 2: Wrap cards in Link components**

```jsx
import { Link } from 'react-router-dom';

{CARDS.map(card => (
  <Link to={card.link} key={card.key} className="block hover:scale-[1.02] transition-transform">
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      ...existing card content...
    </Card>
  </Link>
))}
```

**Step 3: Also make the 2 non-clickable DECISION_CARDS clickable**

The `total_amount_pending` and `total_amount_paid` cards currently have no links. Add `link: '/sanctions/decisions'` to both.

**Step 4: Test and commit**

Verify: click each card → navigates to correct page.

```bash
git add frontend/src/features/registry/components/StatsCards.jsx
git commit -m "feat: make oversight dashboard stat cards clickable with real navigation"
```

---

## Task 9: Daily Agenda Widget (Point 9)

**Context:** No daily schedule exists. Build a "Today's Agenda" widget that aggregates pending items from the portal: scheduled inspections, expiring licenses, pending approvals, overdue payments.

**Files:**
- Modify: `backend/my_project/oversight/routes.py` (add new endpoint)
- Create: `frontend/src/features/registry/components/DailyAgenda.jsx`
- Modify: `frontend/src/features/registry/pages/OversightDashboardPage.jsx` (add widget)

### Backend

**Step 1: Create daily agenda endpoint**

In `backend/my_project/oversight/routes.py`, add:

```python
@oversight_bp.route('/api/oversight/daily-agenda', methods=['GET'])
@jwt_required()
def daily_agenda():
    from datetime import date, timedelta
    today = date.today()
    agenda = []

    # 1. Inspections scheduled today or this week
    upcoming_inspections = Inspection.query.filter(
        Inspection.scheduled_date >= today,
        Inspection.scheduled_date <= today + timedelta(days=7),
        Inspection.status.in_(['scheduled', 'pending'])
    ).order_by(Inspection.scheduled_date).all()

    for insp in upcoming_inspections:
        structure = Structure.query.get(insp.structure_id)
        agenda.append({
            'type': 'inspection',
            'priority': 'high' if insp.scheduled_date == today else 'medium',
            'title': f'Έλεγχος: {structure.name if structure else "N/A"}',
            'subtitle': f'{insp.type} - {insp.scheduled_date.strftime("%d/%m/%Y")}',
            'date': insp.scheduled_date.isoformat(),
            'link': f'/inspections/{insp.id}/report',
            'structure_id': insp.structure_id
        })

    # 2. Licenses expiring within 30 days
    expiring_licenses = License.query.filter(
        License.expiry_date >= today,
        License.expiry_date <= today + timedelta(days=30),
        License.status == 'active'
    ).order_by(License.expiry_date).all()

    for lic in expiring_licenses:
        structure = Structure.query.get(lic.structure_id)
        days_left = (lic.expiry_date - today).days
        agenda.append({
            'type': 'license_expiring',
            'priority': 'high' if days_left <= 7 else 'medium',
            'title': f'Λήξη Άδειας: {structure.name if structure else "N/A"}',
            'subtitle': f'{lic.type} - σε {days_left} ημέρες ({lic.expiry_date.strftime("%d/%m/%Y")})',
            'date': lic.expiry_date.isoformat(),
            'link': f'/registry/{lic.structure_id}',
            'structure_id': lic.structure_id
        })

    # 3. Pending decision approvals
    pending_decisions = SanctionDecision.query.filter(
        SanctionDecision.status == 'submitted'
    ).order_by(SanctionDecision.created_at).all()

    for dec in pending_decisions:
        agenda.append({
            'type': 'pending_approval',
            'priority': 'high',
            'title': f'Εκκρεμεί Έγκριση: {dec.obligor_name or "N/A"}',
            'subtitle': f'Ποσό: {dec.final_amount}€',
            'date': dec.created_at.isoformat() if dec.created_at else today.isoformat(),
            'link': f'/sanctions/decisions/{dec.id}',
            'structure_id': dec.structure_id
        })

    # 4. Overdue payments
    overdue = SanctionDecision.query.filter(
        SanctionDecision.status == 'notified',
        SanctionDecision.payment_deadline < today
    ).all()

    for dec in overdue:
        agenda.append({
            'type': 'overdue_payment',
            'priority': 'critical',
            'title': f'Εκπρόθεσμη Πληρωμή: {dec.obligor_name or "N/A"}',
            'subtitle': f'Ποσό: {dec.final_amount}€ - Προθεσμία: {dec.payment_deadline.strftime("%d/%m/%Y")}',
            'date': dec.payment_deadline.isoformat(),
            'link': f'/sanctions/decisions/{dec.id}',
            'structure_id': dec.structure_id
        })

    # Sort by priority then date
    priority_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3}
    agenda.sort(key=lambda x: (priority_order.get(x['priority'], 9), x['date']))

    return jsonify({
        'date': today.isoformat(),
        'items': agenda,
        'summary': {
            'total': len(agenda),
            'critical': sum(1 for a in agenda if a['priority'] == 'critical'),
            'high': sum(1 for a in agenda if a['priority'] == 'high'),
        }
    })
```

### Frontend

**Step 2: Create DailyAgenda component**

Create `frontend/src/features/registry/components/DailyAgenda.jsx`:

A card component that:
- Fetches from `/api/oversight/daily-agenda`
- Shows date header "Ατζέντα Ημέρας — DD/MM/YYYY"
- Lists items grouped by priority (critical first, then high, then medium)
- Each item is clickable (Link to `item.link`)
- Color-coded by type: red for overdue, orange for expiring, blue for inspections, yellow for pending
- Shows summary counts at top

**Step 3: Add DailyAgenda to OversightDashboardPage**

In `OversightDashboardPage.jsx`, add the `<DailyAgenda />` component above the StatsCards section (or in a prominent position):

```jsx
<DailyAgenda />
<StatsCards stats={dashboard.stats} decisionStats={dashboard.decision_stats} />
```

**Step 4: Test and commit**

```bash
git add backend/my_project/oversight/routes.py frontend/src/features/registry/components/DailyAgenda.jsx frontend/src/features/registry/pages/OversightDashboardPage.jsx
git commit -m "feat: add daily agenda widget to oversight dashboard"
```

---

## Task 10: OPS Financial Management Interop Documentation (Point 4)

**Context:** Document the integration spec for future interop with OPS Oikonomikis Diacheirisis (Χρηματικοί Κατάλογοι, ΑΑΔΕ). No code implementation — only spec document.

**Files:**
- Create: `docs/ops-financial-interop-spec.md`

**Step 1: Write comprehensive integration spec**

Document covering:

1. **Overview**: What OPS Oikonomikis Diacheirisis is and why the Portal needs to interoperate
2. **Current OPS Workflow** (from the manual):
   - Login → Χρηματικοί Κατάλογοι → New record
   - Fields: Τύπος Καταλόγου, Αρ. Απόφασης, Αρ. Πρωτοκόλλου, ΔΟΥ, Δημ. Διαμέρισμα, Οργ. Μονάδα, Αιτιολογία
   - Obligor (Υπόχρεος): Επωνυμία, ΑΦΜ, ΔΟΥ, Διεύθυνση
   - Amounts: Οφειλόμενο Ποσό (state budget), Αρχικώς Βεβαιωθέν (regional)
   - Post-creation: Βεβαίωση, Εκτύπωση PDF, ΙΡΙΔΑ signatures, ΑΑΔΕ submission
3. **Field Mapping**: Portal `SanctionDecision` fields → OPS ΧΚ fields
4. **Proposed API Design**:
   - `POST /api/ops/export-xk` — generate ΧΚ data package from SanctionDecision
   - `GET /api/ops/status/<decision_id>` — check status (paid/appealed/overdue)
   - Webhook or polling for payment confirmation
5. **Data Model Extensions**: Fields needed on SanctionDecision for OPS tracking (ΧΚ number, ΑΑΔΕ confirmation, ΑΤΒ)
6. **Integration Options**:
   - Direct API (if OPS has REST API)
   - File-based exchange (CSV/XML export for import)
   - RDP automation (as last resort)
7. **Security & Auth**: How to authenticate between systems
8. **Phased Rollout**: Phase 1 (export), Phase 2 (status sync), Phase 3 (full bidirectional)

Note: The existing `export_decision` endpoint (lines 371-411 in sanctions/routes.py) already generates a JSON ΧΚ package. Reference this as Phase 1 starting point.

**Step 2: Commit**

```bash
git add docs/ops-financial-interop-spec.md
git commit -m "docs: add OPS financial management interoperability specification"
```

---

## Execution Order & Dependencies

| Task | Description | Depends On | Effort |
|------|-------------|------------|--------|
| 1 | Fix Documents 500 error | None | Small |
| 2 | Documents auto-populate | Task 1 | Medium |
| 3 | License file upload/download | Task 1 (migration pattern) | Medium |
| 4 | Inspections clickable preview | None | Small |
| 5 | Advisor reports simplify + preview | None | Small |
| 6 | Unify sanctions workflows | None | Large |
| 7 | Committees → structure types | None | Medium |
| 8 | Dashboard cards clickable | None | Small |
| 9 | Daily agenda widget | None | Medium |
| 10 | OPS interop documentation | None | Medium (writing) |

**Recommended order:** 1 → 2 → 8 → 4 → 5 → 3 → 7 → 6 → 9 → 10

Start with the critical bug fix (Task 1), then quick wins (8, 4, 5), then medium features (2, 3, 7), then the large refactor (6), and finally the new feature (9) and documentation (10).
