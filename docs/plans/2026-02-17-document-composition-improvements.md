# Document Composition Engine — Post-Implementation Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 7 improvements to the existing Document Composition Engine: DOCX generation, A4 visual preview, SanctionDecision bridge, internal numbering, bulk generation, registry performance, and template versioning.

**Architecture:** Each improvement builds incrementally on the existing `backend/my_project/documents/` module and `frontend/src/pages/Document*.jsx` pages. TDD approach — write failing tests first, then implement. Backend tests use SQLite in-memory via the existing conftest.py fixtures. Frontend changes are verified via `npx pnpm build`.

**Tech Stack:** Python (Flask, python-docx, reportlab), React 18 (Vite, shadcn/ui, Tailwind CSS v4), SheetJS (xlsx) for bulk import, PostgreSQL + SQLAlchemy.

**Branch:** Continue on `revival/demo-prep`.

---

## Codebase Reference

These files already exist from the initial engine implementation:

```
backend/my_project/documents/
  __init__.py          — Blueprint definition (3 lines)
  models.py            — DecisionTemplate, DecisionRecord, DocumentAuditLog
  routes.py            — 15 endpoints (/api/templates, /api/decisions, /api/document-registry, etc.)
  generator.py         — resolve_placeholders() + generate_decision_pdf()

backend/my_project/integrations/
  irida_client.py      — ΙΡΙΔΑ Level 3 API client (OAuth2 send_document, get_inbox, is_configured)

backend/my_project/sanctions/
  routes.py            — approve_decision() at line 264 sets status='approved'
  pdf_generator.py     — generate_decision_pdf(decision, rule) with ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ header
  models.py            — SanctionDecision (line 60-153) with full workflow

frontend/src/pages/
  DocumentRegistryPage.jsx  — Unified document table (307 lines)
  DocumentComposePage.jsx   — 4-step template wizard (489 lines)

frontend/src/App.jsx — Routes at lines 526-540 (/documents, /documents/new, /documents/:id/edit)
```

**Test infrastructure:** `conftest.py` provides `client`, `auth_headers`, `admin_headers`, `staff_headers`, `director_headers` fixtures. Tests use SQLite in-memory. Test files go in `tests/test_documents/`.

**Existing dependencies:** `python-docx>=1.1.0` already in `requirements.txt`. SheetJS NOT installed in frontend.

---

## Task 1: DOCX Generation — Write Tests

**Files:**
- Create: `tests/test_documents/__init__.py`
- Create: `tests/test_documents/test_generator.py`

**Step 1: Create test directory and test file**

Create `tests/test_documents/__init__.py` (empty).

Create `tests/test_documents/test_generator.py`:

```python
"""Tests for document generator — DOCX and PDF output."""
import pytest
from io import BytesIO
from docx import Document as DocxDocument


@pytest.fixture
def sample_html():
    return '<p>Ο Αντιπεριφερειάρχης Κοινωνικής Μέριμνας αποφασίζει:</p><p>Χορηγείται άδεια λειτουργίας.</p>'


@pytest.fixture
def sample_title():
    return 'Απόφαση Λειτουργίας Κατασκήνωσης'


@pytest.fixture
def sample_recipients():
    return [
        {'name': 'Ενδιαφερόμενος'},
        {'name': 'Δ/νση Κοινωνικής Μέριμνας'},
    ]


@pytest.fixture
def sample_legal_refs():
    return [
        'Ν.4939/2022 (ΦΕΚ Α\' 111)',
        'Ν.3852/2010 (ΦΕΚ Α\' 87)',
    ]


class TestGenerateDecisionDocx:
    def test_returns_bytes(self, sample_html, sample_title, sample_recipients, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, sample_legal_refs)
        assert isinstance(result, bytes)
        assert len(result) > 0

    def test_valid_docx_format(self, sample_html, sample_title, sample_recipients, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, sample_legal_refs)
        # python-docx can read it back
        doc = DocxDocument(BytesIO(result))
        assert len(doc.paragraphs) > 0

    def test_contains_title(self, sample_html, sample_title, sample_recipients, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, sample_legal_refs)
        doc = DocxDocument(BytesIO(result))
        all_text = '\n'.join(p.text for p in doc.paragraphs)
        assert 'ΘΕΜΑ' in all_text
        assert sample_title in all_text

    def test_contains_body_text(self, sample_html, sample_title, sample_recipients, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, sample_legal_refs)
        doc = DocxDocument(BytesIO(result))
        all_text = '\n'.join(p.text for p in doc.paragraphs)
        assert 'Αντιπεριφερειάρχης' in all_text

    def test_contains_legal_references(self, sample_html, sample_title, sample_recipients, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, sample_legal_refs)
        doc = DocxDocument(BytesIO(result))
        all_text = '\n'.join(p.text for p in doc.paragraphs)
        assert 'Έχοντας υπόψη' in all_text
        assert 'Ν.4939/2022' in all_text

    def test_contains_recipients(self, sample_html, sample_title, sample_recipients, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, sample_legal_refs)
        doc = DocxDocument(BytesIO(result))
        all_text = '\n'.join(p.text for p in doc.paragraphs)
        # Check in paragraphs or tables
        table_text = ''
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    table_text += cell.text + ' '
        combined = all_text + table_text
        assert 'ΑΠΟΔΕΚΤ' in combined.upper()

    def test_a4_page_dimensions(self, sample_html, sample_title, sample_recipients, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, sample_legal_refs)
        doc = DocxDocument(BytesIO(result))
        section = doc.sections[0]
        # A4 = 210mm x 297mm, docx uses EMU (1 inch = 914400 EMU)
        # 210mm = 7559040 EMU (approx)
        assert abs(section.page_width - 7560310) < 50000  # within tolerance
        assert abs(section.page_height - 10692130) < 50000

    def test_contains_header_block(self, sample_html, sample_title, sample_recipients, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, sample_legal_refs)
        doc = DocxDocument(BytesIO(result))
        all_text = '\n'.join(p.text for p in doc.paragraphs)
        table_text = ''
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    table_text += cell.text + '\n'
        combined = all_text + table_text
        assert 'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ' in combined

    def test_without_legal_refs(self, sample_html, sample_title, sample_recipients):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, sample_recipients, legal_references=None)
        assert isinstance(result, bytes)
        doc = DocxDocument(BytesIO(result))
        assert len(doc.paragraphs) > 0

    def test_without_recipients(self, sample_html, sample_title, sample_legal_refs):
        from my_project.documents.generator import generate_decision_docx
        result = generate_decision_docx(sample_html, sample_title, recipients=None, legal_references=sample_legal_refs)
        assert isinstance(result, bytes)


class TestGenerateDecisionPdf:
    """Verify existing PDF generation still works."""
    def test_returns_bytes(self, sample_html, sample_title, sample_recipients):
        from my_project.documents.generator import generate_decision_pdf
        result = generate_decision_pdf(sample_html, sample_title, sample_recipients)
        assert isinstance(result, bytes)
        assert result[:4] == b'%PDF'
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_documents/test_generator.py -v`
Expected: `TestGenerateDecisionDocx` tests FAIL with `ImportError: cannot import name 'generate_decision_docx'`. `TestGenerateDecisionPdf` should PASS.

---

## Task 2: DOCX Generation — Implement

**Files:**
- Modify: `backend/my_project/documents/generator.py` — add `generate_decision_docx()`

**Step 1: Add `generate_decision_docx()` to generator.py**

Add after the existing `generate_decision_pdf()` function (after line 163):

```python
def generate_decision_docx(rendered_html, title, recipients=None,
                           legal_references=None, protocol_number=None,
                           internal_number=None, doc_date=None):
    """
    Generate a DOCX from rendered HTML decision text.

    Args:
        rendered_html: HTML string (rendered template)
        title: Document title for ΘΕΜΑ line
        recipients: list of recipient dicts [{"name": "..."}]
        legal_references: list of legal reference strings
        protocol_number: protocol number string (or None)
        internal_number: internal number string (or None)
        doc_date: date string (or None, defaults to today)

    Returns:
        DOCX bytes
    """
    from docx import Document
    from docx.shared import Pt, Cm, Emu
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.enum.table import WD_TABLE_ALIGNMENT

    doc = Document()

    # A4 page setup
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(2.5)
    section.right_margin = Cm(2.5)
    section.top_margin = Cm(2.0)
    section.bottom_margin = Cm(2.0)

    # Determine font
    font_name = 'Arial'

    # ── 1. Header table (two columns) ─────────────────────────
    header_table = doc.add_table(rows=1, cols=2)
    header_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    # Left column: ministry hierarchy
    left_cell = header_table.cell(0, 0)
    left_cell.width = Cm(9.0)
    left_p = left_cell.paragraphs[0]
    run = left_p.add_run('ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ')
    run.bold = True
    run.font.size = Pt(8)
    run.font.name = font_name
    for line in [
        'ΠΕΡΙΦΕΡΕΙΑ ΑΤΤΙΚΗΣ',
        'ΓΕΝΙΚΗ Δ/ΝΣΗ ΔΗΜΟΣΙΑΣ ΥΓΕΙΑΣ',
        '& ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ',
        'Δ/ΝΣΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ',
        'ΤΜΗΜΑ ΚΟΙΝΩΝΙΚΗΣ ΑΛΛΗΛΕΓΓΥΗΣ',
    ]:
        left_p.add_run('\n' + line).font.size = Pt(8)

    # Right column: date + protocol
    right_cell = header_table.cell(0, 1)
    right_cell.width = Cm(7.0)
    right_p = right_cell.paragraphs[0]
    right_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT

    if not doc_date:
        from datetime import date as _date
        doc_date = _date.today().strftime('%d/%m/%Y')
    right_p.add_run(f'Αθήνα, {doc_date}').font.size = Pt(9)
    if protocol_number:
        right_p.add_run(f'\nΑρ. Πρωτ.: {protocol_number}').font.size = Pt(9)
    if internal_number:
        right_p.add_run(f'\nΕσωτ. Αρ.: {internal_number}').font.size = Pt(9)

    # Remove table borders
    for row in header_table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    run.font.name = font_name

    doc.add_paragraph()  # spacer

    # ── 2. Title (ΘΕΜΑ) ───────────────────────────────────────
    theme_p = doc.add_paragraph()
    theme_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = theme_p.add_run(f'ΘΕΜΑ: {title}')
    run.bold = True
    run.font.size = Pt(11)
    run.font.name = font_name

    doc.add_paragraph()  # spacer

    # ── 3. Legal references (Έχοντας υπόψη) ──────────────────
    if legal_references:
        ref_p = doc.add_paragraph()
        run = ref_p.add_run('Έχοντας υπόψη:')
        run.bold = True
        run.font.size = Pt(10)
        run.font.name = font_name

        for i, ref in enumerate(legal_references, 1):
            p = doc.add_paragraph()
            p.paragraph_format.left_indent = Cm(1.0)
            run = p.add_run(f'{i}. {ref}')
            run.font.size = Pt(9)
            run.font.name = font_name

        doc.add_paragraph()  # spacer

    # ── 4. Body text ──────────────────────────────────────────
    clean = re.sub(r'<br\s*/?>', '\n', rendered_html)
    clean = re.sub(r'<p>', '', clean)
    clean = re.sub(r'</p>', '\n\n', clean)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = html.unescape(clean)

    for para_text in clean.split('\n\n'):
        text = para_text.strip()
        if text:
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
            run = p.add_run(text)
            run.font.size = Pt(10)
            run.font.name = font_name

    # ── 5. Recipients table ───────────────────────────────────
    if recipients:
        doc.add_paragraph()  # spacer
        recip_p = doc.add_paragraph()
        recip_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = recip_p.add_run('ΠΙΝΑΚΑΣ ΑΠΟΔΕΚΤΩΝ')
        run.bold = True
        run.font.size = Pt(10)
        run.font.name = font_name

        recip_table = doc.add_table(rows=len(recipients), cols=2)
        recip_table.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, r in enumerate(recipients):
            recip_table.cell(i, 0).text = str(i + 1) + '.'
            recip_table.cell(i, 1).text = r.get('name', '')
            for cell in recip_table.row_cells(i):
                for paragraph in cell.paragraphs:
                    for run in paragraph.runs:
                        run.font.size = Pt(9)
                        run.font.name = font_name

    # Save to bytes
    buf = BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()
```

**Step 2: Run tests to verify they pass**

Run: `python -m pytest tests/test_documents/test_generator.py -v`
Expected: ALL tests PASS.

**Step 3: Commit**

```bash
git add tests/test_documents/ backend/my_project/documents/generator.py
git commit -m "feat: add DOCX generation for decisions with institutional header and legal references"
```

---

## Task 3: DOCX API Endpoint + Frontend Button

**Files:**
- Modify: `backend/my_project/documents/routes.py:178-203` — add DOCX endpoint after PDF endpoint
- Modify: `backend/my_project/documents/routes.py:229-275` — update `send_to_irida` to use DOCX
- Modify: `frontend/src/pages/DocumentComposePage.jsx:461-480` — add DOCX download button

**Step 1: Write the test for DOCX endpoint**

Append to `tests/test_documents/test_generator.py`:

```python
class TestDocxEndpoint:
    def test_docx_download(self, app, client, auth_headers):
        """Test that /api/decisions/<id>/docx returns a DOCX file."""
        from my_project.documents.models import DecisionTemplate, DecisionRecord
        from my_project.extensions import db as _db

        with app.app_context():
            tpl = DecisionTemplate(
                type='test_docx', title='Test Template',
                body_template='<p>Test body {{name}}</p>',
                schema={'fields': []},
                legal_references=['Test Ref 1'],
                recipients_template=[{'name': 'Test Recipient'}],
            )
            _db.session.add(tpl)
            _db.session.flush()
            rec = DecisionRecord(
                template_id=tpl.id, data={'name': 'Demo'},
                rendered_body='<p>Test body Demo</p>',
                status='draft', created_by=1,
            )
            _db.session.add(rec)
            _db.session.commit()
            rec_id = rec.id

        response = client.get(f'/api/decisions/{rec_id}/docx', headers=auth_headers)
        assert response.status_code == 200
        assert response.content_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        assert len(response.data) > 0
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_documents/test_generator.py::TestDocxEndpoint -v`
Expected: FAIL with 404 (route doesn't exist yet).

**Step 3: Add DOCX endpoint to routes.py**

Add after the `generate_pdf` endpoint (after line 203 in `routes.py`):

```python
@documents_bp.route('/api/decisions/<int:decision_id>/docx',
                     methods=['GET'])
@jwt_required()
def generate_docx(decision_id):
    """Generate and return DOCX for a decision."""
    user_id = int(get_jwt_identity())
    record = DecisionRecord.query.get_or_404(decision_id)

    recipients = (record.template.recipients_template
                  if record.template else [])
    title = record.template.title if record.template else 'Έγγραφο'
    legal_refs = (record.template.legal_references
                  if record.template else [])

    docx_bytes = generate_decision_docx(
        record.rendered_body, title, recipients, legal_refs,
        protocol_number=record.protocol_number)

    _audit(user_id, 'generate_docx', 'decision_record', record.id)
    db.session.commit()

    return Response(
        docx_bytes,
        mimetype='application/vnd.openxmlformats-officedocument'
                 '.wordprocessingml.document',
        headers={
            'Content-Disposition':
                f'attachment; filename="decision_{record.id}.docx"'
        },
    )
```

Update the import at line 8 of routes.py:
```python
from .generator import resolve_placeholders, generate_decision_pdf, generate_decision_docx
```

**Step 4: Update `send_to_irida` to send DOCX instead of PDF**

In `routes.py`, in the `send_to_irida` function (around line 247-252), change:
```python
    # OLD:
    pdf_bytes = generate_decision_pdf(
        record.rendered_body, title, recipients)
    ...
        result = send_document(
            subject=title,
            pdf_bytes=pdf_bytes,
            filename=f'decision_{record.id}.pdf',
        )
```
to:
```python
    # Generate DOCX for ΙΡΙΔΑ (ΙΡΙΔΑ converts to PDF internally)
    legal_refs = (record.template.legal_references
                  if record.template else [])
    docx_bytes = generate_decision_docx(
        record.rendered_body, title, recipients, legal_refs,
        protocol_number=record.protocol_number)

    try:
        result = send_document(
            subject=title,
            pdf_bytes=docx_bytes,  # param name is legacy, now sends DOCX
            filename=f'decision_{record.id}.docx',
        )
```

**Step 5: Add DOCX download button to frontend**

In `DocumentComposePage.jsx`, in the Step 3 preview actions area (around line 462-470), add a `handleDownloadDocx` function and button.

Add this function after `handleDownloadPdf` (around line 179):

```jsx
const handleDownloadDocx = async () => {
  if (!decisionId) return;
  try {
    const response = await api.get(`/api/decisions/${decisionId}/docx`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `decision_${decisionId}.docx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    toast.success('DOCX δημιουργήθηκε');
  } catch (error) {
    toast.error('Σφάλμα δημιουργίας DOCX');
  }
};
```

In the preview buttons area (line ~463-470), add the DOCX button next to the PDF button:

```jsx
<Button
  variant="outline"
  onClick={handleDownloadDocx}
  className="min-h-[44px] border-[#e8e2d8]"
>
  <Download className="w-4 h-4 mr-2" />
  Λήψη DOCX
</Button>
```

Also add a DOCX download button in `DocumentRegistryPage.jsx` (around line 252-258), next to the PDF download:

```jsx
<Button
  variant="ghost" size="sm" className="h-8 w-8 p-0"
  onClick={() => handleDownloadDocx(doc)}
  title="Λήψη DOCX"
>
  <FileText className="w-4 h-4 text-[#6b6560]" />
</Button>
```

Add `handleDownloadDocx` function in DocumentRegistryPage:

```jsx
const handleDownloadDocx = async (doc) => {
  if (doc.source !== 'decision_record') return;
  try {
    const response = await api.get(`/api/decisions/${doc.id}/docx`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `decision_${doc.id}.docx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading DOCX:', error);
  }
};
```

**Step 6: Run tests and build**

Run: `python -m pytest tests/test_documents/ -v`
Run: `cd frontend && npx pnpm build`
Expected: ALL PASS.

**Step 7: Commit**

```bash
git add backend/my_project/documents/routes.py frontend/src/pages/DocumentComposePage.jsx frontend/src/pages/DocumentRegistryPage.jsx tests/test_documents/
git commit -m "feat: add DOCX download endpoint and update ΙΡΙΔΑ to send DOCX"
```

---

## Task 4: A4 Document Preview Component

**Files:**
- Create: `frontend/src/components/DocumentPreview.jsx`
- Modify: `frontend/src/pages/DocumentComposePage.jsx:442-483` — use DocumentPreview in Step 4
- Modify: `frontend/src/App.jsx:526-540` — add `/documents/:id/preview` route
- Modify: `frontend/src/pages/DocumentRegistryPage.jsx:241-260` — link "Προβολή" to preview route

**Step 1: Create DocumentPreview.jsx**

This is a React component that renders a visual A4 page. No backend tests needed.

Create `frontend/src/components/DocumentPreview.jsx`:

```jsx
/**
 * DocumentPreview — A4-format visual preview of administrative decisions.
 *
 * Props:
 *   title          - Document title (ΘΕΜΑ line)
 *   renderedBody   - HTML string of the document body
 *   protocolNumber - Protocol number (or null)
 *   internalNumber - Internal number (or null)
 *   date           - Date string dd/mm/yyyy (or null, defaults to today)
 *   legalReferences - Array of legal reference strings
 *   recipients     - Array of {name: string} objects
 *   status         - Document status ('draft', 'sent_to_irida', 'protocol_received')
 */
function DocumentPreview({
  title = '',
  renderedBody = '',
  protocolNumber,
  internalNumber,
  date,
  legalReferences = [],
  recipients = [],
  status = 'draft',
}) {
  const displayDate = date || new Date().toLocaleDateString('el-GR');

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(.a4-print-container) { display: none !important; }
          .a4-print-container { box-shadow: none !important; margin: 0 !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div
        className="a4-print-container mx-auto bg-white relative"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '20mm 25mm',
          boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
          fontFamily: "'Literata', 'Georgia', serif",
          color: '#2d2d2d',
          lineHeight: 1.6,
        }}
      >
        {/* DRAFT watermark */}
        {status === 'draft' && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ zIndex: 1 }}
          >
            <span
              style={{
                transform: 'rotate(-35deg)',
                fontSize: '80px',
                fontWeight: 700,
                color: 'rgba(200, 190, 180, 0.18)',
                letterSpacing: '12px',
                fontFamily: 'sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              ΠΡΟΣΧΕΔΙΟ
            </span>
          </div>
        )}

        {/* Content layer */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* ── 1. Institutional Header ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            {/* Left: ministry hierarchy */}
            <div style={{ fontSize: '8pt', fontFamily: "'Arial', sans-serif", lineHeight: 1.4, color: '#1e3a5f' }}>
              <div style={{ fontWeight: 700, fontSize: '9pt' }}>ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ</div>
              <div>ΠΕΡΙΦΕΡΕΙΑ ΑΤΤΙΚΗΣ</div>
              <div>ΓΕΝΙΚΗ Δ/ΝΣΗ ΔΗΜΟΣΙΑΣ ΥΓΕΙΑΣ</div>
              <div>& ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ</div>
              <div>Δ/ΝΣΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ</div>
              <div>ΤΜΗΜΑ ΚΟΙΝΩΝΙΚΗΣ ΑΛΛΗΛΕΓΓΥΗΣ</div>
            </div>
            {/* Right: date + protocol */}
            <div style={{ fontSize: '9pt', fontFamily: "'Arial', sans-serif", textAlign: 'right', color: '#1e3a5f' }}>
              <div>Αθήνα, {displayDate}</div>
              {protocolNumber && <div>Αρ. Πρωτ.: {protocolNumber}</div>}
              {internalNumber && <div>Εσωτ. Αρ.: {internalNumber}</div>}
            </div>
          </div>

          {/* Divider */}
          <hr style={{ border: 'none', borderTop: '1px solid #e8e2d8', marginBottom: '16px' }} />

          {/* ── 2. Title (ΘΕΜΑ) ── */}
          <div style={{
            textAlign: 'center',
            fontWeight: 700,
            fontSize: '11pt',
            fontFamily: "'Arial', sans-serif",
            margin: '8px 0 16px',
            color: '#1e3a5f',
          }}>
            ΘΕΜΑ: {title}
          </div>

          {/* ── 3. Legal References ── */}
          {legalReferences.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                fontWeight: 700,
                fontSize: '10pt',
                fontFamily: "'Arial', sans-serif",
                marginBottom: '6px',
              }}>
                Έχοντας υπόψη:
              </div>
              {legalReferences.map((ref, i) => (
                <div key={i} style={{
                  fontSize: '9pt',
                  fontFamily: "'Arial', sans-serif",
                  paddingLeft: '20px',
                  marginBottom: '3px',
                }}>
                  {i + 1}. {ref}
                </div>
              ))}
            </div>
          )}

          {/* ── 4. Body ── */}
          <div
            style={{
              fontSize: '10pt',
              textAlign: 'justify',
              lineHeight: 1.7,
            }}
            dangerouslySetInnerHTML={{ __html: renderedBody }}
          />

          {/* ── 5. Recipients Table ── */}
          {recipients.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <div style={{
                textAlign: 'center',
                fontWeight: 700,
                fontSize: '10pt',
                fontFamily: "'Arial', sans-serif",
                marginBottom: '8px',
              }}>
                ΠΙΝΑΚΑΣ ΑΠΟΔΕΚΤΩΝ
              </div>
              <table style={{
                width: '60%',
                margin: '0 auto',
                borderCollapse: 'collapse',
                fontSize: '9pt',
                fontFamily: "'Arial', sans-serif",
              }}>
                <tbody>
                  {recipients.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '2px 8px', width: '30px' }}>{i + 1}.</td>
                      <td style={{ padding: '2px 8px' }}>{r.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default DocumentPreview;
```

**Step 2: Use DocumentPreview in DocumentComposePage Step 4**

In `DocumentComposePage.jsx`, replace the raw HTML preview in Step 3 (lines 443-483).

Replace the existing Step 3 content block (the `<div dangerouslySetInnerHTML>` inside the Card) with:

```jsx
{/* Step 3: Preview */}
{step === 3 && (
  <div className="space-y-4">
    <div className="overflow-auto bg-[#f0ece6] p-8 rounded-lg">
      <DocumentPreview
        title={previewTitle}
        renderedBody={previewHtml}
        protocolNumber={null}
        date={null}
        legalReferences={selectedTemplate?.legal_references || []}
        recipients={selectedTemplate?.recipients_template || []}
        status={decisionStatus}
      />
    </div>

    <div className="flex justify-between">
      <Button variant="outline" onClick={() => setStep(2)} className="min-h-[44px] border-[#e8e2d8]">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Πίσω στα στοιχεία
      </Button>
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={handleDownloadDocx}
          className="min-h-[44px] border-[#e8e2d8]"
        >
          <Download className="w-4 h-4 mr-2" />
          Λήψη DOCX
        </Button>
        <Button
          variant="outline"
          onClick={handleDownloadPdf}
          className="min-h-[44px] border-[#e8e2d8]"
        >
          <Download className="w-4 h-4 mr-2" />
          Λήψη PDF
        </Button>
        {decisionStatus === 'draft' && (
          <Button
            onClick={handleSendToIrida}
            className="bg-[#0891b2] hover:bg-[#0e7490] text-white min-h-[44px]"
          >
            <Send className="w-4 h-4 mr-2" />
            Αποστολή στο ΙΡΙΔΑ
          </Button>
        )}
      </div>
    </div>
  </div>
)}
```

Add the import at the top of DocumentComposePage.jsx:
```jsx
import DocumentPreview from '@/components/DocumentPreview';
```

**Step 3: Add standalone preview route**

Create a thin wrapper page. In `App.jsx`, add a new route after the `/documents/:id/edit` route (after line 540):

```jsx
<Route path="/documents/:id/preview" element={
  <ProtectedRoute>
    <DocumentPreviewPage />
  </ProtectedRoute>
} />
```

Create `frontend/src/pages/DocumentPreviewPage.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button.jsx';
import { ArrowLeft, Printer } from 'lucide-react';
import api from '@/lib/api';
import DocumentPreview from '@/components/DocumentPreview';

function DocumentPreviewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [decision, setDecision] = useState(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [decRes, prevRes] = await Promise.all([
          api.get(`/api/decisions/${id}`),
          api.get(`/api/decisions/${id}/preview`),
        ]);
        setDecision(decRes.data);
        setPreviewHtml(prevRes.data.html);
      } catch (error) {
        console.error('Error loading preview:', error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a3aa3]" />
      </div>
    );
  }

  if (!decision) {
    return <div className="container mx-auto px-4 py-8 text-center text-[#6b6560]">Δεν βρέθηκε το έγγραφο.</div>;
  }

  return (
    <div className="bg-[#f0ece6] min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between mb-6 no-print">
          <Button variant="outline" onClick={() => navigate(-1)} className="min-h-[44px] bg-white border-[#e8e2d8]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Πίσω
          </Button>
          <Button onClick={() => window.print()} className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]">
            <Printer className="w-4 h-4 mr-2" />
            Εκτύπωση
          </Button>
        </div>
        <DocumentPreview
          title={decision.template_title || ''}
          renderedBody={previewHtml}
          protocolNumber={decision.protocol_number}
          internalNumber={decision.internal_number}
          legalReferences={decision.legal_references || []}
          recipients={decision.recipients_template || []}
          status={decision.status}
        />
      </div>
    </div>
  );
}

export default DocumentPreviewPage;
```

Add the import in `App.jsx` next to the other document imports (around line 55):
```jsx
import DocumentPreviewPage from '@/pages/DocumentPreviewPage';
```

**Step 4: Update DocumentRegistryPage "Προβολή" link**

In `DocumentRegistryPage.jsx`, change the "Eye" button link (around line 243-250) to go to the preview route for non-draft documents:

```jsx
{doc.status === 'draft' ? (
  <Link to={`/documents/${doc.id}/edit`}>
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Επεξεργασία">
      <Edit className="w-4 h-4 text-[#6b6560]" />
    </Button>
  </Link>
) : (
  <Link to={`/documents/${doc.id}/preview`}>
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Προβολή">
      <Eye className="w-4 h-4 text-[#6b6560]" />
    </Button>
  </Link>
)}
```

**Step 5: Build and verify**

Run: `cd frontend && npx pnpm build`
Expected: PASS.

**Step 6: Commit**

```bash
git add frontend/src/components/DocumentPreview.jsx frontend/src/pages/DocumentPreviewPage.jsx frontend/src/pages/DocumentComposePage.jsx frontend/src/pages/DocumentRegistryPage.jsx frontend/src/App.jsx
git commit -m "feat: add A4 document preview component with institutional header and draft watermark"
```

---

## Task 5: Internal Document Numbering — Tests + Implementation

**Files:**
- Modify: `backend/my_project/documents/models.py:56-118` — add `internal_number` column
- Modify: `backend/my_project/documents/routes.py:89-122` — add `_next_internal_number()`, call in `create_decision()`
- Create: `tests/test_documents/test_internal_numbering.py`

**Step 1: Write the tests**

Create `tests/test_documents/test_internal_numbering.py`:

```python
"""Tests for internal document numbering (ΠΚΜ-YYYY/NNNN)."""
import pytest
from datetime import datetime


@pytest.fixture
def template(app):
    """Create a test template."""
    from my_project.documents.models import DecisionTemplate
    from my_project.extensions import db as _db
    with app.app_context():
        tpl = DecisionTemplate.query.filter_by(type='test_numbering').first()
        if not tpl:
            tpl = DecisionTemplate(
                type='test_numbering', title='Test Numbering',
                body_template='<p>Test</p>', schema={'fields': []},
            )
            _db.session.add(tpl)
            _db.session.commit()
        return tpl.id


class TestNextInternalNumber:
    def test_first_number_of_year(self, app, client, auth_headers, template):
        response = client.post('/api/decisions', json={
            'template_id': template, 'data': {},
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.get_json()
        year = datetime.utcnow().year
        assert data.get('internal_number') is not None
        assert data['internal_number'].startswith(f'ΠΚΜ-{year}/')

    def test_sequential_numbers(self, app, client, auth_headers, template):
        resp1 = client.post('/api/decisions', json={
            'template_id': template, 'data': {},
        }, headers=auth_headers)
        resp2 = client.post('/api/decisions', json={
            'template_id': template, 'data': {},
        }, headers=auth_headers)
        num1 = resp1.get_json()['internal_number']
        num2 = resp2.get_json()['internal_number']
        # Extract sequential part
        seq1 = int(num1.split('/')[1])
        seq2 = int(num2.split('/')[1])
        assert seq2 == seq1 + 1

    def test_internal_number_in_to_dict(self, app, client, auth_headers, template):
        resp = client.post('/api/decisions', json={
            'template_id': template, 'data': {},
        }, headers=auth_headers)
        rec_id = resp.get_json()['id']
        detail = client.get(f'/api/decisions/{rec_id}', headers=auth_headers)
        assert 'internal_number' in detail.get_json()
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_documents/test_internal_numbering.py -v`
Expected: FAIL — `internal_number` not in response.

**Step 3: Add `internal_number` column to DecisionRecord**

In `models.py`, add after `protocol_number` (after line 71):

```python
    internal_number = db.Column(db.String(20), unique=True, index=True)
```

Add to `to_dict()` (after the `protocol_number` line in the dict, around line 101):

```python
            'internal_number': self.internal_number,
```

**Step 4: Add `_next_internal_number()` and update `create_decision()`**

In `routes.py`, add helper function before the routes (after the `_audit` function, around line 16):

```python
def _next_internal_number():
    """Generate next internal document number: ΠΚΜ-YYYY/NNNN."""
    from datetime import datetime
    year = datetime.utcnow().year
    prefix = f'ΠΚΜ-{year}/'
    last = (DecisionRecord.query
            .filter(DecisionRecord.internal_number.like(f'{prefix}%'))
            .order_by(DecisionRecord.internal_number.desc())
            .first())
    if last and last.internal_number:
        seq = int(last.internal_number.split('/')[1]) + 1
    else:
        seq = 1
    return f'{prefix}{seq:04d}'
```

In the `create_decision()` function (around line 108-115), add `internal_number` when creating the record:

```python
    record = DecisionRecord(
        template_id=template.id,
        structure_id=data.get('structure_id'),
        data=user_data,
        rendered_body=rendered,
        status='draft',
        created_by=user_id,
        internal_number=_next_internal_number(),
    )
```

**Step 5: Run tests**

Run: `python -m pytest tests/test_documents/ -v`
Expected: ALL PASS.

**Step 6: Update frontend to show internal_number**

In `DocumentRegistryPage.jsx`, add an "Εσωτ. Αρ." column in the table header (after the "Α/Α" th, around line 202):

```jsx
<th className="text-left px-4 py-3 text-sm font-semibold text-[#2a2520]">Εσωτ. Αρ.</th>
```

And in the tbody row (after the Α/Α td, around line 215):

```jsx
<td className="px-4 py-3 text-sm text-[#2a2520] font-mono">
  {doc.internal_number || '—'}
</td>
```

Note: The `internal_number` field needs to be added to the document registry API response. In `routes.py`, in the `document_registry()` function, add `'internal_number': rec.internal_number,` to the DecisionRecord dict (around line 299).

Build frontend: `cd frontend && npx pnpm build`

**Step 7: Commit**

```bash
git add backend/my_project/documents/models.py backend/my_project/documents/routes.py frontend/src/pages/DocumentRegistryPage.jsx tests/test_documents/
git commit -m "feat: add internal document numbering (ΠΚΜ-YYYY/NNNN)"
```

---

## Task 6: SanctionDecision Bridge — Tests + Implementation

**Files:**
- Create: `backend/my_project/documents/bridge.py`
- Modify: `backend/my_project/sanctions/routes.py:264-301` — call bridge on approval
- Modify: `backend/my_project/documents/routes.py:278-373` — simplify document_registry to remove SanctionDecision aggregation
- Create: `tests/test_documents/test_bridge.py`

**Step 1: Write the bridge tests**

Create `tests/test_documents/test_bridge.py`:

```python
"""Tests for SanctionDecision → DecisionRecord bridge."""
import pytest
from datetime import datetime


@pytest.fixture
def sanction_template(app):
    """Create a sanction_fine template."""
    from my_project.documents.models import DecisionTemplate
    from my_project.extensions import db as _db
    with app.app_context():
        tpl = DecisionTemplate.query.filter_by(type='sanction_fine').first()
        if not tpl:
            tpl = DecisionTemplate(
                type='sanction_fine', title='Απόφαση Επιβολής Προστίμου',
                body_template='<p>Πρόστιμο</p>',
                schema={'fields': []},
            )
            _db.session.add(tpl)
            _db.session.commit()
        return tpl.id


@pytest.fixture
def sanction_decision(app, sanction_template):
    """Create a SanctionDecision in 'submitted' status."""
    from my_project.sanctions.models import SanctionDecision
    from my_project.registry.models import StructureType, Structure
    from my_project.extensions import db as _db

    with app.app_context():
        # Ensure structure type exists
        st = StructureType.query.filter_by(code='MFH').first()
        if not st:
            st = StructureType(code='MFH', name='ΜΦΗ',
                               description='Μονάδα Φροντίδας Ηλικιωμένων')
            _db.session.add(st)
            _db.session.flush()

        # Ensure structure exists
        s = Structure.query.filter_by(code='MFH-TEST-01').first()
        if not s:
            s = Structure(name='Test Structure', code='MFH-TEST-01',
                          structure_type_id=st.id, city='Αθήνα', status='active')
            _db.session.add(s)
            _db.session.flush()

        # Create sanction
        from my_project.registry.models import Sanction
        sanc = Sanction(structure_id=s.id, type='fine',
                        description='Test violation', amount=5000.00,
                        status='active', date=datetime.utcnow().date())
        _db.session.add(sanc)
        _db.session.flush()

        dec = SanctionDecision(
            sanction_id=sanc.id, status='submitted',
            drafted_by=1, final_amount=5000.00,
            obligor_name='Test Company', obligor_afm='123456789',
        )
        _db.session.add(dec)
        _db.session.commit()
        return dec.id


class TestBridge:
    def test_creates_decision_record(self, app, sanction_decision, sanction_template):
        from my_project.documents.bridge import create_decision_from_sanction
        from my_project.sanctions.models import SanctionDecision
        from my_project.documents.models import DecisionRecord
        from my_project.extensions import db as _db

        with app.app_context():
            sd = _db.session.get(SanctionDecision, sanction_decision)
            record = create_decision_from_sanction(sd)
            assert record is not None
            assert record.status == 'draft'
            assert record.source_type == 'sanction_decision'
            assert record.source_id == sd.id

    def test_copies_structure_id(self, app, sanction_decision, sanction_template):
        from my_project.documents.bridge import create_decision_from_sanction
        from my_project.sanctions.models import SanctionDecision
        from my_project.extensions import db as _db

        with app.app_context():
            sd = _db.session.get(SanctionDecision, sanction_decision)
            record = create_decision_from_sanction(sd)
            assert record.structure_id == sd.sanction.structure_id

    def test_stores_source_reference(self, app, sanction_decision, sanction_template):
        from my_project.documents.bridge import create_decision_from_sanction
        from my_project.sanctions.models import SanctionDecision
        from my_project.extensions import db as _db

        with app.app_context():
            sd = _db.session.get(SanctionDecision, sanction_decision)
            record = create_decision_from_sanction(sd)
            assert record.data.get('source_sanction_decision_id') == sd.id
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_documents/test_bridge.py -v`
Expected: FAIL — `cannot import name 'create_decision_from_sanction'` and `source_type` not on model.

**Step 3: Add `source_type` and `source_id` to DecisionRecord**

In `models.py`, add after the `internal_number` column:

```python
    # Source tracking (for bridged documents)
    source_type = db.Column(db.String(50))  # e.g. 'sanction_decision', 'template'
    source_id = db.Column(db.Integer)  # ID in the source table
```

Add to `to_dict()`:

```python
            'source_type': self.source_type,
            'source_id': self.source_id,
```

**Step 4: Create bridge.py**

Create `backend/my_project/documents/bridge.py`:

```python
"""Bridge functions to create DecisionRecords from other modules."""
from ..extensions import db
from .models import DecisionTemplate, DecisionRecord


def create_decision_from_sanction(sanction_decision):
    """
    Create a DecisionRecord from an approved SanctionDecision.

    Args:
        sanction_decision: SanctionDecision model instance

    Returns:
        DecisionRecord instance (already added to session, not committed)
    """
    # Find the matching template
    sd = sanction_decision
    template_type = 'sanction_fine'
    if sd.final_amount is None or sd.final_amount == 0:
        template_type = 'sanction_suspension'

    template = (DecisionTemplate.query
                .filter_by(type=template_type, is_active=True)
                .first())
    if not template:
        # Fallback: use any sanction template
        template = (DecisionTemplate.query
                    .filter(DecisionTemplate.type.like('sanction%'),
                            DecisionTemplate.is_active == True)
                    .first())
    if not template:
        return None

    # Build rendered body from sanction data
    from .generator import resolve_placeholders
    from ..registry.models import Structure
    structure = (Structure.query.get(sd.sanction.structure_id)
                 if sd.sanction else None)

    user_data = {
        'source_sanction_decision_id': sd.id,
        'obligor_name': sd.obligor_name or '',
        'obligor_afm': sd.obligor_afm or '',
        'final_amount': str(sd.final_amount or ''),
        'protocol_number': sd.protocol_number or '',
    }
    rendered = resolve_placeholders(template.body_template, structure, user_data)

    # Generate internal number
    from .routes import _next_internal_number
    record = DecisionRecord(
        template_id=template.id,
        structure_id=sd.sanction.structure_id if sd.sanction else None,
        data=user_data,
        rendered_body=rendered,
        status='draft',
        created_by=sd.approved_by or sd.drafted_by,
        internal_number=_next_internal_number(),
        source_type='sanction_decision',
        source_id=sd.id,
    )
    db.session.add(record)
    return record
```

**Step 5: Run tests**

Run: `python -m pytest tests/test_documents/test_bridge.py -v`
Expected: ALL PASS.

**Step 6: Wire bridge into sanctions approve endpoint**

In `backend/my_project/sanctions/routes.py`, in `approve_decision()` (around line 284), add after `decision.protocol_number = f'{year}/{count + 1:04d}'`:

```python
        # Bridge: create document record for the registry
        from ..documents.bridge import create_decision_from_sanction
        create_decision_from_sanction(decision)
```

**Step 7: Remove SanctionDecision from document_registry()**

In `routes.py` (documents), remove the entire `# 4. SanctionDecisions` block (lines 354-373 approximately). They now enter the registry via the bridge as DecisionRecords.

**Step 8: Run all tests**

Run: `python -m pytest tests/ -v`
Expected: ALL PASS.

**Step 9: Commit**

```bash
git add backend/my_project/documents/bridge.py backend/my_project/documents/models.py backend/my_project/documents/routes.py backend/my_project/sanctions/routes.py tests/test_documents/
git commit -m "feat: bridge SanctionDecision approval to document registry"
```

---

## Task 7: Document Registry Performance Rewrite

**Files:**
- Modify: `backend/my_project/documents/routes.py:278-409` — rewrite `document_registry()` as single-table query
- Modify: `backend/my_project/documents/models.py` — add relationship helpers

**Step 1: Write performance test**

Append to `tests/test_documents/test_bridge.py`:

```python
class TestDocumentRegistry:
    def test_registry_returns_decision_records(self, app, client, auth_headers):
        """Registry should return decision records including bridged ones."""
        response = client.get('/api/document-registry', headers=auth_headers)
        assert response.status_code == 200
        data = response.get_json()
        assert 'documents' in data
        assert 'total' in data
        assert 'pages' in data

    def test_registry_filters_by_status(self, app, client, auth_headers):
        response = client.get('/api/document-registry?status=draft', headers=auth_headers)
        assert response.status_code == 200
        for doc in response.get_json()['documents']:
            assert doc['status'] == 'draft'

    def test_registry_filters_by_search(self, app, client, auth_headers):
        response = client.get('/api/document-registry?search=ΠΚΜ', headers=auth_headers)
        assert response.status_code == 200
```

**Step 2: Rewrite `document_registry()` as single-table query**

Replace the entire `document_registry()` function in `routes.py` with:

```python
@documents_bp.route('/api/document-registry', methods=['GET'])
@jwt_required()
def document_registry():
    """Unified view of all documents — single-table query on DecisionRecords."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    status = request.args.get('status')
    structure_id = request.args.get('structure_id', type=int)
    search = request.args.get('search')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')

    query = DecisionRecord.query

    if status:
        query = query.filter(DecisionRecord.status == status)
    if structure_id:
        query = query.filter(DecisionRecord.structure_id == structure_id)
    if search:
        search_term = f'%{search}%'
        query = query.filter(
            db.or_(
                DecisionRecord.protocol_number.ilike(search_term),
                DecisionRecord.internal_number.ilike(search_term),
                DecisionRecord.rendered_body.ilike(search_term),
            )
        )
    if date_from:
        query = query.filter(DecisionRecord.created_at >= date_from)
    if date_to:
        query = query.filter(DecisionRecord.created_at <= date_to)

    query = query.order_by(DecisionRecord.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page,
                                error_out=False)

    documents = []
    for rec in pagination.items:
        documents.append({
            'id': rec.id,
            'source': rec.source_type or 'decision_record',
            'type': rec.template.type if rec.template else 'unknown',
            'type_label': rec.template.title if rec.template else '',
            'internal_number': rec.internal_number,
            'protocol_number': rec.protocol_number,
            'structure_id': rec.structure_id,
            'structure_name': (rec.structure.name
                               if rec.structure else None),
            'date': (rec.created_at.isoformat()
                     if rec.created_at else None),
            'status': rec.status,
            'author': (rec.author.username
                       if rec.author else None),
        })

    return jsonify({
        'documents': documents,
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }), 200
```

This removes the multi-model aggregation (InspectionReport, SocialAdvisorReport, SanctionDecision) and queries only `decision_records`. Future bridges can funnel other document types into DecisionRecords.

**Step 3: Run tests**

Run: `python -m pytest tests/test_documents/ -v`
Expected: ALL PASS.

**Step 4: Commit**

```bash
git add backend/my_project/documents/routes.py
git commit -m "perf: rewrite document registry as single-table query on DecisionRecords"
```

---

## Task 8: Template Versioning — Tests + Implementation

**Files:**
- Modify: `backend/my_project/documents/routes.py` — add `POST /api/templates/<id>/new-version`
- Modify: `frontend/src/pages/DocumentComposePage.jsx` — show version in template card
- Create: `tests/test_documents/test_versioning.py`

**Step 1: Write the tests**

Create `tests/test_documents/test_versioning.py`:

```python
"""Tests for template versioning."""
import pytest


@pytest.fixture
def versioned_template(app):
    from my_project.documents.models import DecisionTemplate
    from my_project.extensions import db as _db
    with app.app_context():
        tpl = DecisionTemplate(
            type='version_test', title='Version Test Template',
            body_template='<p>Version 1</p>', version=1,
            schema={'fields': []}, is_active=True,
        )
        _db.session.add(tpl)
        _db.session.commit()
        return tpl.id


class TestTemplateVersioning:
    def test_clone_creates_new_version(self, app, client, auth_headers, versioned_template):
        response = client.post(
            f'/api/templates/{versioned_template}/new-version',
            json={'body_template': '<p>Version 2</p>'},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.get_json()
        assert data['version'] == 2
        assert data['is_active'] is True

    def test_old_version_deactivated(self, app, client, auth_headers, versioned_template):
        client.post(
            f'/api/templates/{versioned_template}/new-version',
            json={'body_template': '<p>Version 2</p>'},
            headers=auth_headers,
        )
        from my_project.documents.models import DecisionTemplate
        with app.app_context():
            old = DecisionTemplate.query.get(versioned_template)
            assert old.is_active is False

    def test_list_only_shows_active(self, app, client, auth_headers, versioned_template):
        client.post(
            f'/api/templates/{versioned_template}/new-version',
            json={},
            headers=auth_headers,
        )
        response = client.get('/api/templates', headers=auth_headers)
        types = [t['type'] for t in response.get_json()]
        # Should only have the active version
        version_test_templates = [t for t in response.get_json() if t['type'] == 'version_test']
        assert len(version_test_templates) == 1
        assert version_test_templates[0]['version'] == 2

    def test_old_decision_keeps_old_template(self, app, client, auth_headers, versioned_template):
        """Decisions created with v1 should still reference v1."""
        # Create decision with v1
        resp = client.post('/api/decisions', json={
            'template_id': versioned_template, 'data': {},
        }, headers=auth_headers)
        decision_id = resp.get_json()['id']
        old_template_id = versioned_template

        # Create v2
        client.post(
            f'/api/templates/{versioned_template}/new-version',
            json={'body_template': '<p>Version 2</p>'},
            headers=auth_headers,
        )

        # Check decision still references v1
        detail = client.get(f'/api/decisions/{decision_id}', headers=auth_headers)
        assert detail.get_json()['template_id'] == old_template_id
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_documents/test_versioning.py -v`
Expected: FAIL — 404/405 on `/api/templates/<id>/new-version`.

**Step 3: Add the new-version endpoint**

In `routes.py`, add after the `get_template` endpoint (after line 44):

```python
@documents_bp.route('/api/templates/<int:template_id>/new-version',
                     methods=['POST'])
@jwt_required()
def create_new_version(template_id):
    """Clone a template as a new version, deactivating the old one."""
    old = DecisionTemplate.query.get_or_404(template_id)
    data = request.get_json() or {}

    new_template = DecisionTemplate(
        type=old.type,
        title=data.get('title', old.title),
        description=data.get('description', old.description),
        body_template=data.get('body_template', old.body_template),
        legal_references=data.get('legal_references', old.legal_references),
        schema=data.get('schema', old.schema),
        recipients_template=data.get('recipients_template',
                                      old.recipients_template),
        structure_type_code=old.structure_type_code,
        is_active=True,
        version=old.version + 1,
    )
    old.is_active = False

    db.session.add(new_template)
    db.session.commit()

    return jsonify(new_template.to_dict()), 201
```

**Step 4: Run tests**

Run: `python -m pytest tests/test_documents/test_versioning.py -v`
Expected: ALL PASS.

**Step 5: Show version in frontend template cards**

In `DocumentComposePage.jsx`, in the template card (around line 280-289), add version badge:

```jsx
<div className="flex items-center gap-2 text-xs text-[#8a8580]">
  <FileText className="w-3 h-3" />
  <span>{(t.schema?.fields || []).length} πεδία</span>
  <span className="ml-2">v{t.version || 1}</span>
  {t.structure_type_code && (
    <>
      <Building2 className="w-3 h-3 ml-2" />
      <span>{t.structure_type_code}</span>
    </>
  )}
</div>
```

**Step 6: Build and verify**

Run: `cd frontend && npx pnpm build`
Expected: PASS.

**Step 7: Commit**

```bash
git add backend/my_project/documents/routes.py frontend/src/pages/DocumentComposePage.jsx tests/test_documents/
git commit -m "feat: add template versioning with clone endpoint"
```

---

## Task 9: Bulk Document Generation — Backend

**Files:**
- Modify: `backend/my_project/documents/routes.py` — add `POST /api/decisions/bulk`
- Create: `tests/test_documents/test_bulk.py`

**Step 1: Write the tests**

Create `tests/test_documents/test_bulk.py`:

```python
"""Tests for bulk document generation endpoint."""
import pytest


@pytest.fixture
def bulk_template(app):
    from my_project.documents.models import DecisionTemplate
    from my_project.extensions import db as _db
    with app.app_context():
        tpl = DecisionTemplate.query.filter_by(type='bulk_test').first()
        if not tpl:
            tpl = DecisionTemplate(
                type='bulk_test', title='Bulk Test',
                body_template='<p>Decision for {{name}}</p>',
                schema={'fields': [{'key': 'name', 'label': 'Name',
                                    'type': 'text', 'required': True}]},
            )
            _db.session.add(tpl)
            _db.session.commit()
        return tpl.id


class TestBulkCreation:
    def test_creates_multiple_records(self, app, client, auth_headers, bulk_template):
        response = client.post('/api/decisions/bulk', json={
            'template_id': bulk_template,
            'records': [
                {'data': {'name': 'Camp Alpha'}},
                {'data': {'name': 'Camp Beta'}},
                {'data': {'name': 'Camp Gamma'}},
            ],
        }, headers=auth_headers)
        assert response.status_code == 201
        data = response.get_json()
        assert len(data['decisions']) == 3

    def test_each_gets_internal_number(self, app, client, auth_headers, bulk_template):
        response = client.post('/api/decisions/bulk', json={
            'template_id': bulk_template,
            'records': [
                {'data': {'name': 'One'}},
                {'data': {'name': 'Two'}},
            ],
        }, headers=auth_headers)
        decisions = response.get_json()['decisions']
        numbers = [d['internal_number'] for d in decisions]
        assert len(set(numbers)) == 2  # all unique

    def test_empty_records_rejected(self, app, client, auth_headers, bulk_template):
        response = client.post('/api/decisions/bulk', json={
            'template_id': bulk_template,
            'records': [],
        }, headers=auth_headers)
        assert response.status_code == 400

    def test_invalid_template_rejected(self, app, client, auth_headers):
        response = client.post('/api/decisions/bulk', json={
            'template_id': 99999,
            'records': [{'data': {'name': 'Test'}}],
        }, headers=auth_headers)
        assert response.status_code == 404
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_documents/test_bulk.py -v`
Expected: FAIL — 404/405 on `/api/decisions/bulk`.

**Step 3: Implement bulk endpoint**

In `routes.py`, add after the `create_decision` endpoint:

```python
@documents_bp.route('/api/decisions/bulk', methods=['POST'])
@jwt_required()
def create_decisions_bulk():
    """Create multiple decision records in a single transaction."""
    user_id = int(get_jwt_identity())
    data = request.get_json()

    template = DecisionTemplate.query.get_or_404(data['template_id'])
    records_data = data.get('records', [])

    if not records_data:
        return jsonify({'error': 'Δεν δόθηκαν εγγραφές'}), 400

    from ..registry.models import Structure

    created = []
    for item in records_data:
        structure = None
        if item.get('structure_id'):
            structure = Structure.query.get(item['structure_id'])

        user_data = item.get('data', {})
        rendered = resolve_placeholders(
            template.body_template, structure, user_data)

        record = DecisionRecord(
            template_id=template.id,
            structure_id=item.get('structure_id'),
            data=user_data,
            rendered_body=rendered,
            status='draft',
            created_by=user_id,
            internal_number=_next_internal_number(),
        )
        db.session.add(record)
        db.session.flush()
        created.append(record)

    _audit(user_id, 'bulk_create', 'decision_record', created[0].id,
           {'count': len(created)})
    db.session.commit()

    return jsonify({
        'decisions': [r.to_dict() for r in created],
        'count': len(created),
    }), 201
```

**Step 4: Run tests**

Run: `python -m pytest tests/test_documents/test_bulk.py -v`
Expected: ALL PASS.

**Step 5: Commit**

```bash
git add backend/my_project/documents/routes.py tests/test_documents/
git commit -m "feat: add bulk document generation endpoint"
```

---

## Task 10: Bulk Document Generation — Frontend

**Files:**
- Create: `frontend/src/pages/BulkDocumentPage.jsx`
- Modify: `frontend/src/App.jsx` — add route + import
- Modify: `frontend/src/pages/DocumentRegistryPage.jsx` — add "Μαζική Δημιουργία" button

**Step 1: Install SheetJS**

```bash
cd frontend && npx pnpm add xlsx
```

**Step 2: Create BulkDocumentPage.jsx**

Create `frontend/src/pages/BulkDocumentPage.jsx`:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import {
  ArrowLeft, ArrowRight, Upload, FileSpreadsheet,
  CheckCircle, AlertCircle, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import * as XLSX from 'xlsx';

const STEPS = [
  { id: 'template', label: 'Πρότυπο' },
  { id: 'upload', label: 'Αρχείο Excel' },
  { id: 'mapping', label: 'Αντιστοίχιση' },
  { id: 'confirm', label: 'Επιβεβαίωση' },
];

function BulkDocumentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [excelRows, setExcelRows] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    api.get('/api/templates').then(({ data }) => setTemplates(data));
  }, []);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws);
      if (data.length === 0) {
        toast.error('Το αρχείο δεν περιέχει δεδομένα');
        return;
      }
      setExcelHeaders(Object.keys(data[0]));
      setExcelRows(data);
      // Auto-map columns by matching header names to field keys/labels
      const fields = selectedTemplate?.schema?.fields || [];
      const autoMap = {};
      fields.forEach(f => {
        const match = Object.keys(data[0]).find(
          h => h.toLowerCase() === f.key.toLowerCase()
            || h.toLowerCase() === f.label.toLowerCase()
        );
        if (match) autoMap[f.key] = match;
      });
      setColumnMapping(autoMap);
      setStep(2);
    };
    reader.readAsArrayBuffer(file);
  }, [selectedTemplate]);

  const handleCreate = async () => {
    const fields = selectedTemplate?.schema?.fields || [];
    const records = excelRows.map(row => {
      const data = {};
      fields.forEach(f => {
        const col = columnMapping[f.key];
        if (col && row[col] !== undefined) {
          data[f.key] = String(row[col]);
        }
      });
      return { data };
    });

    setIsCreating(true);
    try {
      const { data } = await api.post('/api/decisions/bulk', {
        template_id: selectedTemplate.id,
        records,
      });
      toast.success(`Δημιουργήθηκαν ${data.count} έγγραφα`);
      navigate('/documents');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Σφάλμα δημιουργίας');
    } finally {
      setIsCreating(false);
    }
  };

  const fields = selectedTemplate?.schema?.fields || [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => navigate('/documents')} className="min-h-[44px]">
          <ArrowLeft className="w-5 h-5 mr-2" />
          Πίσω
        </Button>
        <h1 className="text-2xl font-bold text-[#2a2520]" style={{ fontFamily: "'Literata', serif" }}>
          Μαζική Δημιουργία Εγγράφων
        </h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
              i === step ? 'bg-[#1a3aa3] text-white'
                : i < step ? 'bg-green-100 text-green-700'
                : 'bg-[#f8f5f0] text-[#8a8580]'
            }`}>
              {i < step ? <CheckCircle className="w-4 h-4" /> : null}
              {s.label}
            </div>
            {i < STEPS.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 ${i < step ? 'bg-green-300' : 'bg-[#e8e2d8]'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Template */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <Card
              key={t.id}
              className="border-[#e8e2d8] hover:border-[#1a3aa3] hover:shadow-md transition-all cursor-pointer"
              onClick={() => { setSelectedTemplate(t); setStep(1); }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-[#2a2520]">{t.title}</CardTitle>
                <CardDescription className="text-sm">{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-[#8a8580]">
                  <FileText className="w-3 h-3" />
                  <span>{(t.schema?.fields || []).length} πεδία</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Φόρτωση Αρχείου Excel</CardTitle>
            <CardDescription>
              Ανεβάστε .xlsx με μία γραμμή ανά έγγραφο. Οι στήλες θα αντιστοιχιστούν στα πεδία του προτύπου.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Required fields */}
            <div>
              <h3 className="text-sm font-medium text-[#2a2520] mb-2">Πεδία προτύπου «{selectedTemplate?.title}»:</h3>
              <div className="flex flex-wrap gap-2">
                {fields.map(f => (
                  <Badge key={f.key} variant="outline" className="border-[#e8e2d8]">
                    {f.label} {f.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Upload zone */}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-[#e8e2d8] rounded-lg p-12 cursor-pointer hover:border-[#1a3aa3] transition-colors">
              <FileSpreadsheet className="w-12 h-12 text-[#8a8580] mb-4" />
              <span className="text-[#2a2520] font-medium">Σύρετε ή κάντε κλικ για αρχείο .xlsx</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            </label>

            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(0)} className="min-h-[44px] border-[#e8e2d8]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Πίσω
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapping */}
      {step === 2 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Αντιστοίχιση Στηλών</CardTitle>
            <CardDescription>
              Βρέθηκαν {excelRows.length} γραμμές. Αντιστοιχίστε τις στήλες του Excel στα πεδία του προτύπου.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map(f => (
              <div key={f.key} className="flex items-center gap-4">
                <div className="w-48 text-sm font-medium text-[#2a2520]">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                </div>
                <Select
                  value={columnMapping[f.key] || '_unmapped'}
                  onValueChange={(v) => setColumnMapping(prev => ({
                    ...prev, [f.key]: v === '_unmapped' ? undefined : v,
                  }))}
                >
                  <SelectTrigger className="flex-1 min-h-[44px] border-[#e8e2d8]">
                    <SelectValue placeholder="Επιλέξτε στήλη..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_unmapped">— Χωρίς αντιστοίχιση —</SelectItem>
                    {excelHeaders.map(h => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {columnMapping[f.key] ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className={`w-5 h-5 ${f.required ? 'text-red-500' : 'text-[#c4bfb8]'}`} />
                )}
              </div>
            ))}

            <div className="flex justify-between pt-4 border-t border-[#e8e2d8]">
              <Button variant="outline" onClick={() => setStep(1)} className="min-h-[44px] border-[#e8e2d8]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Πίσω
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px]"
              >
                Συνέχεια
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <Card className="border-[#e8e2d8]">
          <CardHeader>
            <CardTitle className="text-lg text-[#2a2520]">Επιβεβαίωση Δημιουργίας</CardTitle>
            <CardDescription>
              Θα δημιουργηθούν <strong>{excelRows.length}</strong> έγγραφα τύπου «{selectedTemplate?.title}».
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Preview first 5 rows */}
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#f8f5f0] border-b border-[#e8e2d8]">
                    <th className="px-3 py-2 text-left text-[#2a2520]">#</th>
                    {fields.filter(f => columnMapping[f.key]).map(f => (
                      <th key={f.key} className="px-3 py-2 text-left text-[#2a2520]">{f.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {excelRows.slice(0, 5).map((row, idx) => (
                    <tr key={idx} className="border-b border-[#e8e2d8]">
                      <td className="px-3 py-2 text-[#6b6560]">{idx + 1}</td>
                      {fields.filter(f => columnMapping[f.key]).map(f => (
                        <td key={f.key} className="px-3 py-2">{row[columnMapping[f.key]] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {excelRows.length > 5 && (
              <p className="text-sm text-[#8a8580] mb-4">...και {excelRows.length - 5} ακόμα εγγραφές</p>
            )}

            <div className="flex justify-between pt-4 border-t border-[#e8e2d8]">
              <Button variant="outline" onClick={() => setStep(2)} className="min-h-[44px] border-[#e8e2d8]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Πίσω
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating}
                className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[44px] px-6"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isCreating ? 'Δημιουργία...' : `Δημιουργία ${excelRows.length} Εγγράφων`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default BulkDocumentPage;
```

**Step 3: Add route and nav**

In `App.jsx`, add import (around line 55):
```jsx
import BulkDocumentPage from '@/pages/BulkDocumentPage';
```

Add route after the documents preview route:
```jsx
<Route path="/documents/bulk" element={
  <ProtectedRoute>
    <BulkDocumentPage />
  </ProtectedRoute>
} />
```

In `DocumentRegistryPage.jsx`, add a "Μαζική Δημιουργία" button next to "Νέο Έγγραφο" (around line 124-129):

```jsx
<div className="flex gap-3">
  <Link to="/documents/bulk">
    <Button variant="outline" className="min-h-[48px] px-6 border-[#e8e2d8]">
      <FileSpreadsheet className="w-5 h-5 mr-2" />
      Μαζική Δημιουργία
    </Button>
  </Link>
  <Link to="/documents/new">
    <Button className="bg-[#1a3aa3] hover:bg-[#152e82] text-white min-h-[48px] px-6">
      <Plus className="w-5 h-5 mr-2" />
      Νέο Έγγραφο
    </Button>
  </Link>
</div>
```

Add `FileSpreadsheet` to the lucide-react imports in DocumentRegistryPage.jsx.

**Step 4: Build and verify**

Run: `cd frontend && npx pnpm build`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/pages/BulkDocumentPage.jsx frontend/src/pages/DocumentRegistryPage.jsx frontend/src/App.jsx frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat: add bulk document generation from Excel upload"
```

---

## Task 11: Update Seed Data for New Fields

**Files:**
- Modify: `backend/my_project/seed_demo.py` — add `internal_number` and `source_type` to sample records

**Step 1: Update seed data**

In `seed_demo.py`, in the `_seed_decision_records()` function, add `internal_number` and `source_type='template'` to all sample DecisionRecord instances. Use pattern `ΠΚΜ-2026/0001` through `ΠΚΜ-2026/0005`.

**Step 2: Run full test suite**

Run: `python -m pytest tests/ -v`
Run: `cd frontend && npx pnpm build`
Expected: ALL PASS.

**Step 3: Commit**

```bash
git add backend/my_project/seed_demo.py
git commit -m "chore: update seed data with internal_number and source_type fields"
```

---

## Task 12: Final Verification + DIARY.md

**Step 1: Run full backend test suite**

Run: `python -m pytest tests/ -v`
Expected: ALL PASS.

**Step 2: Build frontend**

Run: `cd frontend && npx pnpm build`
Expected: PASS.

**Step 3: Verify routes registered**

Run: `cd backend && python -c "from my_project import create_app; app = create_app(); print([r.rule for r in app.url_map.iter_rules() if '/api/' in r.rule])"`
Expected: Should include `/api/decisions/<id>/docx`, `/api/templates/<id>/new-version`, `/api/decisions/bulk`.

**Step 4: Update DIARY.md**

Append diary entry with session nickname and reflection.

**Step 5: Commit**

```bash
git add DIARY.md
git commit -m "docs: add diary entry for document composition improvements"
```

---

## Summary: Commit Sequence

| # | Commit Message | Tasks |
|---|---------------|-------|
| 1 | `feat: add DOCX generation for decisions with institutional header and legal references` | 1, 2 |
| 2 | `feat: add DOCX download endpoint and update ΙΡΙΔΑ to send DOCX` | 3 |
| 3 | `feat: add A4 document preview component with institutional header and draft watermark` | 4 |
| 4 | `feat: add internal document numbering (ΠΚΜ-YYYY/NNNN)` | 5 |
| 5 | `feat: bridge SanctionDecision approval to document registry` | 6 |
| 6 | `perf: rewrite document registry as single-table query on DecisionRecords` | 7 |
| 7 | `feat: add template versioning with clone endpoint` | 8 |
| 8 | `feat: add bulk document generation endpoint` | 9 |
| 9 | `feat: add bulk document generation from Excel upload` | 10 |
| 10 | `chore: update seed data with internal_number and source_type fields` | 11 |
| 11 | `docs: add diary entry for document composition improvements` | 12 |

## Batch Strategy

**Batch 1 (Tasks 1-3):** DOCX generation — tests, implementation, endpoint, frontend button
**Batch 2 (Tasks 4-5):** A4 preview + internal numbering
**Batch 3 (Tasks 6-7):** Bridge + registry rewrite
**Batch 4 (Tasks 8-10):** Versioning + bulk generation (backend + frontend)
**Batch 5 (Tasks 11-12):** Seed data + verification
