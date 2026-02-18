# UX Fixes Bundle: Files, Inspections, Sanctions, OPS Export

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 user-reported UX issues: broken file downloads in 3 categories, non-functional draft saving for inspection reports, read-only sanctions table, and confusing "Εξαγωγή OPS" button.

**Architecture:** All fixes are frontend + backend edits to existing files. No new files, no new dependencies. Each task is independent and can be committed separately.

**Tech Stack:** React (JSX), Flask (Python), shadcn/ui components (AlertDialog, Badge, Button), Tailwind CSS

---

## Task 1: Fix inspection report draft saving (backend bug)

The "Αποθήκευση Πρόχειρου" button doesn't work. Two bugs:
1. Frontend never sends `status` in FormData
2. Backend hardcodes `status='submitted'` regardless

**Files:**
- Modify: `frontend/src/features/registry/components/InspectionForm.jsx:62-68`
- Modify: `backend/my_project/inspections/routes.py:126-164`
- Modify: `frontend/src/features/registry/pages/InspectionReportPage.jsx:36-98`

### Step 1: Fix frontend — send status in FormData

In `frontend/src/features/registry/components/InspectionForm.jsx`, line 68, add the status to FormData:

**Before (lines 62-68):**
```javascript
const formData = new FormData();
formData.append('findings', findings);
formData.append('recommendations', recommendations);
formData.append('protocol_number', protocolNumber);
if (conclusion) formData.append('conclusion', conclusion);
if (checklistData) formData.append('checklist_data', JSON.stringify(checklistData));
if (file) formData.append('file', file);
```

**After:**
```javascript
const formData = new FormData();
formData.append('findings', findings);
formData.append('recommendations', recommendations);
formData.append('protocol_number', protocolNumber);
formData.append('status', submitStatus);
if (conclusion) formData.append('conclusion', conclusion);
if (checklistData) formData.append('checklist_data', JSON.stringify(checklistData));
if (file) formData.append('file', file);
```

### Step 2: Fix backend — respect status from request

In `backend/my_project/inspections/routes.py`, modify the POST endpoint to read `status` from the form:

**Before (lines 126-164):**
```python
findings = request.form.get('findings', '')
recommendations = request.form.get('recommendations', '')
protocol_number = request.form.get('protocol_number', '')
conclusion = request.form.get('conclusion')
checklist_json = request.form.get('checklist_data')
# ...
report = InspectionReport(
    inspection_id=inspection_id,
    protocol_number=protocol_number,
    drafted_date=date.today(),
    findings=findings,
    recommendations=recommendations,
    checklist_data=checklist_data,
    file_path=file_path,
    status='submitted',
    submitted_by=user_id,
    submitted_at=datetime.utcnow(),
)
if conclusion:
    inspection.conclusion = conclusion
    inspection.status = 'completed'
```

**After:**
```python
findings = request.form.get('findings', '')
recommendations = request.form.get('recommendations', '')
protocol_number = request.form.get('protocol_number', '')
conclusion = request.form.get('conclusion')
checklist_json = request.form.get('checklist_data')
report_status = request.form.get('status', 'submitted')
if report_status not in ('draft', 'submitted'):
    report_status = 'submitted'
# ...
report = InspectionReport(
    inspection_id=inspection_id,
    protocol_number=protocol_number,
    drafted_date=date.today(),
    findings=findings,
    recommendations=recommendations,
    checklist_data=checklist_data,
    file_path=file_path,
    status=report_status,
    submitted_by=user_id,
    submitted_at=datetime.utcnow() if report_status == 'submitted' else None,
)
if conclusion and report_status == 'submitted':
    inspection.conclusion = conclusion
    inspection.status = 'completed'
```

### Step 3: Fix frontend — allow editing draft reports

In `frontend/src/features/registry/pages/InspectionReportPage.jsx`, change the condition at line 37 so that draft reports show the form instead of the read-only view:

**Before (line 37):**
```jsx
if (inspection.report) {
```

**After:**
```jsx
if (inspection.report && inspection.report.status !== 'draft') {
```

This means:
- `status='draft'` → shows editable form (pre-filled with saved data)
- `status='submitted'` or `status='approved'` → shows read-only view

### Step 4: Pre-fill form when editing a draft

Also in `InspectionReportPage.jsx`, pass the existing draft data to the form. Change the form rendering (lines 114-117):

**Before:**
```jsx
<InspectionForm
  inspection={inspection}
  onSuccess={() => navigate(`/registry/${inspection.structure_id}`)}
/>
```

**After:**
```jsx
<InspectionForm
  inspection={inspection}
  existingReport={inspection.report?.status === 'draft' ? inspection.report : null}
  onSuccess={() => navigate(`/registry/${inspection.structure_id}`)}
/>
```

Then in `InspectionForm.jsx`, accept and use `existingReport` prop to pre-fill form state. Add to the component props destructuring and use for initial state values:

```jsx
export default function InspectionForm({ inspection, existingReport, onSuccess }) {
  const [findings, setFindings] = useState(existingReport?.findings || '');
  const [recommendations, setRecommendations] = useState(existingReport?.recommendations || '');
  const [protocolNumber, setProtocolNumber] = useState(existingReport?.protocol_number || /* existing default */);
  const [conclusion, setConclusion] = useState(existingReport?.conclusion || inspection?.conclusion || '');
  const [checklistData, setChecklistData] = useState(existingReport?.checklist_data || null);
  // ... rest unchanged
```

### Step 5: Backend — handle draft update (PUT/re-POST)

The existing POST endpoint creates a new report. When updating an existing draft, it will fail because `inspection_id` has a UNIQUE constraint. Modify the POST endpoint to detect and update existing drafts:

Add after line 124 (`inspection = Inspection.query.get_or_404(inspection_id)`):

```python
# Check for existing draft — update instead of creating new
existing_report = InspectionReport.query.filter_by(inspection_id=inspection_id).first()
if existing_report:
    if existing_report.status != 'draft':
        return jsonify({'error': 'Η έκθεση έχει ήδη υποβληθεί'}), 409
    # Update existing draft
    existing_report.findings = findings
    existing_report.recommendations = recommendations
    existing_report.protocol_number = protocol_number
    existing_report.checklist_data = checklist_data
    if file_path:
        existing_report.file_path = file_path
    existing_report.status = report_status
    if report_status == 'submitted':
        existing_report.submitted_at = datetime.utcnow()
        existing_report.submitted_by = user_id
        if conclusion:
            inspection.conclusion = conclusion
            inspection.status = 'completed'
    db.session.commit()
    return jsonify(existing_report.to_dict()), 200
```

Place this block AFTER the file upload logic (after line 148) but BEFORE the `report = InspectionReport(...)` constructor (before line 150).

### Step 6: Commit

```bash
git add frontend/src/features/registry/components/InspectionForm.jsx \
      frontend/src/features/registry/pages/InspectionReportPage.jsx \
      backend/my_project/inspections/routes.py
git commit -m "fix: enable draft saving for inspection reports

- Frontend now sends status field in FormData (draft vs submitted)
- Backend reads status from request instead of hardcoding 'submitted'
- Draft reports show editable form instead of read-only view
- Existing drafts are updated in-place (not duplicated)"
```

---

## Task 2: Fix file browser — tree view with auto-expanded subfolders

Categories with files only in subfolders (Αποφάσεις Αδειοδότησης, Εκθέσεις Ελέγχων) appear empty because the UI only shows root-level files. Fix: auto-expand the first subfolder when root has no files, and show a combined tree view.

**Files:**
- Modify: `frontend/src/pages/ApothecaryPage.jsx:248-522` (renderDropdownContent function)

### Step 1: Auto-expand first subfolder when root has no files

In `ApothecaryPage.jsx`, modify the `handleCategoryClick` function (around lines 93-111). After setting the dropdown content, auto-expand the first subfolder if there are no root files:

Add at the end of the `if (matchingFolder)` block (after line 107, before the closing `}`):

```javascript
// Auto-expand first subfolder when category has no root files
const rootFiles = matchingFolder.files || [];
const subs = matchingFolder.subfolders || [];
if (rootFiles.length === 0 && subs.length === 1) {
  const autoKey = `${index}_${subs[0].category || subs[0].name}`;
  setExpandedSubfolder(autoKey);
}
```

### Step 2: Show file count badge that includes subfolder files

In `renderDropdownContent`, add a summary banner when there are no root files but subfolders have files. Insert after the folder header section (after line 300, before the subfolders section at line 303):

```jsx
{/* Summary when root has no files but subfolders do */}
{(!content.files || content.files.length === 0) && content.subfolders && content.subfolders.length > 0 && (
  <div className="bg-[#eef1f8] border-2 border-[#d0d8ee] rounded-xl p-4 text-center">
    <p className="text-sm text-[#6b6560]">
      Τα αρχεία βρίσκονται στους υποφακέλους παρακάτω. Κάντε κλικ σε έναν υποφάκελο για να δείτε τα αρχεία.
    </p>
  </div>
)}
```

### Step 3: Allow multiple subfolders to be expanded simultaneously

Currently `expandedSubfolder` is a single string, so only one subfolder can be open at a time. Change to a Set to allow multiple:

**State change (line 37):**
```javascript
// Before:
const [expandedSubfolder, setExpandedSubfolder] = useState(null);

// After:
const [expandedSubfolders, setExpandedSubfolders] = useState(new Set());
```

**handleSubfolderClick change (lines 186-210):**
```javascript
const handleSubfolderClick = async (subfolder, categoryIndex) => {
  const subfolderKey = `${categoryIndex}_${subfolder.category || subfolder.name}`;

  setExpandedSubfolders(prev => {
    const next = new Set(prev);
    if (next.has(subfolderKey)) {
      next.delete(subfolderKey);
    } else {
      next.add(subfolderKey);
    }
    return next;
  });
};
```

**Update all references** from `expandedSubfolder === subfolderKey` to `expandedSubfolders.has(subfolderKey)`:
- Line 312: `const isExpanded = expandedSubfolders.has(subfolderKey);`

**Reset on category change (line 64):**
```javascript
setExpandedSubfolders(new Set());
```

**Auto-expand update (from Step 1):**
```javascript
if (rootFiles.length === 0 && subs.length === 1) {
  const autoKey = `${index}_${subs[0].category || subs[0].name}`;
  setExpandedSubfolders(new Set([autoKey]));
}
```

### Step 4: Commit

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "fix: auto-expand subfolders in file browser when root is empty

- Auto-expand first subfolder when category has no root-level files
- Show helper text directing users to click subfolders
- Allow multiple subfolders to be expanded simultaneously"
```

---

## Task 3: Make sanctions rows clickable — link to related decision

Sanctions table rows are read-only with no actions. Fix: add a "Προβολή" action column that links to the related decision, and make rows visually clickable.

**Files:**
- Modify: `frontend/src/features/registry/pages/SanctionsPage.jsx:541-609`

### Step 1: Add action column to sanctions table

In `SanctionsPage.jsx`, modify the sanctions table (lines 562-605):

**Add header column (after line 570 `<TableHead>Σημειώσεις</TableHead>`):**
```jsx
<TableHead className="w-[80px]">Ενέργειες</TableHead>
```

**Add action cell (after the notes TableCell, before `</TableRow>` at line 601):**
```jsx
<TableCell>
  <div className="flex gap-1">
    {s.decision_id ? (
      <Link to={`/sanctions/decisions/${s.decision_id}`}>
        <Button variant="ghost" size="sm" title="Προβολή Απόφασης">
          <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </Link>
    ) : (
      <Button variant="ghost" size="sm" disabled title="Χωρίς συνδεδεμένη απόφαση">
        <ExternalLink className="w-3.5 h-3.5 opacity-30" />
      </Button>
    )}
  </div>
</TableCell>
```

### Step 2: Make rows visually clickable with hover effect

Change the `<TableRow>` at line 577:

**Before:**
```jsx
<TableRow key={s.id}>
```

**After:**
```jsx
<TableRow key={s.id} className={s.decision_id ? 'cursor-pointer hover:bg-[#f5f2ec] transition-colors' : ''}>
```

### Step 3: Verify backend returns decision_id

Check that the sanctions API returns `decision_id`. In `backend/my_project/sanctions/routes.py`, the `Sanction.to_dict()` method (or serialization) should include `decision_id`. If the Sanction model has a `decision_id` foreign key, it will be included automatically. If not, we need to look up the related decision by `structure_id` + matching violation.

**Verify in `backend/my_project/registry/models.py` or `backend/my_project/sanctions/models.py`:** Check if Sanction model has a `decision_id` column. If not, add it or use `structure_id` to look up decisions instead:

```python
# If decision_id doesn't exist on Sanction, use structure_id as fallback in the frontend:
# Link: /sanctions?structure={s.structure_id} (tab to decisions)
```

**Fallback if no decision_id:** Link to the decisions tab filtered by structure instead:

```jsx
<Link to={`/sanctions?structure=${s.structure_id}&tab=decisions`}>
  <Button variant="ghost" size="sm" title="Αποφάσεις Δομής">
    <ExternalLink className="w-3.5 h-3.5" />
  </Button>
</Link>
```

### Step 4: Commit

```bash
git add frontend/src/features/registry/pages/SanctionsPage.jsx
git commit -m "feat: add action buttons to sanctions table rows

- Add 'Ενέργειες' column with view button
- Link to related decision or filter decisions by structure
- Hover effect on clickable rows"
```

---

## Task 4: OPS Export — rename label + add confirmation dialog

"Εξαγωγή OPS" is confusing. Fix: rename to "Εξαγωγή Βεβαίωσης" and add a confirmation dialog explaining what will be exported.

**Files:**
- Modify: `frontend/src/features/registry/pages/SanctionsPage.jsx:105-119,693-701`

### Step 1: Add state for OPS confirmation dialog

At the top of the `SanctionsPage` component, add state for the dialog (near line 48):

```javascript
const [opsExportDialog, setOpsExportDialog] = useState({ open: false, decisionId: null });
```

### Step 2: Add AlertDialog import

Add to the imports at the top of the file:

```javascript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.jsx';
```

### Step 3: Modify the export button to open dialog instead of exporting directly

Change lines 693-701 (the OPS export button):

**Before:**
```jsx
{['approved', 'notified', 'paid'].includes(d.status) && (
  <Button
    variant="ghost" size="sm"
    title="Εξαγωγή OPS"
    onClick={() => handleExportDecision(d.id)}
  >
    <Download className="w-3.5 h-3.5" />
  </Button>
)}
```

**After:**
```jsx
{['approved', 'notified', 'paid'].includes(d.status) && (
  <Button
    variant="ghost" size="sm"
    title="Εξαγωγή Βεβαίωσης Εσόδου"
    onClick={() => setOpsExportDialog({ open: true, decisionId: d.id })}
  >
    <Download className="w-3.5 h-3.5" />
  </Button>
)}
```

### Step 4: Add the AlertDialog component

Add before the closing `</div>` of the main return (before line 715):

```jsx
{/* OPS Export Confirmation Dialog */}
<AlertDialog open={opsExportDialog.open} onOpenChange={(open) => setOpsExportDialog({ open, decisionId: open ? opsExportDialog.decisionId : null })}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Εξαγωγή Βεβαίωσης Εσόδου</AlertDialogTitle>
      <AlertDialogDescription className="space-y-2">
        <p>
          Θα εξαχθεί αρχείο JSON με τα στοιχεία της απόφασης για καταχώρηση
          στο Ολοκληρωμένο Πληροφοριακό Σύστημα (TAXIS/ΑΑΔΕ).
        </p>
        <p className="text-sm">Το αρχείο περιλαμβάνει:</p>
        <ul className="text-sm list-disc pl-5 space-y-1">
          <li>Αριθμό απόφασης & ημερομηνία έγκρισης</li>
          <li>Στοιχεία υπόχρεου (ΑΦΜ, ΔΟΥ, διεύθυνση)</li>
          <li>Ποσά ανά ΚΑΕ (κρατικός & περιφερειακός προϋπολογισμός)</li>
          <li>Νομική βάση επιβολής</li>
        </ul>
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Ακύρωση</AlertDialogCancel>
      <AlertDialogAction
        className="bg-[#1a3aa3] hover:bg-[#152e82] text-white"
        onClick={() => {
          handleExportDecision(opsExportDialog.decisionId);
          setOpsExportDialog({ open: false, decisionId: null });
        }}
      >
        Εξαγωγή
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Step 5: Update toast message

In `handleExportDecision` (line 115), update the success message:

**Before:**
```javascript
toast.success('Εξαγωγή OPS ολοκληρώθηκε');
```

**After:**
```javascript
toast.success('Η εξαγωγή βεβαίωσης εσόδου ολοκληρώθηκε');
```

### Step 6: Also update DecisionApprovalPage if it has "OPS" references

Search for any other "OPS" references in the codebase and rename them consistently:
- `frontend/src/features/registry/pages/DecisionApprovalPage.jsx` — search for "OPS" and rename to "Βεβαίωση Εσόδου"

### Step 7: Commit

```bash
git add frontend/src/features/registry/pages/SanctionsPage.jsx \
      frontend/src/features/registry/pages/DecisionApprovalPage.jsx
git commit -m "fix: rename 'Εξαγωγή OPS' to 'Βεβαίωση Εσόδου' with confirmation dialog

- Rename confusing OPS label across sanctions and decisions pages
- Add AlertDialog explaining what data will be exported
- Lists exported fields: decision number, obligor details, amounts, legal basis"
```

---

## Execution Order

Tasks are independent — execute in any order. Recommended: Task 1 first (bug fix), then 2, 3, 4.

| Task | Type | Complexity | Files Changed |
|------|------|------------|---------------|
| 1. Draft saving bug | Bug fix | Medium | 3 files (FE + BE) |
| 2. File browser tree | UX fix | Easy | 1 file (FE) |
| 3. Sanctions actions | UX enhancement | Easy | 1 file (FE) |
| 4. OPS rename + dialog | UX fix | Easy | 1-2 files (FE) |
