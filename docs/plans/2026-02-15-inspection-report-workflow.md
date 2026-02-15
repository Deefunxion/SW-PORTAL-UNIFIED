# Inspection Report Workflow Overhaul — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give social workers a clear, one-click "Νέα Έκθεση Ελέγχου" workflow with standardized evaluation criteria from the Ministerial Decision, and clarify the confusing tab structure.

**Architecture:** Three changes — (1) Add "Νέος Έλεγχος" creation dialog + "Νέα Έκθεση" shortcut button to the InspectionsTab, (2) Enrich INSPECTION_CRITERIA with Ministerial Decision fields extracted from the .doc/.docx templates, (3) Rename the "Εκθέσεις" tab to "Αναφορές Κ.Σ." to distinguish advisor reports from inspection reports.

**Tech Stack:** React (existing shadcn/ui components), Flask API (existing endpoints), python-docx (to extract template structure from .docx files)

---

## Context: What's Broken

### Current Flow (broken)
1. User opens Structure → Inspections tab
2. Sees table of existing inspections (or empty state with no action)
3. **No button to create a new inspection** — dead end
4. If an inspection exists, can click "Σύνταξη" to write report
5. Tab "Εκθέσεις" actually shows Advisor Reports, not Inspection Reports — confusing naming

### Target Flow
1. User opens Structure → **Έλεγχοι** tab
2. Sees existing inspections table + **prominent "Νέος Έλεγχος" button**
3. Clicks button → dialog to select type, committee, date
4. After creation → **auto-navigates to report form** with Ministerial Decision checklist
5. Tab **"Αναφορές Κ.Σ."** clearly shows Advisor Reports (separate from inspection reports)

---

## Task 1: Extract Ministerial Decision Template Structure

**Goal:** Parse the .docx files in `content/ΕΚΘΕΣΕΙΣ_ΕΛΕΓΧΩΝ/` to extract the actual evaluation categories and criteria, then update `INSPECTION_CRITERIA` in constants.js.

**Files:**
- Read: `content/ΕΚΘΕΣΕΙΣ_ΕΛΕΓΧΩΝ/ΕΚΘΕΣΕΙΣ ΑΞΙΟΛΟΓΗΣΗΣ/*.doc` and `content/ΕΚΘΕΣΕΙΣ_ΕΛΕΓΧΩΝ/Εκθέσεις_Τελικές/*.docx`
- Create: `scripts/extract_templates.py` (one-time utility script)
- Modify: `frontend/src/features/registry/lib/constants.js` (INSPECTION_CRITERIA)

**Step 1: Write template extraction script**

```python
# scripts/extract_templates.py
"""
One-time script to extract evaluation criteria from Ministerial Decision
.docx templates in content/ΕΚΘΕΣΕΙΣ_ΕΛΕΓΧΩΝ/
Outputs structured JSON that maps to INSPECTION_CRITERIA format.
"""
import json
import os
import sys

try:
    from docx import Document
except ImportError:
    print("Install python-docx: pip install python-docx")
    sys.exit(1)

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), '..', 'content', 'ΕΚΘΕΣΕΙΣ_ΕΛΕΓΧΩΝ')

def extract_docx(path):
    """Extract text content and table structure from a .docx file."""
    doc = Document(path)
    result = {'paragraphs': [], 'tables': []}
    for para in doc.paragraphs:
        if para.text.strip():
            result['paragraphs'].append({
                'text': para.text.strip(),
                'style': para.style.name if para.style else None,
                'bold': any(run.bold for run in para.runs),
            })
    for table in doc.tables:
        table_data = []
        for row in table.rows:
            table_data.append([cell.text.strip() for cell in row.cells])
        result['tables'].append(table_data)
    return result

def main():
    output = {}
    for root, dirs, files in os.walk(TEMPLATE_DIR):
        for f in files:
            if f.endswith('.docx'):
                path = os.path.join(root, f)
                print(f"Extracting: {f}")
                try:
                    output[f] = extract_docx(path)
                except Exception as e:
                    print(f"  Error: {e}")

    out_path = os.path.join(os.path.dirname(__file__), 'template_structure.json')
    with open(out_path, 'w', encoding='utf-8') as fp:
        json.dump(output, fp, ensure_ascii=False, indent=2)
    print(f"\nOutput: {out_path}")

if __name__ == '__main__':
    main()
```

**Step 2: Run the extraction script**

Run: `python scripts/extract_templates.py`
Expected: JSON file with table structures from the .docx templates

**Step 3: Map extracted criteria to INSPECTION_CRITERIA**

Based on the templates and structure types, update `constants.js` with enriched criteria. The key additions:

- **MFPAD** (Μονάδα Φροντίδας Παιδιών/Ατόμων με Αναπηρία) — new type from `ΜΦΠΑΔ.docx`
- **CAMP** (Κατασκήνωση) — new type from `ΕΝΤΥΠΟ ΠΡΟΕΛΕΓΧΟΥ ΠΑΙΔΙΚΗΣ ΚΑΤΑΣΚΗΝΩΣΗΣ`
- Add `legal_ref` and `is_required` to existing MFH, KDAP, SYD, KDHF-KAA criteria
- Add missing criteria categories from the Ministerial templates

Update in `frontend/src/features/registry/lib/constants.js`:

```javascript
// Add to INSPECTION_CRITERIA:
MFPAD: {
    label: 'Μονάδα Φροντίδας Παιδιών/Ατόμων με Αναπηρία',
    categories: ['Στελέχωση', 'Υγιεινή & Ασφάλεια', 'Φροντίδα & Υπηρεσίες', 'Υποδομές & Εξοπλισμός'],
    criteria: [
      // ... extracted from ΜΦΠΑΔ.docx template
    ],
},
CAMP: {
    label: 'Παιδική Κατασκήνωση',
    categories: ['Στελέχωση', 'Ασφάλεια', 'Υγιεινή', 'Υποδομές', 'Πρόγραμμα'],
    criteria: [
      // ... extracted from ΕΝΤΥΠΟ ΠΡΟΕΛΕΓΧΟΥ template
    ],
},
```

Also enrich existing types with `legal_ref` and `is_required` fields. Example for MFH:

```javascript
{ id: 'staff_ratio', label: 'Αναλογία προσωπικού / ωφελούμενων', category: 'Στελέχωση',
  legal_ref: 'ΥΑ Π1γ/οικ.81551 Άρθρο 4', is_required: true },
```

**Step 4: Commit**

```bash
git add scripts/extract_templates.py frontend/src/features/registry/lib/constants.js
git commit -m "feat: enrich inspection criteria from Ministerial Decision templates"
```

---

## Task 2: Add "Νέος Έλεγχος" Dialog to InspectionsTab

**Goal:** Social workers can create a new inspection directly from the structure's Inspections tab.

**Files:**
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx:319-378` (InspectionsTab function)

**Step 1: Add state and dialog to InspectionsTab**

Add to the `InspectionsTab` component (inside `StructureDetailPage.jsx`):

```jsx
// At top of InspectionsTab function, add:
const navigate = useNavigate();
const [committees, setCommittees] = useState([]);
const [showCreate, setShowCreate] = useState(false);
const [newInspection, setNewInspection] = useState({
  type: 'regular',
  committee_id: '',
  scheduled_date: new Date().toISOString().split('T')[0],
  notes: '',
});
const [creating, setCreating] = useState(false);

// Fetch committees for the dropdown
useEffect(() => {
  committeesApi.list()
    .then(({ data }) => setCommittees(data))
    .catch(() => {});
}, []);

const handleCreateInspection = async () => {
  if (!newInspection.committee_id) {
    toast.error('Επιλέξτε επιτροπή ελέγχου.');
    return;
  }
  setCreating(true);
  try {
    const { data } = await inspectionsApi.create({
      structure_id: structureId,
      ...newInspection,
      committee_id: parseInt(newInspection.committee_id),
    });
    toast.success('Ο έλεγχος δημιουργήθηκε.');
    setShowCreate(false);
    // Navigate directly to the report form
    navigate(`/inspections/${data.id}/report`);
  } catch (err) {
    toast.error(err.response?.data?.error || 'Σφάλμα δημιουργίας.');
  } finally {
    setCreating(false);
  }
};
```

**Step 2: Add the button and dialog JSX**

Replace the empty state and add a button bar above the table:

```jsx
return (
  <div className="space-y-4">
    {/* Action bar */}
    <div className="flex justify-between items-center">
      <p className="text-sm text-[#8a8580]">{inspections.length} έλεγχοι</p>
      <Button
        onClick={() => setShowCreate(true)}
        className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]"
      >
        <Plus className="w-4 h-4 mr-2" />
        Νέος Έλεγχος
      </Button>
    </div>

    {/* Existing inspections table (keep as-is) */}
    {inspections.length === 0 ? (
      <EmptyState message="Δεν υπάρχουν καταγεγραμμένοι έλεγχοι." />
    ) : (
      <div className="rounded-xl border border-[#e8e2d8] overflow-hidden">
        {/* ... existing table ... */}
      </div>
    )}

    {/* Create Inspection Dialog */}
    <Dialog open={showCreate} onOpenChange={setShowCreate}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Νέος Έλεγχος</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Τύπος Ελέγχου *</Label>
            <Select
              value={newInspection.type}
              onValueChange={(v) => setNewInspection(prev => ({ ...prev, type: v }))}
            >
              <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INSPECTION_TYPES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Επιτροπή Ελέγχου *</Label>
            <Select
              value={newInspection.committee_id}
              onValueChange={(v) => setNewInspection(prev => ({ ...prev, committee_id: v }))}
            >
              <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                <SelectValue placeholder="Επιλέξτε επιτροπή..." />
              </SelectTrigger>
              <SelectContent>
                {committees.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.decision_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ημερομηνία Ελέγχου *</Label>
            <Input
              type="date"
              value={newInspection.scheduled_date}
              onChange={(e) => setNewInspection(prev => ({ ...prev, scheduled_date: e.target.value }))}
              className="min-h-[44px] border-[#e8e2d8]"
            />
          </div>
          <div>
            <Label>Σημειώσεις</Label>
            <Textarea
              value={newInspection.notes}
              onChange={(e) => setNewInspection(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Προαιρετικές σημειώσεις..."
              className="min-h-[44px] border-[#e8e2d8]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowCreate(false)} className="border-[#e8e2d8]">
            Ακύρωση
          </Button>
          <Button
            onClick={handleCreateInspection}
            disabled={creating}
            className="bg-[#1a3aa3] hover:bg-[#152e82] text-white"
          >
            {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Δημιουργία & Σύνταξη Έκθεσης
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
);
```

**Step 3: Add missing imports at top of StructureDetailPage.jsx**

```javascript
// Add to existing imports:
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { committeesApi, inspectionsApi } from '../lib/registryApi';
// Plus icon already imported if used in ReportsTab, verify.
```

Note: `Dialog`, `Select`, etc. may already be imported for other dialogs in the file (e.g., `LicenseCreateDialog`, `SanctionForm`). Check existing imports first before adding duplicates.

**Step 4: Verify the API call works**

The backend `POST /api/inspections` endpoint already exists and expects:
```json
{
  "structure_id": 1,
  "committee_id": 1,
  "type": "regular",
  "scheduled_date": "2026-02-15"
}
```
No backend changes needed.

**Step 5: Commit**

```bash
git add frontend/src/features/registry/pages/StructureDetailPage.jsx
git commit -m "feat: add 'Νέος Έλεγχος' creation dialog to InspectionsTab"
```

---

## Task 3: Add "Νέα Έκθεση Ελέγχου" Quick Action to Empty/Scheduled States

**Goal:** When inspections are scheduled but have no reports, show a prominent call-to-action. Also improve the empty state to guide the user.

**Files:**
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx:319-378` (InspectionsTab)

**Step 1: Enhance the inspection table to highlight pending reports**

Add a visual indicator for inspections that are scheduled but have no report yet:

```jsx
{/* In the Έκθεση column, replace the current link: */}
<TableCell>
  {insp.report ? (
    <Link
      to={`/inspections/${insp.id}/report`}
      className="inline-flex items-center text-[#1a3aa3] hover:text-[#152e82] text-sm transition-colors"
    >
      <FileText className="w-3 h-3 mr-1" />
      Προβολή
    </Link>
  ) : insp.status === 'scheduled' ? (
    <Link
      to={`/inspections/${insp.id}/report`}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1a3aa3] text-white text-sm rounded-md hover:bg-[#152e82] transition-colors font-medium"
    >
      <FileText className="w-3.5 h-3.5" />
      Σύνταξη Έκθεσης
    </Link>
  ) : (
    <span className="text-[#8a8580] text-sm">—</span>
  )}
</TableCell>
```

**Step 2: Improve empty state**

Replace the bare empty state with an actionable one:

```jsx
{inspections.length === 0 ? (
  <div className="text-center py-16 border-2 border-dashed border-[#e8e2d8] rounded-xl bg-[#faf8f4]">
    <Shield className="w-12 h-12 text-[#8a8580] mx-auto mb-4" />
    <p className="text-[#6b6560] mb-4">Δεν υπάρχουν καταγεγραμμένοι έλεγχοι.</p>
    <Button
      onClick={() => setShowCreate(true)}
      className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px] px-6"
    >
      <Plus className="w-4 h-4 mr-2" />
      Δημιουργία Πρώτου Ελέγχου
    </Button>
  </div>
) : (
  // ... existing table ...
)}
```

**Step 3: Commit**

```bash
git add frontend/src/features/registry/pages/StructureDetailPage.jsx
git commit -m "feat: highlight pending reports + actionable empty state in InspectionsTab"
```

---

## Task 4: Rename "Εκθέσεις" Tab to "Αναφορές Κ.Σ."

**Goal:** Clarify that the "Reports" tab shows Advisor Reports (Κοινωνικού Συμβούλου), not Inspection Reports.

**Files:**
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx:798-802` (tab trigger)

**Step 1: Update the tab label**

```jsx
{/* Change this: */}
<TabsTrigger value="reports" className="data-[state=active]:bg-white">
  <FileText className="w-4 h-4 mr-1.5" />
  Εκθέσεις
</TabsTrigger>

{/* To this: */}
<TabsTrigger value="reports" className="data-[state=active]:bg-white">
  <FileText className="w-4 h-4 mr-1.5" />
  Αναφορές Κ.Σ.
</TabsTrigger>
```

**Step 2: Update the ReportsTab empty state message**

```jsx
{/* Change: */}
<EmptyState message="Δεν υπάρχουν εκθέσεις κοινωνικού συμβούλου." />

{/* To: */}
<EmptyState message="Δεν υπάρχουν αναφορές Κοινωνικού Συμβούλου." />
```

**Step 3: Update the button label in ReportsTab**

```jsx
{/* Change: */}
<Plus className="w-4 h-4 mr-2" />
Νέα Αναφορά

{/* To: */}
<Plus className="w-4 h-4 mr-2" />
Νέα Αναφορά Κ.Σ.
```

**Step 4: Commit**

```bash
git add frontend/src/features/registry/pages/StructureDetailPage.jsx
git commit -m "fix: rename 'Εκθέσεις' tab to 'Αναφορές Κ.Σ.' for clarity"
```

---

## Task 5: Add Prominent Report Count Badges to Inspection Tab Header

**Goal:** Show at a glance how many inspections have reports vs how many are pending.

**Files:**
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx:795-798` (inspections tab trigger)

**Step 1: Pass inspection count to tab (lift state or use context)**

This is optional/cosmetic. Add a badge showing pending report count:

```jsx
<TabsTrigger value="inspections" className="data-[state=active]:bg-white">
  <Shield className="w-4 h-4 mr-1.5" />
  Έλεγχοι
</TabsTrigger>
```

For now, keep this simple — the tab name is already clear. This task can be skipped if the other changes are sufficient.

**Step 2: Commit (if changes made)**

```bash
git add frontend/src/features/registry/pages/StructureDetailPage.jsx
git commit -m "feat: add inspection count badge to tab header"
```

---

## Task 6: Enrich InspectionForm with Structure-Type Header

**Goal:** When writing a new inspection report, prominently show which Ministerial Decision template is being used, with the structure type name and template version.

**Files:**
- Modify: `frontend/src/features/registry/components/InspectionForm.jsx`

**Step 1: Add template info banner**

Above the protocol number card, add:

```jsx
{/* Ministerial Decision Template Info */}
{structureTypeCode && (
  <Card className="border-blue-200 bg-blue-50/50">
    <CardContent className="pt-4 pb-4">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-5 h-5 text-[#1a3aa3]" />
        <div>
          <p className="text-sm font-semibold text-[#1a3aa3]">
            Πρότυπο Υπουργικής Απόφασης
          </p>
          <p className="text-xs text-[#6b6560]">
            Έκθεση Αξιολόγησης — {INSPECTION_CRITERIA[structureTypeCode]?.label || 'Γενικά κριτήρια'}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
)}
```

**Step 2: Add import**

```javascript
import { ClipboardCheck } from 'lucide-react';
import { INSPECTION_CRITERIA } from '../lib/constants';
```

**Step 3: Commit**

```bash
git add frontend/src/features/registry/components/InspectionForm.jsx
git commit -m "feat: show Ministerial Decision template name in InspectionForm"
```

---

## Task 7: Manual Smoke Test Checklist

After all tasks are done, verify the full workflow:

1. **Start backend:** `cd backend && python app.py`
2. **Start frontend:** `cd frontend && npx pnpm dev`
3. **Login as `mpapadopoulou/staff123`** (committee member)
4. **Navigate:** Εποπτεία → select a structure → Έλεγχοι tab

**Verify:**
- [ ] "Νέος Έλεγχος" button is visible
- [ ] Clicking it opens dialog with type, committee, date fields
- [ ] After creating → navigates to report form
- [ ] Report form shows "Πρότυπο Υπουργικής Απόφασης" banner with correct structure type
- [ ] Checklist criteria match the structure type (MFH has staffing, hygiene, care, infrastructure)
- [ ] "Σύνταξη Έκθεσης" button appears on scheduled inspections without reports
- [ ] "Αναφορές Κ.Σ." tab shows advisor reports (not inspection reports)
- [ ] Empty state in Inspections tab has "Δημιουργία Πρώτου Ελέγχου" button

---

## Dependency Graph

```
Task 1 (extract templates) ──→ feeds into Task 2/3/6 (enriched criteria)
Task 2 (create dialog) ──────→ Task 3 (enhanced states)
Task 4 (rename tab) ─────────→ independent
Task 5 (tab badges) ─────────→ independent (optional)
Task 6 (form banner) ────────→ independent
Task 7 (smoke test) ─────────→ after all tasks
```

Tasks 1, 4, 5, 6 can run in parallel. Task 2 must complete before Task 3. Task 7 is final.

---

## Notes

- **No backend changes needed** — all API endpoints already exist (`POST /api/inspections`, `POST /api/inspections/:id/report`, `GET /api/committees`)
- **The .doc files (old Word format)** cannot be read by python-docx. Only .docx files will be parsed. For .doc files, use the existing INSPECTION_CRITERIA as best-effort mapping, and note which templates need manual extraction.
- **Keep existing InspectionChecklist component as-is** — it already supports both API templates and hardcoded fallback. We only update the constants data.
- **Don't over-engineer** — the checklist system already works. We're adding missing UX buttons and enriching the criteria data.
