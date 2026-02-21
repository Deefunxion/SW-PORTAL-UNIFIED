# Inspector Body Expansion — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow a Social Advisor (Κοινωνικός Σύμβουλος) to perform inspections with checklists, not just write reports — making "inspection body" = committee OR individual advisor.

**Architecture:** Make `Inspection.committee_id` nullable, add `Inspection.inspector_id` (FK→users). Exactly one of the two must be set. Frontend dialog changes "Επιτροπή Ελέγχου" dropdown to "Ελεγκτικό Όργανο" with two modes: Committee or Social Advisor. Everything else (checklist, report, PDF) stays the same.

**Tech Stack:** Flask, SQLAlchemy, React 18, shadcn/ui

**Prerequisite:** Must be implemented BEFORE the IRIDA Phase 1 plan (`2026-02-20-irida-phase1-implementation.md`).

---

### Task 1: Make committee_id nullable and add inspector_id to Inspection model

**Files:**
- Modify: `backend/my_project/inspections/models.py:78-102`
- Modify: `backend/my_project/__init__.py:142-171` (auto-migration list)
- Create: `tests/test_inspections/test_inspector_body.py`
- Create: `tests/test_inspections/__init__.py` (if doesn't exist)

**Step 1: Write the failing test**

Create `tests/test_inspections/__init__.py` (empty) if it doesn't exist.

Create `tests/test_inspections/test_inspector_body.py`:

```python
"""Tests for inspection with Social Advisor as inspector body."""
from datetime import date


class TestInspectorBody:
    def test_inspection_with_inspector_instead_of_committee(self, app):
        """An inspection can have inspector_id instead of committee_id."""
        with app.app_context():
            from my_project.inspections.models import Inspection
            from my_project.registry.models import Structure, StructureType
            from my_project.models import User
            from my_project.extensions import db

            # Create structure
            st = StructureType.query.first()
            if not st:
                st = StructureType(name='Test', code='TST')
                db.session.add(st)
                db.session.flush()
            s = Structure(name='Test Structure', code='TS01',
                          type_id=st.id, representative='Rep', status='active')
            db.session.add(s)

            # Create inspector user
            inspector = User.query.filter_by(username='inspector_test').first()
            if not inspector:
                inspector = User(username='inspector_test',
                                 email='inspector@test.com', role='staff')
                inspector.set_password('pass123')
                db.session.add(inspector)
            db.session.flush()

            insp = Inspection(
                structure_id=s.id,
                committee_id=None,
                inspector_id=inspector.id,
                type='regular',
                scheduled_date=date.today(),
            )
            db.session.add(insp)
            db.session.commit()

            assert insp.id is not None
            assert insp.committee_id is None
            assert insp.inspector_id == inspector.id

    def test_to_dict_includes_inspector_info(self, app):
        """to_dict() should include inspector data when set."""
        with app.app_context():
            from my_project.inspections.models import Inspection
            from my_project.registry.models import Structure, StructureType
            from my_project.models import User
            from my_project.extensions import db

            st = StructureType.query.first()
            if not st:
                st = StructureType(name='Test2', code='TS2')
                db.session.add(st)
                db.session.flush()
            s = Structure(name='Dict Test', code='DT01',
                          type_id=st.id, representative='Rep', status='active')
            db.session.add(s)

            inspector = User.query.filter_by(username='inspector_dict').first()
            if not inspector:
                inspector = User(username='inspector_dict',
                                 email='insdict@test.com', role='staff')
                inspector.set_password('pass123')
                db.session.add(inspector)
            db.session.flush()

            insp = Inspection(
                structure_id=s.id,
                inspector_id=inspector.id,
                type='regular',
                scheduled_date=date.today(),
            )
            db.session.add(insp)
            db.session.commit()

            d = insp.to_dict()
            assert d['inspector_id'] == inspector.id
            assert d['inspector'] is not None
            assert d['inspector']['username'] == 'inspector_dict'
            assert d['committee_id'] is None
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_inspections/test_inspector_body.py -v`
Expected: FAIL — `TypeError: ... unexpected keyword argument 'inspector_id'`

**Step 3: Modify the Inspection model**

In `backend/my_project/inspections/models.py`, change the Inspection class (lines 78-102):

```python
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
        if self.inspector:
            d['inspector'] = self.inspector.to_dict()
        else:
            d['inspector'] = None
        return d
```

Key change: `committee_id` is now `nullable=True`, and `inspector_id` is added.

Add auto-migration entry in `backend/my_project/__init__.py` — append to `_migrate_columns` list:

```python
            # Inspector body expansion — Κ.Σ. can perform inspections
            ('inspections', 'inspector_id', 'INTEGER'),
```

Also need to handle the `nullable=True` for `committee_id` — since the column already exists as NOT NULL, add an ALTER:

```python
        # Make committee_id nullable (inspector body expansion)
        try:
            db.session.execute(db.text(
                "ALTER TABLE inspections ALTER COLUMN committee_id DROP NOT NULL"
            ))
            db.session.commit()
        except Exception:
            db.session.rollback()
```

Add this after the `_migrate_columns` loop (after line 179).

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_inspections/test_inspector_body.py -v`
Expected: 2 passed

**Step 5: Commit**

```bash
git add backend/my_project/inspections/models.py backend/my_project/__init__.py tests/test_inspections/
git commit -m "feat(inspections): add inspector_id to Inspection, make committee_id nullable"
```

---

### Task 2: Update inspection routes to accept inspector_id

**Files:**
- Modify: `backend/my_project/inspections/routes.py:67-109`
- Create: `tests/test_inspections/test_inspection_api.py`

**Step 1: Write the failing test**

Create `tests/test_inspections/test_inspection_api.py`:

```python
"""Tests for inspection API with inspector body support."""
from datetime import date


def _create_structure(app):
    """Helper: create a structure for testing."""
    from my_project.registry.models import Structure, StructureType
    from my_project.extensions import db

    with app.app_context():
        st = StructureType.query.first()
        if not st:
            st = StructureType(name='API Test Type', code='APT')
            db.session.add(st)
            db.session.flush()
        s = Structure(name='API Test Structure', code='AP01',
                      type_id=st.id, representative='Rep', status='active')
        db.session.add(s)
        db.session.commit()
        return s.id


class TestInspectionAPIWithInspector:
    def test_create_inspection_with_inspector_id(self, app, client, admin_headers):
        sid = _create_structure(app)
        # Get admin user ID
        with app.app_context():
            from my_project.models import User
            admin = User.query.filter_by(username='testadmin').first()
            admin_id = admin.id

        resp = client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'inspector_id': admin_id,
            'type': 'regular',
            'scheduled_date': date.today().isoformat(),
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['inspector_id'] == admin_id
        assert data['committee_id'] is None

    def test_create_inspection_without_body_fails(self, app, client, admin_headers):
        sid = _create_structure(app)
        resp = client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'type': 'regular',
            'scheduled_date': date.today().isoformat(),
        })
        assert resp.status_code == 400
        assert 'ελεγκτικό' in resp.get_json()['error'].lower() or 'committee' in resp.get_json()['error'].lower()

    def test_get_inspection_includes_inspector(self, app, client, admin_headers):
        sid = _create_structure(app)
        with app.app_context():
            from my_project.models import User
            admin = User.query.filter_by(username='testadmin').first()
            admin_id = admin.id

        resp = client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'inspector_id': admin_id,
            'type': 'regular',
            'scheduled_date': date.today().isoformat(),
        })
        insp_id = resp.get_json()['id']

        resp = client.get(f'/api/inspections/{insp_id}', headers=admin_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['inspector'] is not None
        assert data['inspector']['username'] == 'testadmin'

    def test_list_inspections_filter_by_inspector(self, app, client, admin_headers):
        sid = _create_structure(app)
        with app.app_context():
            from my_project.models import User
            admin = User.query.filter_by(username='testadmin').first()
            admin_id = admin.id

        client.post('/api/inspections', headers=admin_headers, json={
            'structure_id': sid,
            'inspector_id': admin_id,
            'type': 'regular',
            'scheduled_date': date.today().isoformat(),
        })

        resp = client.get(f'/api/inspections?inspector_id={admin_id}',
                          headers=admin_headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data['inspections']) >= 1
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_inspections/test_inspection_api.py -v`
Expected: FAIL — 400 "Missing field: committee_id"

**Step 3: Update the routes**

In `backend/my_project/inspections/routes.py`:

**Update `create_inspection` (lines 67-95):**

Replace lines 75-88 with:

```python
    data = request.get_json()

    # Require structure_id, type, scheduled_date
    for field in ['structure_id', 'type', 'scheduled_date']:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400

    # Require either committee_id or inspector_id (not both, not neither)
    has_committee = bool(data.get('committee_id'))
    has_inspector = bool(data.get('inspector_id'))
    if not has_committee and not has_inspector:
        return jsonify({
            'error': 'Απαιτείται ελεγκτικό όργανο (επιτροπή ή κοιν. σύμβουλος)'
        }), 400

    inspection = Inspection(
        structure_id=data['structure_id'],
        committee_id=data.get('committee_id'),
        inspector_id=data.get('inspector_id'),
        type=data['type'],
        scheduled_date=_parse_date(data['scheduled_date']),
        status=data.get('status', 'scheduled'),
        notes=data.get('notes'),
    )
```

**Update `list_inspections` (lines 25-64) — add inspector_id filter:**

After line 40 (`if committee_id:`), add:

```python
    inspector_id = request.args.get('inspector_id', type=int)
    if inspector_id:
        query = query.filter_by(inspector_id=inspector_id)
```

**Update `get_inspection` (lines 98-109) — include inspector info:**

Replace line 105 with:

```python
    result['committee'] = inspection.committee.to_dict(include_members=True) if inspection.committee else None
    result['inspector'] = inspection.inspector.to_dict() if inspection.inspector else None
```

**Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_inspections/test_inspection_api.py -v`
Expected: 4 passed

**Step 5: Run all tests**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All pass (existing inspection tests that provide committee_id still work)

**Step 6: Commit**

```bash
git add backend/my_project/inspections/routes.py tests/test_inspections/test_inspection_api.py
git commit -m "feat(inspections): support inspector_id in create/list/get inspection routes"
```

---

### Task 3: Frontend — Change inspection creation dialog to support both body types

**Files:**
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx:362-585`
- Modify: `frontend/src/features/registry/lib/registryApi.js` (add social advisors API)

**Step 1: Add API method for fetching social advisors**

In `frontend/src/features/registry/lib/registryApi.js`, add to `oversightApi`:

```javascript
  socialAdvisors: () => api.get('/api/user-roles').then(resp => ({
    data: (resp.data || []).filter(r => r.role === 'social_advisor'),
  })),
```

**Step 2: Modify InspectionsTab in StructureDetailPage.jsx**

Replace the `InspectionsTab` component (lines 362-585). The key changes:

1. New state: `inspectorBody` = `'committee'` | `'advisor'`
2. New state: `advisors` fetched from API
3. Form state adds `inspector_id` field
4. Dropdown label changes from "Επιτροπή Ελέγχου" to "Ελεγκτικό Όργανο"
5. Radio/toggle to switch between Committee and Social Advisor
6. Different dropdown shown based on selection

Replace the form state initialization (lines 368-373):

```javascript
  const [newInspection, setNewInspection] = useState({
    type: 'regular',
    committee_id: '',
    inspector_id: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [inspectorBody, setInspectorBody] = useState('committee'); // 'committee' | 'advisor'
  const [advisors, setAdvisors] = useState([]);
```

Add advisor fetching alongside committees (after the committees useEffect):

```javascript
  useEffect(() => {
    oversightApi.socialAdvisors()
      .then(({ data }) => setAdvisors(data))
      .catch(() => {});
  }, []);
```

Add `oversightApi` to the imports at the top of the file (from `../lib/registryApi`).

Replace the `handleCreateInspection` validation (lines 389-393):

```javascript
  const handleCreateInspection = async () => {
    if (inspectorBody === 'committee' && !newInspection.committee_id) {
      toast.error('Επιλέξτε επιτροπή ελέγχου.');
      return;
    }
    if (inspectorBody === 'advisor' && !newInspection.inspector_id) {
      toast.error('Επιλέξτε κοινωνικό σύμβουλο.');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        structure_id: structureId,
        type: newInspection.type,
        scheduled_date: newInspection.scheduled_date,
        notes: newInspection.notes,
      };
      if (inspectorBody === 'committee') {
        payload.committee_id = parseInt(newInspection.committee_id);
      } else {
        payload.inspector_id = parseInt(newInspection.inspector_id);
      }
      const { data } = await inspectionsApi.create(payload);
      toast.success('Ο έλεγχος δημιουργήθηκε.');
      setShowCreate(false);
      navigate(`/inspections/${data.id}/report`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα δημιουργίας.');
    } finally {
      setCreating(false);
    }
  };
```

Replace the "Επιτροπή Ελέγχου" dropdown section in the dialog (lines 532-548) with:

```jsx
            <div>
              <Label>Ελεγκτικό Όργανο *</Label>
              <div className="flex gap-2 mt-1 mb-2">
                <Button
                  type="button"
                  variant={inspectorBody === 'committee' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setInspectorBody('committee');
                    setNewInspection(prev => ({ ...prev, inspector_id: '' }));
                  }}
                  className={inspectorBody === 'committee'
                    ? 'bg-[#1a3aa3] hover:bg-[#152e82] text-white'
                    : 'border-[#e8e2d8]'}
                >
                  Επιτροπή
                </Button>
                <Button
                  type="button"
                  variant={inspectorBody === 'advisor' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setInspectorBody('advisor');
                    setNewInspection(prev => ({ ...prev, committee_id: '' }));
                  }}
                  className={inspectorBody === 'advisor'
                    ? 'bg-[#1a3aa3] hover:bg-[#152e82] text-white'
                    : 'border-[#e8e2d8]'}
                >
                  Κοιν. Σύμβουλος
                </Button>
              </div>
              {inspectorBody === 'committee' ? (
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
                        {c.structure_type_name ? ` (${c.structure_type_name})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={newInspection.inspector_id}
                  onValueChange={(v) => setNewInspection(prev => ({ ...prev, inspector_id: v }))}
                >
                  <SelectTrigger className="min-h-[44px] border-[#e8e2d8]">
                    <SelectValue placeholder="Επιλέξτε κοιν. σύμβουλο..." />
                  </SelectTrigger>
                  <SelectContent>
                    {advisors.map((a) => (
                      <SelectItem key={a.user_id} value={String(a.user_id)}>
                        {a.user?.username || `User #${a.user_id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
```

**Step 3: Update InspectionForm header to show inspector**

In `frontend/src/features/registry/components/InspectionForm.jsx`, find the header section that displays committee info and add an alternative for inspector:

Where it shows `Επιτροπή:`, add:

```jsx
{inspection.inspector && (
  <p className="text-sm text-[#6b6560]">
    Κοιν. Σύμβουλος: {inspection.inspector.username}
  </p>
)}
```

**Step 4: Manual test**

1. Run backend + frontend
2. Navigate to a structure → Inspections tab
3. Click "Νέος Έλεγχος"
4. See toggle: "Επιτροπή" / "Κοιν. Σύμβουλος"
5. Select "Κοιν. Σύμβουλος" → dropdown shows available advisors
6. Create inspection → redirected to report form
7. Fill checklist and submit → works identically to committee inspection

**Step 5: Commit**

```bash
git add frontend/src/features/registry/pages/StructureDetailPage.jsx frontend/src/features/registry/lib/registryApi.js frontend/src/features/registry/components/InspectionForm.jsx
git commit -m "feat(inspections): UI supports Social Advisor as inspector body"
```

---

### Task 4: Update inspection table to show inspector body info

**Files:**
- Modify: `frontend/src/features/registry/pages/StructureDetailPage.jsx` (inspections table)

**Step 1: Add "Ελεγκτικό Όργανο" column to the inspections table**

In the `InspectionsTab` component, in the table header (around line 444), add a new column after "Τύπος":

```jsx
<TableHead>Ελεγκτικό Όργανο</TableHead>
```

In the table body, add a cell after the type cell:

```jsx
<TableCell className="text-sm text-[#6b6560]">
  {insp.inspector
    ? `Κ.Σ. ${insp.inspector.username}`
    : insp.committee_id
      ? `Επιτρ. #${insp.committee_id}`
      : '—'
  }
</TableCell>
```

**Step 2: Update the list API to include inspector info**

In `backend/my_project/inspections/routes.py`, in `list_inspections` (around line 50-56), update the serialization to include inspector info:

After `d['report'] = ...` add:

```python
        if i.inspector:
            d['inspector'] = i.inspector.to_dict()
```

**Step 3: Manual test**

Check the inspections table — new column shows "Κ.Σ. username" or "Επιτρ. #N".

**Step 4: Commit**

```bash
git add frontend/src/features/registry/pages/StructureDetailPage.jsx backend/my_project/inspections/routes.py
git commit -m "feat(inspections): show inspector body in inspections table"
```

---

### Task 5: Run all tests and verify no regressions

**Step 1: Run all backend tests**

Run: `python -m pytest tests/ -v --tb=short`
Expected: All pass

**Step 2: Check frontend builds**

Run (from frontend/): `npx pnpm build`
Expected: No errors

**Step 3: Manual end-to-end test**

1. Create inspection with **Committee** → works as before
2. Create inspection with **Social Advisor** → creates, report form works, checklist available
3. View inspection list → "Ελεγκτικό Όργανο" column displays correctly
4. Old inspections (committee-based) still display correctly

**Step 4: Commit**

```bash
git add -A
git commit -m "test(inspections): verify inspector body expansion — all tests pass"
```

---

## Summary

| Task | What | Key changes |
|------|------|-------------|
| 1 | Model: `inspector_id` + nullable `committee_id` | `inspections/models.py`, `__init__.py` |
| 2 | Routes: accept `inspector_id`, validate one-of-two | `inspections/routes.py` |
| 3 | Frontend: creation dialog with Committee/Advisor toggle | `StructureDetailPage.jsx`, `registryApi.js`, `InspectionForm.jsx` |
| 4 | Frontend: inspector body column in table + list API | `StructureDetailPage.jsx`, `routes.py` |
| 5 | Full regression test | All tests green |

**After this plan:** Proceed with the IRIDA Phase 1 implementation plan.
