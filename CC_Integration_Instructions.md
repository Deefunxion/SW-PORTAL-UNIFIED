# Instructions for Claude Code — Integrating the Mockup Branch

## Context

The project repo is: https://github.com/Deefunxion/unified-portal.git

There are TWO branches you need to know about:

1. **`main`** — The working application with 4 subsystems (Document Archive, Forum, AI Assistant, Knowledge Base). This is the production codebase described in CLAUDE.md.

2. **`feature/ops-mockup`** — A UI mockup branch created by Lovable. It contains 5 NEW frontend pages with HARDCODED data (no backend). These pages demonstrate the new features we want to build for real.

## What the mockup branch contains

New pages (frontend only, hardcoded data, no API calls):

| Page | Route | Purpose |
|---|---|---|
| RegistryListPage | `/registry` | List of supervised care facilities with filters |
| StructureDetailPage | `/registry/:id` | Full facility detail card with tabs |
| InspectionFormPage | `/inspections/new` | Mobile-first inspection form with checklists |
| SanctionsPage | `/sanctions` | Fine calculator + sanctions list |
| OversightDashboardPage | `/oversight` | Executive dashboard with charts and alerts |

The mockup also adds 3 nav items (Μητρώο, Έλεγχοι, Εποπτεία) and new routes in App.jsx.

## What YOU need to do

### Step 1 — Read the design documents

Read these files IN THIS ORDER before writing any code:

1. `CLAUDE.md` — Understand the existing architecture
2. `docs/OPS_KM_Design_Report.md` — The full technical design (database models, API endpoints, modules, workflows, phases)
3. `PKM_Registry_System_Requirements.md` — Detailed requirements for the Registry subsystem

### Step 2 — Merge the mockup branch into main

```bash
git checkout main
git pull origin main
git merge feature/ops-mockup --no-ff -m "Merge mockup UI pages for new OPS modules"
```

If there are merge conflicts (most likely in `App.jsx` for routes/nav), resolve them by KEEPING both the existing routes AND the new mockup routes.

### Step 3 — Verify the merge

```bash
cd frontend
pnpm install    # in case Lovable added any dependencies
pnpm run build  # must compile without errors
```

Check that ALL existing pages still work (HomePage, Forum, Assistant, etc.) AND that the new mockup pages are accessible.

### Step 4 — Build the real backend, phase by phase

Now follow the `docs/OPS_KM_Design_Report.md` to implement the REAL backend modules. The mockup pages become your FRONTEND REFERENCE — you will gradually replace their hardcoded data with real API calls.

**Implementation order (from the Design Report):**

**Phase 1 — Foundation:**
- Install Flask-Migrate, create initial migration
- Build `registry/` module (models, routes, services, permissions)
- Seed database with structure types + demo structures
- Connect RegistryListPage to real `/api/structures` endpoint
- Connect StructureDetailPage to real `/api/structures/{id}` endpoint

**Phase 2 — Inspections:**
- Build `inspections/` module (models, routes, services)
- Build ChecklistTemplate model + seed data
- Connect InspectionFormPage to real `/api/inspections` endpoints
- Implement report submission + notification workflow

**Phase 3 — Sanctions:**
- Build `sanctions/` module (models, calculator, escalation)
- Seed SanctionRule table
- Connect SanctionsPage to real `/api/sanctions` endpoints
- Wire up fine calculator to real `/api/sanctions/calculate`

**Phase 4 — Interoperability (Mock Layer):**
- Build `interop/` module with mock services
- Wire AfmLookup in StructureDetailPage to mock ΑΑΔΕ
- Wire protocol sync to mock ΙΡΙΔΑ

**Phase 5 — Oversight Dashboard:**
- Build `oversight/` module with aggregation queries
- Connect OversightDashboardPage to real `/api/oversight/dashboard`
- Replace hardcoded chart data with real queries

### Key rules for each phase

1. **New modules ONLY.** Never modify existing `models.py` or `routes.py`. Create new files in `registry/`, `inspections/`, `sanctions/`, `interop/`, `oversight/`.

2. **Flask-Migrate for ALL schema changes.** No `db.create_all()`. Always: `flask db migrate -m "description"` → `flask db upgrade`.

3. **Register new Blueprints** in `create_app()` inside `backend/my_project/__init__.py`.

4. **Keep the mockup pages working** throughout. When you connect a page to real API, keep a `USE_MOCK_DATA` toggle so the page still works if the backend isn't running.

5. **TDD.** Write tests first for every new backend endpoint.

6. **Greek UI text.** All user-facing strings in Greek.

7. **Write diary entry** in DIARY.md after each completed phase.

## Summary of available documents

| Document | Location | Contains |
|---|---|---|
| CLAUDE.md | repo root | Full architecture guide, conventions, how to run |
| OPS_KM_Design_Report.md | `docs/` | Database models, API endpoints, modules, phases, workflows |
| PKM_Registry_System_Requirements.md | repo root | Detailed requirements, entity definitions, screens, roles |
| Lovable mockup | `feature/ops-mockup` branch | Frontend reference implementation (hardcoded) |

That's everything. Start with Step 1 (reading), then Step 2 (merge), then Phase 1 of Step 4.
