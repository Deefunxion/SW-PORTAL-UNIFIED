# Post-Implementation Improvements: Document Composition Engine

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Read the full document before starting. Each improvement is independent and should be committed separately.

**Context:** This document describes 7 improvements to apply AFTER the Document Composition Engine (2026-02-17-document-composition-engine.md) has been fully implemented and committed. These improvements address performance issues, missing capabilities, and demo-critical features identified during the design review.

**Priority order:** Execute improvements 1→7 in sequence. Each one builds on the previous state of the codebase.

---

## Existing Codebase Reference (post-engine implementation)

After the engine plan completes, these files will exist:

```
backend/my_project/documents/
  __init__.py          — Blueprint
  models.py            — DecisionTemplate, DecisionRecord, AuditLog
  routes.py            — All API endpoints (/api/templates, /api/decisions, /api/document-registry, /api/audit-log)
  generator.py         — resolve_placeholders() + generate_decision_pdf()

backend/my_project/integrations/
  irida_client.py      — ΙΡΙΔΑ Level 3 API client (OAuth2)
  irida_export.py      — ΙΡΙΔΑ Level 2 ZIP export (existing fallback)

backend/my_project/sanctions/
  pdf_generator.py     — Existing sanction decision PDF generator (separate from documents module)
  models.py            — SanctionDecision with its own workflow (draft→submitted→approved→notified→paid)

frontend/src/pages/
  DocumentRegistryPage.jsx  — Unified document table
  DocumentComposePage.jsx   — Template wizard
```

---

## Improvement 1: DOCX Generation (Critical for ΙΡΙΔΑ)

### Problem

The generator.py currently produces only PDF output. However, ΙΡΙΔΑ converts documents to PDF itself during distribution (§4.9 of the ΙΡΙΔΑ manual: "τα σχέδια εγγράφου μετατρέπονται σε pdf"). The γραμματεία needs to upload DOCX files to ΙΡΙΔΑ, not PDF. PDF should remain available as a secondary export for preview/archival purposes.

### Requirements

Add a `generate_decision_docx()` function in `generator.py` that produces a properly formatted .docx file using `python-docx`. The DOCX output must include:

- ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ institutional header (left column: ministry hierarchy, right column: date + protocol number) — mirror the existing layout in `sanctions/pdf_generator.py`
- Document title (ΘΕΜΑ)
- "Έχοντας υπόψη" section with numbered legal references from the template's `legal_references` field
- Rendered body text with proper paragraph formatting
- ΠΙΝΑΚΑΣ ΑΠΟΔΕΚΤΩΝ (recipients table) from the template's `recipients_template` field
- A4 page size, 2.5cm left/right margins, 2cm top/bottom margins
- Greek-capable font: prefer Arial, fall back to DejaVu Sans

Add a new API endpoint `GET /api/decisions/<id>/docx` that returns the DOCX file. Also update the `send_to_irida` endpoint in routes.py to send DOCX instead of PDF.

Update the frontend DocumentComposePage to show two export buttons: "Εξαγωγή PDF" and "Εξαγωγή DOCX".

### Dependencies

```bash
pip install python-docx --break-system-packages
```

### Files to modify
- `backend/my_project/documents/generator.py` — add `generate_decision_docx()`
- `backend/my_project/documents/routes.py` — add `/api/decisions/<id>/docx` endpoint, update `send_to_irida` to use DOCX
- `frontend/src/pages/DocumentComposePage.jsx` — add DOCX export button

---

## Improvement 2: A4 Document Preview Component (Critical for Demo)

### Problem

The DocumentComposePage Step 4 (live preview) currently renders raw HTML in a div. For the demo to the General Secretary, the preview must look like a real administrative document — with the institutional header, proper margins, serif body text, and A4 proportions.

### Requirements

Create a React component `DocumentPreview.jsx` that renders the decision inside a visual A4 page. The component should:

- Render inside a container styled to look like an A4 sheet of paper (white background, subtle shadow, correct aspect ratio 210mm × 297mm scaled to fit the viewport)
- Show the ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ header block at the top (two columns: ministry hierarchy left, date/protocol right)
- Render the document title (ΘΕΜΑ) in bold
- Render the body text with justified alignment, serif font (Literata or Georgia), 11pt equivalent line height
- Show the recipients table at the bottom
- Include a subtle "ΠΡΟΣΧΕΔΙΟ" watermark diagonally across the page when the document status is 'draft'
- Be print-friendly: `@media print` rules that hide everything except the A4 content

Use this component in:
1. DocumentComposePage Step 4 (wizard preview)
2. A new route `/documents/:id/preview` for standalone viewing
3. The DocumentRegistryPage "Προβολή" action button

### Props interface

```jsx
<DocumentPreview
  title="Απόφαση Λειτουργίας Κατασκήνωσης"
  renderedBody="<p>Ο Αντιπεριφερειάρχης...</p>"
  protocolNumber="ΠΚΜ-2026/0042"
  date="17/02/2026"
  legalReferences={["Ν.4939/2022 (ΦΕΚ Α' 111)", ...]}
  recipients={[{name: "Ενδιαφερόμενος"}, ...]}
  status="draft"
/>
```

### Design tokens

Follow the existing Hellenic Marble palette: background `#faf8f4`, header text navy `#1e3a5f`, body text `#2d2d2d`, border lines `#e8e2d8`. Use Literata for body text (already loaded in the app) and a sans-serif for the institutional header.

### Files to create/modify
- Create: `frontend/src/components/DocumentPreview.jsx`
- Modify: `frontend/src/pages/DocumentComposePage.jsx` — use DocumentPreview in Step 4
- Modify: `frontend/src/pages/DocumentRegistryPage.jsx` — link "Προβολή" to preview
- Modify: `frontend/src/App.jsx` — add `/documents/:id/preview` route

---

## Improvement 3: Bridge with SanctionDecision Workflow

### Problem

The existing `SanctionDecision` model (in `sanctions/models.py`) has its own complete workflow (draft→submitted→approved→notified→paid) and its own PDF generator (`sanctions/pdf_generator.py`). The new Document Registry (`/api/document-registry`) aggregates documents from multiple sources, including SanctionDecisions. But the two systems are disconnected — a SanctionDecision that gets approved does not automatically appear as a "ready" document in the registry. The user has to mentally track which decisions need to go to ΙΡΙΔΑ.

### Requirements

Add an automatic bridge: when a SanctionDecision transitions to status `approved`, automatically create a corresponding `DecisionRecord` in the documents module. This DecisionRecord should:

- Link to a pre-existing `DecisionTemplate` of type `sanction_fine` or `sanction_suspension`
- Copy the rendered PDF content from `sanctions/pdf_generator.py` into the DecisionRecord
- Set status to `draft` (ready for the user to review and send to ΙΡΙΔΑ)
- Set `structure_id` from the sanction's structure
- Store a reference to the source SanctionDecision ID in the `data` JSON field (e.g., `{"source_sanction_decision_id": 42}`)

Implement this as a function `create_decision_from_sanction(sanction_decision)` in `documents/bridge.py`. Call it from the existing `approve` endpoint in the sanctions routes (the endpoint that transitions a SanctionDecision to `approved` status).

This way, the Document Registry becomes the single place where the γραμματεία sees ALL documents that need to go to ΙΡΙΔΑ, regardless of where they originated.

### Files to create/modify
- Create: `backend/my_project/documents/bridge.py` — `create_decision_from_sanction()`
- Modify: `backend/my_project/sanctions/routes.py` — call bridge function on approval (look for the `approve` endpoint that sets `status='approved'`)
- Modify: `backend/my_project/documents/routes.py` — in `document_registry()`, remove the separate SanctionDecision aggregation since they now appear as DecisionRecords

---

## Improvement 4: Internal Document Numbering

### Problem

Documents need an internal reference number before they receive a protocol number from ΙΡΙΔΑ. Currently, a draft document has no identifier other than its database ID. The γραμματεία needs to refer to documents by a human-readable number like "ΠΚΜ-2026/0001".

### Requirements

Add an `internal_number` field to `DecisionRecord`. Auto-generate it on creation using the pattern:

```
ΠΚΜ-{year}/{sequential_number:04d}
```

Example: `ΠΚΜ-2026/0001`, `ΠΚΜ-2026/0002`, etc.

The sequential number resets each year. Implement a helper function `_next_internal_number()` in `documents/routes.py` that queries the max existing number for the current year and increments.

Add the `internal_number` to:
- The `DecisionRecord.to_dict()` output
- The DocumentRegistryPage table (new column after Α/Α)
- The DocumentPreview component (shown in the header area)
- The PDF and DOCX generators (in the header, next to protocol number)

### Files to modify
- `backend/my_project/documents/models.py` — add `internal_number` column
- `backend/my_project/documents/routes.py` — add `_next_internal_number()`, call it in `create_decision()`
- `frontend/src/pages/DocumentRegistryPage.jsx` — add column
- `frontend/src/components/DocumentPreview.jsx` — show in header
- `backend/my_project/documents/generator.py` — include in PDF/DOCX output

---

## Improvement 5: Bulk Document Generation

### Problem

The most time-consuming task for the γραμματεία is producing the same type of decision for multiple structures. For example, every summer they issue ~40 camp license decisions. Currently they would have to compose each one individually through the wizard.

### Requirements

Add a bulk generation feature:

**Backend:**
- New endpoint `POST /api/decisions/bulk` that accepts `{template_id, records: [{structure_id, data}, ...]}` and creates multiple DecisionRecords in a single transaction
- Return the list of created records with their internal numbers
- Add audit log entry for bulk creation

**Frontend:**
- Add a "Μαζική Δημιουργία" button on the DocumentRegistryPage
- This opens a dialog/page with:
  1. Template selection (same as wizard Step 1)
  2. An Excel upload zone (user uploads .xlsx with one row per structure)
  3. Column mapping step: the system auto-detects columns and maps them to template schema fields
  4. Preview: show a table of N documents that will be created with key fields
  5. "Δημιουργία N Εγγράφων" button
- After creation, navigate to DocumentRegistryPage filtered to show the new batch

**Excel parsing:** Use SheetJS (already available in the frontend via the xlsx skill) to read the uploaded file client-side, extract rows, and send them as JSON to the bulk endpoint. The backend does NOT need to handle Excel files.

### Files to create/modify
- `backend/my_project/documents/routes.py` — add `POST /api/decisions/bulk`
- Create: `frontend/src/pages/BulkDocumentPage.jsx` (or add as a dialog in DocumentRegistryPage)
- `frontend/src/App.jsx` — add route if separate page

---

## Improvement 6: Document Registry Performance

### Problem

The `document_registry()` endpoint in `routes.py` loads ALL records from 4 different models into Python memory (using `.query.all()` on DecisionRecord, InspectionReport, SocialAdvisorReport, and SanctionDecision), then applies filters in Python. This works for <100 documents but will degrade with scale.

### Requirements

Replace the Python-side aggregation with a SQL-based approach. Two options (choose the simpler one that works with SQLAlchemy):

**Option A — SQL UNION query:**
Build a union query across the 4 tables, selecting the same columns from each, then apply filters and pagination at the SQL level.

**Option B — Materialized aggregation table:**
Since Improvement 3 (bridge) already moves SanctionDecisions into DecisionRecords, and the other document types (InspectionReport, SocialAdvisorReport) could get similar bridges in the future, simplify the registry to query ONLY the `decision_records` table. Add a `source_type` field to DecisionRecord to track origin ('template', 'sanction_bridge', 'inspection_bridge', etc.).

**Recommendation:** Go with Option B. It's architecturally cleaner — the Document Registry becomes a single-table query with proper SQL filtering and pagination. The bridge pattern from Improvement 3 becomes the standard way to get documents into the registry.

If choosing Option B:
- Add `source_type` and `source_id` columns to DecisionRecord
- Update the bridge from Improvement 3 to set `source_type='sanction_decision'`
- Create similar bridges for InspectionReport and SocialAdvisorReport (or at minimum, stub them)
- Rewrite `document_registry()` to query only DecisionRecord with proper SQLAlchemy filtering and `.paginate()`
- Remove the multi-model aggregation code

### Files to modify
- `backend/my_project/documents/models.py` — add `source_type`, `source_id` to DecisionRecord
- `backend/my_project/documents/routes.py` — rewrite `document_registry()` as single-table query
- `backend/my_project/documents/bridge.py` — set source_type/source_id, add stubs for other bridges

---

## Improvement 7: Template Versioning

### Problem

When legislation changes (e.g., a new law replaces Ν.4939/2022), the legal references in decision templates must be updated. Currently, editing a template would affect its `body_template` and `legal_references`, but existing decisions that used the old version store only `template_id` — they have no way to know which version of the template they were generated from.

The `rendered_body` field preserves the text as it was at generation time (which is correct), but the `legal_references` and `recipients_template` are fetched live from the template in `get_decision()`, which means viewing an old decision could show new legal references that didn't exist when the decision was issued.

### Requirements

Add a versioning mechanism:

- When a template needs to be updated, don't edit it in place. Instead, create a new `DecisionTemplate` row with the same `type` but incremented `version` and set `is_active=True` on the new one, `is_active=False` on the old one.
- Add endpoint `POST /api/templates/<id>/new-version` that clones a template, increments the version, and deactivates the old one.
- `DecisionRecord` already stores `template_id` which points to a specific template row, so old decisions will correctly reference the old template version (with its old legal references).
- The `list_templates()` endpoint already filters by `is_active=True`, so the wizard will only show current versions.
- Add a "Ιστορικό Εκδόσεων" (Version History) section to the template detail view, showing all versions of a template type.

### Files to modify
- `backend/my_project/documents/routes.py` — add `POST /api/templates/<id>/new-version` endpoint
- `frontend/src/pages/DocumentComposePage.jsx` — show template version number in selection step

---

## Testing Strategy

For each improvement, write tests BEFORE implementing (TDD):

- **Improvement 1:** Test DOCX generation produces valid .docx bytes, contains Greek text, has correct page size
- **Improvement 2:** No backend tests needed (frontend-only)
- **Improvement 3:** Test that approving a SanctionDecision creates a DecisionRecord; test that the bridge copies the correct data
- **Improvement 4:** Test `_next_internal_number()` returns sequential numbers; test year rollover
- **Improvement 5:** Test bulk creation endpoint creates N records; test validation rejects invalid data
- **Improvement 6:** Test that the rewritten registry returns the same data as before; test SQL filtering
- **Improvement 7:** Test that cloning a template creates a new version; test that old decisions still reference old template

Run the full test suite after each improvement: `pytest` (backend), `pnpm build` (frontend).

---

## Commit Strategy

Each improvement = 1-3 commits:
1. Backend changes (models + routes + tests)
2. Frontend changes (components + pages)
3. Seed data updates if needed

Use conventional commit messages:
- `feat: add DOCX generation for decisions`
- `feat: add A4 document preview component`
- `feat: bridge SanctionDecision approval to document registry`
- `feat: add internal document numbering (ΠΚΜ-YYYY/NNNN)`
- `feat: add bulk document generation from Excel`
- `perf: rewrite document registry as single-table query`
- `feat: add template versioning with clone endpoint`