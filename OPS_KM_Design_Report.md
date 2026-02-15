# ΟΠΣ Κοινωνικής Μέριμνας — Technical Design Report

> **For Claude Code:** This document describes the FULL SYSTEM DESIGN for ΟΠΣ-ΚΜ (Ολοκληρωμένο Πληροφοριακό Σύστημα Κοινωνικής Μέριμνας). Read CLAUDE.md and PKM_Registry_System_Requirements.md first for existing codebase context. Then use this report + the `writing-plan` skill to produce a phased implementation plan.

---

## 1. Context: What Exists Today

The application is a working prototype called ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ, deployed on Render. It has four subsystems:

**Subsystem A — Document Archive (Αρχείο Νομοθεσίας)**
File management with folder hierarchy, uploads, downloads. Backend: `/api/files/*`, `/api/folders/create`. Frontend: `ApothecaryPage.jsx`.

**Subsystem B — Professional Forum (Forum Επαγγελματικής Ανταλλαγής)**
Threaded discussions with categories, reactions, mentions, attachments. Backend: `/api/categories`, `/api/discussions`, `/api/discussions/{id}/posts`. Frontend: `ForumPage.jsx`.

**Subsystem C — AI Legal Assistant (AI Βοηθός Νομοθεσίας)**
RAG-based search over Greek social welfare legislation. Uses pgvector cosine similarity to find relevant chunks, then loads full source documents for LLM context. Backend: `/api/chat`, `/api/knowledge/*`. Frontend: `AssistantPage.jsx`. Module: `backend/my_project/ai/`.

**Subsystem D — Knowledge Base Admin**
Admin-only page for managing curated documents that feed the RAG pipeline. Backend: `/api/knowledge/upload`, `/api/knowledge/list`, `/api/knowledge/reindex`. Frontend: `KnowledgeBasePage.jsx`.

### Current Tech Stack
- **Backend:** Flask 3.x, Application Factory pattern, single Blueprint (`routes.py`)
- **Database:** PostgreSQL 16 + pgvector, SQLAlchemy ORM
- **Auth:** Flask-JWT-Extended, roles: admin/staff/guest
- **Frontend:** React 18 + Vite + shadcn/ui + Tailwind CSS, React Router v7
- **AI:** OpenAI API (gpt-4o-mini), text-embedding-3-small (1536 dims)
- **Deployment:** Docker (multi-stage), Render
- **Security:** Flask-Limiter, Flask-Talisman, CORS lockdown, audit logging

### Current Database Models (in `backend/my_project/models.py`)
User, Category, Discussion, Post, PostAttachment, PostReaction, PostMention, UserReputation, FileItem, Notification, Conversation, ConversationParticipant, PrivateMessage, MessageAttachment, MessageReadReceipt, UserPresence, UserProfile, UserContact, UserBlock, DocumentIndex, FileChunk, ChatSession, ChatMessage, AuditLog.

### Current File Structure
```
backend/
├── app.py                    # Entry point
├── my_project/
│   ├── __init__.py           # create_app() factory
│   ├── extensions.py         # db = SQLAlchemy()
│   ├── models.py             # ALL current models (20+)
│   ├── routes.py             # ALL current routes (single blueprint)
│   └── ai/
│       ├── embeddings.py     # Chunking + OpenAI embeddings
│       ├── knowledge.py      # Document processing + vector search + full-doc loading
│       └── copilot.py        # System prompt + RAG context + LLM call
├── config/
│   └── __init__.py           # Dev/Test/Prod/Staging configs
└── tests/
    └── test_ai/              # AI module tests

frontend/src/
├── App.jsx                   # React Router, nav, layout
├── pages/
│   ├── HomePage.jsx          # Dashboard landing
│   ├── ApothecaryPage.jsx    # File management
│   ├── ForumPage.jsx         # Forum
│   ├── AssistantPage.jsx     # AI chat
│   ├── KnowledgeBasePage.jsx # Knowledge admin
│   ├── LoginPage.jsx
│   ├── ProfilePage.jsx
│   ├── AdminDashboardPage.jsx
│   └── PrivateMessagingPage.jsx
├── components/               # DropZone, PostThread, RichTextEditor, etc.
├── components/ui/            # 45+ shadcn components
├── contexts/AuthContext.jsx  # Auth state
└── lib/
    ├── api.js                # Axios + JWT interceptor
    └── auth.js               # Login/logout/token management
```

---

## 2. The Vision: Three Transformation Pillars

The current prototype proves feasibility. The full system transforms it into an Integrated Information System (ΟΠΣ) through three pillars:

### Pillar A — Interoperability with Existing Government Systems

Every data entry field that duplicates information already held by another government system must be connected to that system via the Government Interoperability Centre (ΚΕ.Δ. — ΓΓΠΣΔΔ).

| Data Field | Source System | Integration Type |
|---|---|---|
| ΑΦΜ / Business details | ΑΑΔΕ / ΓΕΜΗ (tax authority / business registry) | Lookup: enter ΑΦΜ → auto-fill name, address, legal form |
| Identity verification | New National ID system | Lookup: verify person identity |
| Criminal record | gov.gr / Ministry of Justice | Check: required for licensing |
| Protocol numbers | ΙΡΙΔΑ (government protocol system) | Sync: auto-assign protocol numbers |
| Fine certification | Accounting OPS (ΟΠΣ Λογιστηρίου) | Push: send certified fine for collection |
| Social welfare data | ΟΠΕΚΑ / ΗΔΙΚΑ | Lookup: cross-reference vulnerability criteria |

**For demo/MVP:** Mock these integrations. Create an `interop/` service layer with interface classes that return mock data. Each integration point has a clear interface so the mock can be swapped for a real API client later.

**Architecture:** `backend/my_project/interop/` module with:
- `base.py` — abstract `InteropService` class with `lookup()`, `verify()`, `push()` methods
- `aade.py` — ΑΑΔΕ/ΓΕΜΗ integration (ΑΦΜ → business details)
- `protocol.py` — ΙΡΙΔΑ protocol sync
- `criminal_record.py` — gov.gr criminal record check
- `accounting.py` — Fine certification push
- `mock_data.py` — Greek mock data for all integrations (realistic business names, addresses, ΑΦΜ patterns)

Each service reads `INTEROP_MODE` from config: `mock` (returns fake data) or `live` (calls real API). Default: `mock`.

### Pillar B — Digital Field Inspection (Mobile-First)

Inspectors (committee members, social advisors) go to care facilities and need to:
1. Open a pre-filled inspection form on their phone/tablet
2. Check items against facility-type-specific criteria
3. Record findings, attach photos
4. Submit on the spot → system updates instantly → facility operator gets notified immediately

**Key design requirements:**
- **Mobile-responsive forms:** All inspection/report forms must work perfectly on mobile viewport (≤768px). Use shadcn's responsive utilities. Large touch targets (min 44px), stacked layout, camera integration for photo upload.
- **Pre-filled from registry:** When inspector opens a form for Structure X, the form auto-loads: structure name, type, address, license status, assigned advisor, last inspection date/result, relevant legislation links.
- **Offline capability (future):** Design the forms as self-contained React components that COULD work with Service Workers + IndexedDB for offline sync. Don't implement offline now, but don't create architecture that prevents it.
- **Structured checklists per facility type:** Each `StructureType` (ΜΦΗ, ΚΔΑΠ, ΣΥΔ, etc.) has its own checklist template stored in the database. The form renders dynamically based on facility type.
- **Instant notification:** On form submission, the system sends in-app notification (existing Notification model) AND email (future) to the facility's legal representative with: what was found, what needs fixing, deadline for compliance.

### Pillar C — Instant Sanctions & Fine Certification

When an inspector finds a violation:
1. Record the violation type in the inspection form
2. System auto-calculates the fine based on: violation type, severity, recidivism history (already in system), applicable legislation
3. After administrative approval, the fine is certified and pushed to the accounting system
4. The facility operator receives digital notification with: exact amount, legal basis, appeal deadlines, payment details

**Key design requirements:**
- **Sanctions engine:** `backend/my_project/sanctions/` module with:
  - `calculator.py` — Rule-based fine calculator. Input: violation type + severity + recidivism count. Output: fine amount + legal reference. Rules loaded from a configurable table (not hardcoded).
  - `SanctionRule` model — DB table mapping violation types to base fines, escalation multipliers, legal references
  - `escalation.py` — Recidivism logic: 1st offense = base, 2nd = 2x, 3rd = 3x + possible suspension, per legal framework
- **Approval workflow:** Sanction starts as `draft` → inspector submits → supervisor reviews → `approved` → fine certified → pushed to accounting (via interop layer)
- **Full audit trail:** Every state change logged in AuditLog (already exists)

---

## 3. New Database Models

### 3.1 Registry Module (`backend/my_project/registry/models.py`)

These models are already designed in `PKM_Registry_System_Requirements.md`. Summary:

**StructureType** — Configurable facility types (ΜΦΗ, ΚΔΑΠ, ΚΔΑΠ-ΜΕΑ, ΣΥΔ, ΚΔΗΦ-ΚΑΑ, ΜΦΠΑΔ, ΒΣΟΦ)
- id, code, name, description, is_active
- Relationship: has many Structures, has many ChecklistTemplates

**Structure** — A supervised care facility (THE central entity)
- id, structure_type_id (FK), code (unique), name
- address_street, address_city, address_zip, latitude, longitude
- legal_representative_name, legal_representative_afm, legal_representative_phone, legal_representative_email
- capacity (integer), ownership_type (enum: PUBLIC, PRIVATE_PROFIT, PRIVATE_NONPROFIT, NPDD, NPID)
- status (enum: ACTIVE, SUSPENDED, REVOKED, CLOSED)
- license_number, license_issued_date, license_expiry_date, license_protocol_number
- assigned_advisor_id (FK → User)
- notes (text)
- created_at, updated_at, created_by_id (FK → User)
- Relationships: has many Inspections, Licenses, Sanctions, AdvisorReports

**License** — License lifecycle tracking
- id, structure_id (FK), license_type (enum: INITIAL, RENEWAL, AMENDMENT)
- license_number, protocol_number, issued_date, expiry_date
- issued_by, decision_document (file path)
- status (enum: ACTIVE, EXPIRED, REVOKED)
- iris_document_id (for ΙΡΙΔΑ integration — future)
- created_at, created_by_id

**InspectionCommittee** — A named committee assigned to inspect structures
- id, name, description, formation_date, dissolution_date
- formation_document (file path/protocol number)
- status (enum: ACTIVE, DISSOLVED)
- created_at, created_by_id

**CommitteeMembership** — User ↔ Committee link table
- id, committee_id (FK), user_id (FK), role_in_committee (enum: CHAIR, MEMBER, SECRETARY)
- appointed_date, removed_date

**CommitteeStructureAssignment** — Committee ↔ Structure link table
- id, committee_id (FK), structure_id (FK), assigned_date, completed_date

### 3.2 Inspection Module (`backend/my_project/inspections/models.py`)

**Inspection** — A single inspection event
- id, structure_id (FK), committee_id (FK, nullable — can be advisor-only)
- inspection_type (enum: REGULAR, EXTRAORDINARY, RE_INSPECTION)
- scheduled_date, actual_date, completed_date
- status (enum: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED)
- created_at, created_by_id

**InspectionReport** — The formal report of an inspection
- id, inspection_id (FK), author_id (FK → User)
- findings (text — rich text)
- conclusion (enum: COMPLIANT, MINOR_ISSUES, MAJOR_ISSUES, NON_COMPLIANT)
- recommendations (text)
- checklist_data (JSON — structured checklist responses)
- photos (JSON — list of file paths)
- status (enum: DRAFT, SUBMITTED, APPROVED, RETURNED)
- submitted_at, approved_at, approved_by_id (FK → User)
- notification_sent_to_operator (boolean), notification_sent_at

**SocialAdvisorReport** — Report by the social advisor
- id, structure_id (FK), inspection_id (FK, nullable — can be independent)
- author_id (FK → User)
- report_type (enum: REGULAR, EXTRAORDINARY, INCIDENT)
- assessment (text — rich text)
- improvement_proposals (text)
- attached_file (file path)
- status (enum: DRAFT, SUBMITTED, APPROVED, RETURNED)
- submitted_at, approved_at, approved_by_id

**ChecklistTemplate** — Inspection checklist per facility type
- id, structure_type_id (FK → StructureType)
- name, version
- items (JSON) — structured list of check items, each with: id, category, description, is_required, legal_reference
- is_active (boolean)
- created_at

### 3.3 Sanctions Module (`backend/my_project/sanctions/models.py`)

**Sanction** — A penalty/fine imposed on a structure
- id, structure_id (FK), inspection_id (FK, nullable)
- sanction_type (enum: FINE, SUSPENSION, REVOCATION, WARNING)
- violation_description (text)
- violation_category (string — links to SanctionRule)
- base_amount (decimal), escalation_multiplier (decimal), final_amount (decimal)
- legal_basis (text — specific law/article reference)
- recidivism_count (integer — how many prior sanctions for same violation type)
- status (enum: DRAFT, SUBMITTED, APPROVED, CERTIFIED, PAID, APPEALED, CANCELLED)
- appeal_deadline (date)
- operator_notified (boolean), operator_notified_at
- certified_at, certified_by_id (FK → User)
- accounting_reference (string — reference from ΟΠΣ Λογιστηρίου)
- notes (text)
- created_at, created_by_id

**SanctionRule** — Configurable rules for fine calculation
- id, violation_code (string, unique), violation_name
- description
- base_fine (decimal)
- escalation_2nd (decimal), escalation_3rd_plus (decimal)
- can_trigger_suspension (boolean), suspension_threshold (integer — number of offenses)
- legal_reference (text — specific law/article)
- structure_type_id (FK, nullable — if rule applies to specific facility type only)
- is_active (boolean)
- created_at

### 3.4 Interoperability Module (`backend/my_project/interop/models.py`)

**InteropLog** — Audit trail of every external system call
- id, service_name (string — 'aade', 'gemi', 'irida', 'criminal_record', 'accounting')
- request_type (string — 'lookup', 'verify', 'push')
- request_data (JSON), response_data (JSON)
- status (enum: SUCCESS, FAILURE, TIMEOUT)
- response_time_ms (integer)
- user_id (FK → User), related_entity (string), related_entity_id (integer)
- created_at

### 3.5 User Model Extension

The existing User model needs a new field:
- `registry_roles` — JSON list of role objects: `[{"role": "social_advisor", "scope": "structure", "scope_ids": [1,2,3]}, {"role": "committee_member", "scope": "committee", "scope_ids": [5]}]`

This allows dual-role without breaking existing `role` field (admin/staff/guest). The `registry_roles` is checked by the new modules' permission decorators.

---

## 4. New Backend Modules

### 4.1 Module Structure (Modular Monolith)

**Critical decision:** New code lives in NEW modules. Existing `models.py` and `routes.py` are NOT modified (zero risk to working features).

```
backend/my_project/
├── registry/
│   ├── __init__.py
│   ├── models.py          # Structure, StructureType, License, Committee models
│   ├── routes.py           # Blueprint: /api/registry/*, /api/structures/*
│   ├── services.py         # Business logic (license lifecycle, assignment)
│   └── permissions.py      # Role-based access decorators for registry
├── inspections/
│   ├── __init__.py
│   ├── models.py           # Inspection, InspectionReport, SocialAdvisorReport, ChecklistTemplate
│   ├── routes.py           # Blueprint: /api/inspections/*
│   ├── services.py         # Inspection workflow, notification triggers
│   └── forms.py            # Checklist rendering logic
├── sanctions/
│   ├── __init__.py
│   ├── models.py           # Sanction, SanctionRule
│   ├── routes.py           # Blueprint: /api/sanctions/*
│   ├── calculator.py       # Fine calculation engine
│   └── escalation.py       # Recidivism logic
├── interop/
│   ├── __init__.py
│   ├── models.py           # InteropLog
│   ├── base.py             # Abstract InteropService
│   ├── aade.py             # ΑΑΔΕ/ΓΕΜΗ mock + interface
│   ├── protocol.py         # ΙΡΙΔΑ mock + interface
│   ├── criminal_record.py  # gov.gr mock + interface
│   ├── accounting.py       # Accounting system mock + interface
│   └── mock_data.py        # Realistic Greek mock data
└── oversight/
    ├── __init__.py
    ├── routes.py            # Blueprint: /api/oversight/*
    ├── dashboard.py         # Dashboard aggregation queries
    └── reports.py           # Report generation (statistics, exports)
```

Each module registers its own Blueprint in `create_app()`. Each module's `models.py` imports `db` from `extensions.py` (same pattern as existing code).

### 4.2 Blueprint Registration

In `backend/my_project/__init__.py`, add after the existing `main_bp` registration:

```python
from my_project.registry.routes import registry_bp
from my_project.inspections.routes import inspections_bp
from my_project.sanctions.routes import sanctions_bp
from my_project.interop.routes import interop_bp  # if needed
from my_project.oversight.routes import oversight_bp

app.register_blueprint(registry_bp)
app.register_blueprint(inspections_bp)
app.register_blueprint(sanctions_bp)
app.register_blueprint(oversight_bp)
```

### 4.3 Database Migrations

**CRITICAL:** Before adding any new models, install Flask-Migrate (Alembic). The current codebase uses `db.create_all()` which cannot handle schema changes on existing databases.

```bash
pip install Flask-Migrate
# In create_app(): Migrate(app, db)
flask db init
flask db migrate -m "initial — snapshot existing schema"
flask db upgrade
```

Then for each new module: `flask db migrate -m "add registry models"` → `flask db upgrade`.

---

## 5. New API Endpoints

### 5.1 Registry Routes (`/api/registry/`)

```
GET    /api/structures                    — List structures (filtered, paginated)
POST   /api/structures                    — Create new structure
GET    /api/structures/{id}               — Full structure detail + related data
PUT    /api/structures/{id}               — Update structure
DELETE /api/structures/{id}               — Soft-delete structure

GET    /api/structures/{id}/timeline      — Chronological event feed
GET    /api/structures/{id}/inspections   — Inspections for this structure
GET    /api/structures/{id}/sanctions     — Sanctions for this structure
GET    /api/structures/{id}/licenses      — License history
GET    /api/structures/{id}/reports       — Advisor reports

POST   /api/structures/{id}/lookup-afm    — Interop: lookup ΑΦΜ → business details

GET    /api/structure-types               — List configurable facility types
POST   /api/structure-types               — Create new type (admin)

GET    /api/licenses                      — List all licenses (filtered)
POST   /api/structures/{id}/licenses      — Issue/renew license
GET    /api/licenses/expiring             — Licenses expiring within N days

GET    /api/committees                    — List committees
POST   /api/committees                    — Create committee
GET    /api/committees/{id}               — Committee detail + members + assigned structures
PUT    /api/committees/{id}               — Update committee
POST   /api/committees/{id}/members       — Add member
DELETE /api/committees/{id}/members/{uid}  — Remove member
POST   /api/committees/{id}/assign        — Assign structures to committee
```

### 5.2 Inspection Routes (`/api/inspections/`)

```
GET    /api/inspections                   — List inspections (filtered, paginated)
POST   /api/inspections                   — Schedule new inspection
GET    /api/inspections/{id}              — Inspection detail
PUT    /api/inspections/{id}              — Update inspection
POST   /api/inspections/{id}/start        — Mark as in-progress (field start)

POST   /api/inspections/{id}/report       — Submit inspection report
GET    /api/inspections/{id}/report       — Get report
PUT    /api/inspections/{id}/report       — Edit draft report
PATCH  /api/inspections/{id}/report/approve — Approve report (supervisor)
PATCH  /api/inspections/{id}/report/return  — Return report with comments

POST   /api/structures/{id}/advisor-report — Submit advisor report
GET    /api/advisor-reports               — List advisor reports (filtered)
PATCH  /api/advisor-reports/{id}/approve  — Approve advisor report

GET    /api/checklist-templates           — List templates
GET    /api/checklist-templates/{type_id} — Get checklist for structure type
POST   /api/checklist-templates           — Create/update checklist template (admin)
```

### 5.3 Sanctions Routes (`/api/sanctions/`)

```
GET    /api/sanctions                     — List sanctions (filtered, paginated)
POST   /api/sanctions                     — Create sanction (from inspection)
GET    /api/sanctions/{id}                — Sanction detail
PUT    /api/sanctions/{id}                — Edit draft sanction

POST   /api/sanctions/calculate           — Calculate fine (preview, no save)
    Body: { violation_code, structure_id }
    Returns: { base_fine, multiplier, final_amount, legal_basis, recidivism_count }

PATCH  /api/sanctions/{id}/submit         — Submit for approval
PATCH  /api/sanctions/{id}/approve        — Approve sanction (supervisor)
PATCH  /api/sanctions/{id}/certify        — Certify and push to accounting
PATCH  /api/sanctions/{id}/cancel         — Cancel with reason

GET    /api/sanction-rules                — List all sanction rules
POST   /api/sanction-rules                — Create rule (admin)
PUT    /api/sanction-rules/{id}           — Update rule (admin)
```

### 5.4 Oversight Routes (`/api/oversight/`)

```
GET    /api/oversight/dashboard           — Aggregated statistics
    Returns: { total_structures, active_structures, inspections_this_year,
               reports_count, sanctions_count, pending_approvals }

GET    /api/oversight/alerts              — Expiring licenses, overdue inspections, pending reports
GET    /api/oversight/charts/inspections-by-month   — Monthly inspection counts
GET    /api/oversight/charts/structures-by-type     — Structure distribution
GET    /api/oversight/charts/sanctions-trend         — Sanctions over time
GET    /api/oversight/export/{type}       — Export data as XLSX/PDF
```

### 5.5 Interop Routes (`/api/interop/`)

```
POST   /api/interop/aade/lookup           — Lookup business by ΑΦΜ
POST   /api/interop/criminal-record/check — Check criminal record
POST   /api/interop/irida/protocol        — Get next protocol number
POST   /api/interop/accounting/certify    — Push fine certification
GET    /api/interop/log                   — Interop audit log (admin)
```

---

## 6. New Frontend Pages

### 6.1 Module Structure (Feature Folders)

```
frontend/src/
├── features/
│   ├── registry/
│   │   ├── RegistryListPage.jsx          — Structure list with filters
│   │   ├── StructureDetailPage.jsx       — Full structure card
│   │   ├── StructureFormPage.jsx         — Create/edit structure
│   │   ├── CommitteeManagementPage.jsx   — Committee CRUD
│   │   └── components/
│   │       ├── StructureCard.jsx         — Summary card component
│   │       ├── LicenseTimeline.jsx       — License history visual
│   │       ├── AfmLookup.jsx            — ΑΦΜ lookup with auto-fill
│   │       └── StructureFilters.jsx      — Filter bar component
│   ├── inspections/
│   │   ├── InspectionListPage.jsx        — Inspection list
│   │   ├── InspectionFormPage.jsx        — Mobile-first inspection form
│   │   ├── AdvisorReportFormPage.jsx     — Advisor report form
│   │   ├── ReportApprovalPage.jsx        — Supervisor approval view
│   │   └── components/
│   │       ├── DynamicChecklist.jsx       — Renders checklist per facility type
│   │       ├── PhotoCapture.jsx          — Camera integration for mobile
│   │       ├── FindingsEditor.jsx        — Rich text + structured findings
│   │       └── InspectionSummary.jsx     — Pre-filled header from registry
│   ├── sanctions/
│   │   ├── SanctionListPage.jsx          — Sanctions list
│   │   ├── SanctionDetailPage.jsx        — Sanction detail with workflow
│   │   ├── FineCalculatorPage.jsx        — Interactive fine calculator
│   │   └── components/
│   │       ├── SanctionWorkflow.jsx      — Visual status tracker
│   │       ├── FineBreakdown.jsx         — Shows calculation logic
│   │       └── RecidivismHistory.jsx     — Past sanctions for this structure
│   └── oversight/
│       ├── OversightDashboardPage.jsx    — Main dashboard
│       └── components/
│           ├── StatsCards.jsx            — KPI cards (structures, inspections, etc.)
│           ├── AlertsFeed.jsx            — Expiring licenses, overdue items
│           ├── InspectionChart.jsx       — Monthly bar chart (recharts)
│           ├── StructureDistribution.jsx — Pie chart by type
│           └── SanctionsTrend.jsx        — Line chart over time
```

### 6.2 Mobile-First Design Requirements

The inspection and advisor report forms are the most critical mobile pages. Design rules:

- **Viewport:** All forms must work at 375px width (iPhone SE) through 1440px (desktop)
- **Touch targets:** Minimum 44×44px for all interactive elements
- **Layout:** Single-column stacked on mobile, two-column on desktop (≥1024px)
- **Photo upload:** Use `<input type="file" accept="image/*" capture="environment">` for camera access on mobile
- **Auto-save:** Draft forms save to localStorage every 30 seconds (prevent data loss if connection drops)
- **Offline indicator:** Show connection status banner. If offline, queue submission for retry.
- **Font size:** Minimum 16px on form inputs (prevents iOS zoom on focus)

### 6.3 Navigation Integration

Add to the existing navbar (alongside Αρχείο, Forum, Βοηθός):
- **Μητρώο** → `/registry` (RegistryListPage)
- **Έλεγχοι** → `/inspections` (InspectionListPage)
- **Εποπτεία** → `/oversight/dashboard` (OversightDashboardPage)

Visible based on user's `registry_roles`. Admin sees everything.

---

## 7. Key Workflows

### 7.1 Structure Registration (New Facility)

1. Admin clicks "Νέα Δομή" → opens StructureFormPage
2. Enters ΑΦΜ → AfmLookup component calls `/api/interop/aade/lookup` → auto-fills business name, address, legal form
3. Selects structure type from dropdown (StructureType list)
4. Fills remaining fields (capacity, contact info, etc.)
5. Saves → Structure created with status ACTIVE
6. Admin assigns social advisor (dropdown of users with advisor role)
7. Admin assigns to inspection committee (or creates new committee)

### 7.2 Field Inspection (Mobile Flow)

1. Inspector opens `/inspections/{id}/report` on phone
2. InspectionFormPage loads: pre-filled header (structure name, type, address, last inspection)
3. DynamicChecklist renders the checklist for this structure type (from ChecklistTemplate)
4. Inspector goes through items: ✓ compliant, ✗ violation, — not applicable
5. For violations: selects violation category, adds notes, takes photo (PhotoCapture)
6. Writes general findings in FindingsEditor (rich text)
7. Selects overall conclusion: COMPLIANT / MINOR_ISSUES / MAJOR_ISSUES / NON_COMPLIANT
8. Taps "Υποβολή" → report saved with status SUBMITTED
9. System sends Notification to: facility legal representative (findings + required actions) AND supervisor (for approval)
10. Supervisor reviews → APPROVE or RETURN (with comments)

### 7.3 Sanction Workflow

1. During inspection, if violation found → inspector flags it
2. On report submission, system auto-calls `/api/sanctions/calculate` with violation_code + structure_id
3. Calculator: looks up SanctionRule for violation_code, checks recidivism (count past sanctions of same type for this structure), applies escalation multiplier, returns breakdown
4. Inspector reviews calculated fine on screen → confirms or adjusts
5. Sanction created with status DRAFT
6. Inspector submits → status SUBMITTED
7. Supervisor reviews → APPROVED
8. Admin certifies → calls `/api/interop/accounting/certify` → pushes to accounting
9. Status → CERTIFIED, operator notified with payment details

### 7.4 License Expiry Monitoring

Background job (or checked on each dashboard load):
1. Query all structures where `license_expiry_date` is within 90 days
2. Create Notification for: assigned advisor, admin, supervisor
3. Show in OversightDashboard alerts feed
4. Color coding in RegistryList: red if <3 months, orange if <6 months

---

## 8. Seed Data for Demo

The demo needs realistic Greek data:

**Structure Types:** ΜΦΗ (Μονάδα Φροντίδας Ηλικιωμένων), ΚΔΑΠ (Κέντρο Δημιουργικής Απασχόλησης Παιδιών), ΚΔΑΠ-ΜΕΑ (ΚΔΑΠ Μειονεκτούντων Ατόμων), ΣΥΔ (Στέγη Υποστηριζόμενης Διαβίωσης), ΚΔΗΦ-ΚΑΑ (Κέντρο Διημέρευσης & Ημερήσιας Φροντίδας), ΜΦΠΑΔ (Μονάδα Φροντίδας Παιδιών & Αδυνάτων), ΒΣΟΦ (Βρεφονηπιακοί Σταθμοί Ολοκληρωμένης Φροντίδας)

**Structures:** 15-20 dummy facilities across types with realistic Greek names, addresses in Attica region, various license statuses

**Users:** Extend existing seed with new roles:
- 2 social advisors (each assigned to 4-5 structures)
- 4 committee members (in 2 committees)
- 1 admin/secretary
- 1 supervisor/director

**Inspections:** 8-10 past inspections with reports (mix of COMPLIANT and NON_COMPLIANT)

**Sanctions:** 3-4 sanctions (1 PAID, 1 APPROVED, 1 DRAFT, 1 APPEALED)

**Sanction Rules:** At least 10 common violation types with fines (based on real Greek legislation):
- Operating without valid license
- Exceeding capacity
- Inadequate staffing ratios
- Fire safety non-compliance
- Hygiene violations
- Missing documentation
- Failure to report incident
- Unauthorized structural changes
- Non-compliance with accessibility standards
- Failure to comply with prior recommendations

**Checklist Templates:** At least 2 templates (one for ΜΦΗ, one for ΚΔΑΠ) with 15-20 check items each, grouped by category (Κτιριολογικά, Στελέχωση, Υγιεινή, Ασφάλεια, Τεκμηρίωση)

---

## 9. Security & Compliance

### 9.1 Authorization Model

New permission system for registry modules (additive to existing admin/staff/guest):

| Registry Role | See Structures | Create/Edit | Inspect | Report | Approve | Sanction | Dashboard |
|---|---|---|---|---|---|---|---|
| social_advisor | Assigned only | No | No | Submit own | No | No | Own stats |
| committee_member | Committee's | No | Submit | Submit | No | No | Committee stats |
| admin_secretary | All | Yes | No | No | No | No | Full |
| supervisor | All | No | No | No | Yes | Yes (certify) | Full |

Implement as decorators in each module's `permissions.py`:
```python
@require_registry_role('social_advisor', 'supervisor')  # OR logic
@require_structure_access(structure_id)  # checks scope
```

### 9.2 GDPR Considerations

- Structure data includes personal data of legal representatives (name, ΑΦΜ, phone, email)
- All interop lookups logged in InteropLog (lawful basis: official duty)
- Photos from inspections may contain identifiable persons → warning before upload
- Data retention: sanctions history kept indefinitely (legal requirement), inspection reports per retention policy
- Right to erasure: does NOT apply to regulatory compliance data, but does apply to forum/messaging

### 9.3 Audit Trail

Every create/update/delete/approve/certify action in the new modules MUST create an AuditLog entry. The existing AuditLog model is sufficient — just ensure every new route calls it.

---

## 10. AI Integration Points

The existing AI assistant can be enhanced to work within the new modules:

1. **Inline help in inspection forms:** A small "Ρώτησε τον Βοηθό" button next to each checklist category. Clicking it sends a pre-formed question to the AI: "Ποιες είναι οι κτιριολογικές προδιαγραφές για {structure_type};" The answer appears in a side panel without leaving the form.

2. **Fine calculation assistance:** When calculating sanctions, the AI can explain the legal basis: "Βάσει του Ν. ΧΧΧΧ/2020, άρθρο Υ, η παράβαση αυτή επισύρει πρόστιμο..."

3. **Auto-tagging legislation to structure types:** When documents are ingested in the knowledge base, AI can suggest which structure types they're relevant to (e.g., a document about ΚΔΑΠ licensing → tag with structure_type_id for ΚΔΑΠ).

These are Phase 4 features. Don't implement now, but design the component interfaces to accept an `onAskAI` callback prop.

---

## 11. Implementation Phases for Claude Code

### Phase 1 — Foundation (MVP for Demo)
- Task 0: Install Flask-Migrate, create initial migration
- Registry module: models + CRUD routes + RegistryListPage + StructureDetailPage + StructureFormPage
- Basic role extension on User model
- Seed data (structure types, 15 structures, users with roles)
- Navigation integration

### Phase 2 — Inspections & Reports
- Inspection module: models + routes + InspectionFormPage (mobile-first)
- ChecklistTemplate model + DynamicChecklist component
- SocialAdvisorReport form
- Report approval workflow
- Notification on submission

### Phase 3 — Sanctions & Fines
- Sanctions module: models + calculator + routes
- SanctionRule seed data
- Fine calculator UI
- Approval + certification workflow
- Recidivism detection

### Phase 4 — Interoperability (Mock Layer)
- Interop module with mock services
- AfmLookup component wired to mock ΑΑΔΕ
- Protocol number sync mock
- Fine certification push mock
- InteropLog for all calls

### Phase 5 — Oversight Dashboard
- Dashboard aggregation queries
- StatsCards, AlertsFeed, charts (recharts)
- Export functionality (XLSX/PDF)

### Phase 6 — Polish & Demo Readiness
- Mobile viewport testing on all forms
- Photo upload integration
- Realistic demo walkthrough scenario
- Seed data refinement
- Performance optimization (query N+1, pagination)

---

## 12. Constraints & Non-Goals

**Constraints:**
- Zero changes to existing `models.py` and `routes.py` (new modules only)
- All new Blueprints auto-registered in `create_app()`
- All database changes via Flask-Migrate (no `db.create_all()`)
- TDD: write tests first for all backend logic
- Greek UI strings for all user-facing text
- Hellenic Marble design system (warm ivory + navy palette)

**Non-Goals (not in this plan):**
- Real API connections to ΑΑΔΕ, gov.gr, ΙΡΙΔΑ (mock only)
- Offline-first / PWA (design for it, don't build it)
- Multi-tenant (multiple Π.Ε.) — single-tenant for demo
- Email notifications (in-app only for now)
- Self-hosted LLM (stays on OpenAI for demo)
- Calendar/scheduling module (future)

---

*Version: 1.0 — February 2026*
*Author: Dimitris Papadopoulos / Claude Design Session*
*Purpose: Input document for Claude Code to generate phased implementation plan*
