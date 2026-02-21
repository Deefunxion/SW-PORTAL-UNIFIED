# IRIDA Integration Design — Phase 1

**Date:** 2026-02-20
**Status:** Approved
**Scope:** Social Advisor submits report to IRIDA from the Portal

---

## Context

The Portal (Πύλη Κοινωνικής Μέριμνας) produces documents that need to be filed in IRIDA (the government's electronic document management system — ΣΗΔΕ). Today this is done manually: the Social Advisor writes the report in the Portal, then separately logs into IRIDA and re-submits it.

The IRIDA External API v2.2 is now connected (demo mode verified 2026-02-20). This design covers integrating the two systems so the Advisor can submit directly from the Portal.

## Real-World Workflow

1. Social Advisor (Κ.Σ.) visits a structure for inspection
2. Fills out the Advisor Report (Αναφορά Κ.Σ.) in the Portal
3. Submits the report (status: `submitted`)
4. Presses "Κατάθεση σε ΙΡΙΔΑ" — sends via IRIDA API using their **own** IRIDA credentials
5. IRIDA receives it as an **Υπηρεσιακό Σημείωμα** (service memo — IRIDA has no "Πρακτικό" document type)
6. Recipient: Δ/νση Δημόσιας Υγείας & Κοινωνικής Μέριμνας of the relevant Regional Unit (Π.Ε.)
7. IRIDA assigns a protocol number (Αρ. Πρωτ.) — the Portal records it
8. Later (Phase 2): the administration may notify the inspected structure

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who sends? | Each user with their own IRIDA credentials | Personal accountability, matches current workflow |
| Credential storage | Encrypted in user profile (Fernet) | Enter once, reuse. Encrypted at rest. |
| Recipient selection | Hybrid — auto-suggested based on document type, user can change | Balance between convenience and flexibility |
| Send trigger | Manual button after approval | User retains control, can review before sending |
| Tracking | Inline on each document + central page (Phase 2) | Immediate visibility without leaving context |
| Incoming documents | Fetch + store in Portal (Phase 2) | Full round-trip, but not in Phase 1 scope |

## Phase 1 Scope

**In scope:**
- IRIDA credentials in user profile (encrypted storage, test connection)
- "Κατάθεση σε ΙΡΙΔΑ" button on Advisor Reports
- PDF/DOCX generation for the report
- Send via IRIDA API as Υπηρεσιακό Σημείωμα
- Record the transaction and protocol number
- Inline status display on the report

**Out of scope (Phase 2+):**
- Central IRIDA transactions page
- Incoming document handling
- Sending other document types (sanctions, licenses, inspections)
- Notification to inspected structure

---

## Data Model Changes

### 1. User model — new fields

```python
# Encrypted IRIDA credentials (nullable — not all users need IRIDA)
irida_username        = db.Column(db.Text, nullable=True)    # encrypted
irida_password        = db.Column(db.Text, nullable=True)    # encrypted
irida_x_profile       = db.Column(db.String(50), nullable=True)  # auto-fetched or manual
irida_base_url        = db.Column(db.String(200), nullable=True)  # override per-user if needed
```

Encryption: `cryptography.fernet.Fernet` with `IRIDA_ENCRYPTION_KEY` from `.env` (auto-generated on first run if missing). Decrypt only at send time, never exposed to frontend.

### 2. New model — IridaTransaction

```python
class IridaTransaction(db.Model):
    __tablename__ = 'irida_transactions'

    id              = db.Column(db.Integer, primary_key=True)
    created_at      = db.Column(db.DateTime, default=datetime.utcnow)

    # Direction & status
    direction       = db.Column(db.String(10))   # 'outbound' | 'inbound'
    status          = db.Column(db.String(20))   # 'pending' | 'sent' | 'failed'

    # Link to source record (polymorphic)
    source_type     = db.Column(db.String(50))   # 'advisor_report', 'sanction_decision', etc.
    source_id       = db.Column(db.Integer)

    # IRIDA response
    irida_reg_no      = db.Column(db.String(50))   # protocol number from IRIDA
    irida_document_id = db.Column(db.String(100))  # IRIDA document ID

    # What was sent
    recipients_json = db.Column(db.Text)           # JSON: list of recipient IDs/names
    subject         = db.Column(db.String(500))
    sender          = db.Column(db.String(200))

    # Who sent it
    sent_by_id      = db.Column(db.Integer, db.ForeignKey('users.id'))
    sent_by         = db.relationship('User', backref='irida_transactions')

    # Error handling
    error_message   = db.Column(db.Text, nullable=True)

    # Inbound: stored file
    file_path       = db.Column(db.String(500), nullable=True)
```

### 3. No changes to SocialAdvisorReport

The existing model stays as-is. Link is via `IridaTransaction(source_type='advisor_report', source_id=report.id)`.

---

## Backend Changes

### 1. Encryption utilities

New file: `backend/my_project/integrations/irida_crypto.py`

```python
def encrypt_credential(plaintext: str) -> str
def decrypt_credential(ciphertext: str) -> str
```

Uses `Fernet` with `IRIDA_ENCRYPTION_KEY` env var. Key is 32 bytes, base64-encoded.

### 2. Per-user IRIDA authentication

Modify `irida_client.py` to support per-user auth:

```python
def authenticate_user(username, password, base_url=None) -> str:
    """Authenticate a specific user, return token. No caching."""

def send_document_as_user(token, x_profile, base_url, subject,
                          registration_number, sender, recipients, files):
    """Send using a specific user's token (not global config)."""
```

Global `.env` credentials remain as fallback for demo mode and service account use cases.

### 3. New routes — User IRIDA profile

```
GET    /api/profile/irida          → { configured, username (masked) }
POST   /api/profile/irida          → saves encrypted credentials
POST   /api/profile/irida/test     → tests connection, returns profiles
DELETE /api/profile/irida          → removes credentials
```

### 4. New route — Send advisor report to IRIDA

```
POST /api/advisor-reports/<id>/send-to-irida
Body: {
  "recipients": ["5a3762934e1e8b1bb0859a68"],
  "subject": "Αναφορά ελέγχου δομής «Παιδότοπος Ηλιαχτίδα»"  // optional override
}
```

Steps:
1. Verify report exists and status is `submitted`
2. Decrypt user's IRIDA credentials
3. Authenticate to IRIDA with user's credentials
4. Generate PDF from the advisor report
5. Send as Υπηρεσιακό Σημείωμα to recipients
6. Create `IridaTransaction(direction='outbound', status='sent', irida_reg_no=...)`
7. Return transaction with protocol number

### 5. Lookup routes (already exist)

```
GET /api/irida/roots       → list of IRIDA organisations
GET /api/irida/positions   → internal recipients
GET /api/irida/profiles    → user's IRIDA profiles
```

These will be modified to optionally use the logged-in user's credentials instead of the global ones.

---

## Frontend Changes

### 1. ProfilePage.jsx — "Σύνδεση ΙΡΙΔΑ" section

New card in the existing profile page:

```
┌─ Σύνδεση ΙΡΙΔΑ ──────────────────────────────────┐
│  Username ΙΡΙΔΑ:  [________________________]      │
│  Password ΙΡΙΔΑ:  [________________________]      │
│                                                   │
│  [Δοκιμή σύνδεσης]          [Αποθήκευση]         │
│                                                   │
│  ✓ Συνδέθηκε επιτυχώς                            │
│  Προφίλ: ΥΠΟΥΡΓΕΙΟ ΥΠΟΔΟΜΩΝ / Κ. Γραμματεία     │
└───────────────────────────────────────────────────┘
```

- "Δοκιμή σύνδεσης" calls `POST /api/profile/irida/test`
- "Αποθήκευση" calls `POST /api/profile/irida`
- Shows success/error feedback
- Password field never shows stored value, only placeholder

### 2. AdvisorReportPage.jsx — "Κατάθεση σε ΙΡΙΔΑ" section

Appears only when report status is `submitted` (or `approved`):

**Before send:**
```
┌─ Κατάθεση σε ΙΡΙΔΑ ──────────────────────────────┐
│  Αποδέκτης: [Δ/νση ΔΥ&ΚΜ Π.Ε. Ανατ. Αττ. ▾]   │
│  Θέμα: Αναφορά ελέγχου δομής «Παιδότοπος         │
│         Ηλιαχτίδα»                                │
│  Τύπος: Υπηρεσιακό Σημείωμα                      │
│                                                   │
│              [Αποστολή σε ΙΡΙΔΑ]                  │
└───────────────────────────────────────────────────┘
```

- Recipient dropdown populated from `GET /api/irida/roots`
- Default recipient pre-selected based on structure's regional unit
- Subject auto-generated from report + structure name
- If user has no IRIDA credentials, shows "Ρυθμίστε τη σύνδεση ΙΡΙΔΑ στο προφίλ σας" with link

**After send:**
```
  ✓ Κατατέθηκε στο ΙΡΙΔΑ | Αρ.Πρωτ: 52/2026 | 20/02/2026 14:30
```

- Green badge, non-editable
- Protocol number stored and visible

---

## Security Considerations

1. **Credential encryption:** Fernet symmetric encryption. Key in `.env`, never in code or DB.
2. **No credential exposure:** Frontend never receives the stored password. Only `configured: true/false` and masked username.
3. **Per-request auth:** Each IRIDA call uses the user's own token. No shared sessions between users.
4. **Audit trail:** Every send creates an `IridaTransaction` record with `sent_by_id`.
5. **Demo mode:** When `IRIDA_DEMO=true`, all users use demo endpoints regardless of stored credentials (for testing/presentation).

---

## Implementation Order

1. **Encryption utilities** + `IRIDA_ENCRYPTION_KEY` in `.env`
2. **User model** — add encrypted credential fields
3. **IridaTransaction model** — new table
4. **irida_client.py** — per-user auth functions
5. **Profile IRIDA routes** — save/test/delete credentials
6. **Send advisor report route** — the core flow
7. **Frontend: ProfilePage** — IRIDA credentials section
8. **Frontend: AdvisorReportPage** — send button + inline status
9. **Testing** with demo mode

---

## Phase 2 (Future)

- Central `/irida` page with all transactions history
- Incoming document handling (fetch + store)
- Send sanctions decisions, inspection reports, licenses
- Notification to inspected structures
- Automatic recipient mapping based on structure → regional unit → IRIDA org
