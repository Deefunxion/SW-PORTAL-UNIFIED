# OPS Financial Management Interoperability Specification

## 1. Overview

### What is OPS Oikonomikis Diacheirisis?

The **Ολοκληρωμένο Πληροφοριακό Σύστημα Οικονομικής Διαχείρισης (ΟΠΣ)** is the Greek government's integrated financial management system used by all public entities for revenue tracking, budgetary commitments, and payment management. It interfaces with ΑΑΔΕ (Independent Authority for Public Revenue) for tax collection and TAXIS for taxpayer registry.

### Why Interoperate?

When the Social Welfare Portal (ΠΥΛΗ) imposes a fine (sanction decision), the resulting revenue must be:

1. **Certified** as a revenue obligation (Βεβαίωση Εσόδου) in OPS
2. **Registered** in a Χρηματικός Κατάλογος (ΧΚ — Revenue Register)
3. **Submitted** to ΑΑΔΕ for collection via the obligor's tax account
4. **Tracked** for payment, appeal, or overdue status

Currently this is a **manual process**: the user exports a JSON file from the Portal, then re-enters the data into OPS via the web interface. This specification documents the full workflow and proposes a phased integration path.

---

## 2. Current OPS Workflow (Manual)

Based on the OPS user manual, the manual workflow for creating a Χρηματικός Κατάλογος is:

### Step 1: Login to OPS
- URL: `https://ops.gsis.gr` (government intranet)
- Authentication: TAXISnet credentials (username/password)
- Navigate: Πληρωμές → Χρηματικοί Κατάλογοι → Νέος

### Step 2: Header Fields (Κεφαλίδα)

| OPS Field | Description | Example |
|-----------|-------------|---------|
| Τύπος Καταλόγου | Revenue category code | `64004/04` (fines) |
| Αρ. Απόφασης | Decision number | `ΑΠ-2026/456` |
| Ημ. Απόφασης | Decision date | `2026-02-15` |
| Αρ. Πρωτοκόλλου ΙΡΙΔΑ | IRIDA protocol number | `ΙΡΙΔΑ-2026-789` |
| ΔΟΥ | Tax office | `Α' Αθηνών` |
| Δημ. Διαμέρισμα | Municipal district | `Αγ. Ανάργυροι` |
| Οργ. Μονάδα | Organizational unit | `Τμήμα Κοινωνικής Αλληλεγγύης` |
| Αιτιολογία | Reason text | `1560989001 - Πρόστιμο Ν.5041/2023 Συν.Ποσό 5.000,00€` |

### Step 3: Obligor Details (Υπόχρεος)

| OPS Field | Description | Source in Portal |
|-----------|-------------|------------------|
| Κατηγορία | Obligor category | Always `ΙΔΙΩΤΕΣ` |
| Επωνυμία | Full name | `SanctionDecision.obligor_name` |
| ΑΦΜ | Tax ID | `SanctionDecision.obligor_afm` |
| ΔΟΥ Υπόχρεου | Tax office | `SanctionDecision.obligor_doy` |
| Διεύθυνση | Address | `SanctionDecision.obligor_address` |

### Step 4: Amounts (Ποσά)

Revenue is split between two budget lines per Ν.5041/2023 Άρθρο 100:

| OPS Field | Description | Source |
|-----------|-------------|--------|
| Οφειλόμενο Ποσό (ΑΛΕ) | State budget portion | `SanctionDecision.amount_state` |
| Κωδικός ΑΛΕ | State budget code | `SanctionRule.revenue_split_state_ale` (default: `1560989001`) |
| Αρχικώς Βεβαιωθέν (ΚΑΕ) | Regional budget portion | `SanctionDecision.amount_region` |
| Κωδικός ΚΑΕ | Regional budget code | `SanctionRule.revenue_split_region_kae` (default: `64008`) |

### Step 5: Post-Creation

1. **Βεβαίωση** — Certify the ΧΚ record (changes status to "Certified")
2. **Εκτύπωση PDF** — Print the official document for physical archive
3. **ΙΡΙΔΑ Signatures** — Route through ΙΡΙΔΑ for digital signatures
4. **ΑΑΔΕ Submission** — Send to ΑΑΔΕ for collection (automatic after certification)

---

## 3. Field Mapping: Portal → OPS

### SanctionDecision → ΧΚ Header

| Portal Field | OPS Field | Transform |
|-------------|-----------|-----------|
| — | `catalog_type` | Constant: `64004/04` |
| `protocol_number` | `decision_number` | Direct |
| `approved_at` | `decision_date` | Format: `YYYY-MM-DD` |
| — | `irida_protocol` | From ΙΡΙΔΑ integration (if available) |
| `obligor_doy` | `doy` | Direct |
| — | `organizational_unit` | Constant: `Τμήμα Κοινωνικής Αλληλεγγύης` |
| Composite | `reason` | `"{ALE} - Πρόστιμο Ν.5041/2023 Συν.Ποσό {final_amount}€"` |

### SanctionDecision → ΧΚ Obligor

| Portal Field | OPS Field | Transform |
|-------------|-----------|-----------|
| — | `category` | Constant: `ΙΔΙΩΤΕΣ` |
| `obligor_name` | `name` | Direct |
| `obligor_afm` | `afm` | Direct (9-digit TaxID) |
| `obligor_doy` | `doy` | Direct |
| `obligor_address` | `address` | Direct |

### SanctionDecision → ΧΚ Amounts

| Portal Field | OPS Field | Notes |
|-------------|-----------|-------|
| `amount_state` | `state_budget_amount` | 50% default (configurable per rule) |
| Rule: `revenue_split_state_ale` | `ale_code` | Default: `1560989001` |
| `amount_region` | `region_budget_amount` | 50% default (configurable per rule) |
| Rule: `revenue_split_region_kae` | `kae_code` | Default: `64008` |
| `final_amount` | `total_amount` | = `amount_state` + `amount_region` |

---

## 4. Existing Implementation (Phase 0)

The Portal already has a Phase 0 export endpoint:

```
GET /api/sanction-decisions/{id}/export
```

**Response** (JSON):
```json
{
  "catalog_type": "64004/04",
  "decision_number": "ΑΠ-2026/456",
  "decision_date": "2026-02-15",
  "irida_protocol": "",
  "doy": "Α' Αθηνών",
  "organizational_unit": "Τμήμα Κοινωνικής Αλληλεγγύης",
  "reason": "1560989001 - Πρόστιμο Ν.5041/2023 Συν.Ποσό 5.000,00€",
  "obligor": {
    "category": "ΙΔΙΩΤΕΣ",
    "name": "Παπαδόπουλος Γεώργιος",
    "afm": "034538000",
    "doy": "Α' Αθηνών",
    "address": "Μάχης Κρήτης 11, Αγ. Ανάργυροι 13562"
  },
  "amounts": {
    "state_budget": 2500.0,
    "region_budget": 2500.0,
    "legal_reference": "Ν.5041/2023 αρ.100 §1"
  }
}
```

The user downloads this JSON and manually re-enters the data into OPS. This is the baseline for all future integration phases.

---

## 5. Proposed API Design

### Phase 1: Enhanced Export (Current + Improvements)

Enhance the existing export endpoint:

```
GET /api/ops/export-xk/{decision_id}
```

Improvements over current:
- Add XML output format option (`?format=xml`) for OPS import compatibility
- Add CSV format for bulk export (`GET /api/ops/export-xk/bulk?status=approved`)
- Include ΙΡΙΔΑ protocol number when available
- Add validation: require `approved` status before export
- Track export timestamp on the decision record

**New model fields on SanctionDecision:**
```python
ops_exported_at = db.Column(db.DateTime, nullable=True)
ops_xk_number = db.Column(db.String(50), nullable=True)  # ΧΚ number from OPS
ops_atb = db.Column(db.String(50), nullable=True)         # ΑΤΒ from ΑΑΔΕ
```

### Phase 2: Status Synchronization

```
POST /api/ops/sync-status/{decision_id}
```

Manual or periodic sync to update decision status based on OPS/ΑΑΔΕ:

**Request:**
```json
{
  "xk_number": "ΧΚ-2026-001234",
  "atb": "ΑΤΒ-2026-567890",
  "status": "certified",
  "payment_status": "pending"
}
```

```
GET /api/ops/status/{decision_id}
```

Returns the current OPS tracking data for a decision.

**Polling endpoint (if OPS provides webhook or API):**
```
POST /api/ops/webhook/payment-update
```

Called by OPS when payment status changes. Updates decision status to `paid`, `overdue`, or `appealed`.

### Phase 3: Full Bidirectional Integration

```
POST /api/ops/create-xk/{decision_id}
```

Directly creates a ΧΚ record in OPS via their API (if available). Returns the ΧΚ number.

```
GET /api/ops/inbox
```

Polls OPS for payment confirmations and updates decision statuses automatically.

---

## 6. Data Model Extensions

New columns on `sanction_decisions` table for OPS tracking:

| Column | Type | Purpose |
|--------|------|---------|
| `ops_exported_at` | DateTime | When the ΧΚ data was exported |
| `ops_xk_number` | VARCHAR(50) | Χρηματικός Κατάλογος number in OPS |
| `ops_atb` | VARCHAR(50) | ΑΤΒ (Ατομικό Ταμειακό Βιβλιάριο) from ΑΑΔΕ |
| `ops_certified_at` | DateTime | When the ΧΚ was certified in OPS |
| `aade_submitted_at` | DateTime | When submitted to ΑΑΔΕ for collection |
| `aade_confirmation` | VARCHAR(100) | ΑΑΔΕ confirmation reference |

Auto-migration entries for `create_app()`:
```python
('sanction_decisions', 'ops_exported_at', 'TIMESTAMP'),
('sanction_decisions', 'ops_xk_number', 'VARCHAR(50)'),
('sanction_decisions', 'ops_atb', 'VARCHAR(50)'),
('sanction_decisions', 'ops_certified_at', 'TIMESTAMP'),
('sanction_decisions', 'aade_submitted_at', 'TIMESTAMP'),
('sanction_decisions', 'aade_confirmation', 'VARCHAR(100)'),
```

---

## 7. Integration Options

### Option A: Direct REST API (Preferred)

If OPS exposes a REST or SOAP API:
- Authenticate via OAuth2 or certificate-based mutual TLS
- POST ΧΚ data directly
- Receive ΧΚ number synchronously
- Poll for status updates or receive webhooks

**Pros:** Real-time, no manual steps, full audit trail
**Cons:** Requires OPS API access (may need ΓΓΠΣΔΔ approval)

### Option B: File-Based Exchange

Export structured files (XML/CSV) that OPS can bulk-import:
- Generate XML per OPS import schema
- Upload via OPS batch import interface
- Parse OPS export files for status updates

**Pros:** No API dependency, works with current OPS
**Cons:** Manual upload step, delayed status sync

### Option C: Hybrid (Recommended for Phase 1)

1. Enhanced JSON/XML export from Portal (automated generation)
2. Manual upload to OPS (user copies file or uses clipboard)
3. Manual status entry back into Portal (user enters ΧΚ number)
4. Future: automated via API when OPS provides access

**Pros:** Minimal dependencies, immediate value, upgrade path
**Cons:** Still has manual steps

### Option D: RDP Automation (Last Resort)

Automate the OPS web interface via browser automation:
- Selenium/Playwright script fills OPS forms
- Reads confirmation screens for ΧΚ numbers

**Pros:** Works without API access
**Cons:** Fragile, breaks on UI changes, security concerns, not recommended

---

## 8. Security & Authentication

### Between Portal and OPS

| Concern | Approach |
|---------|----------|
| Transport | TLS 1.3 (HTTPS) mandatory |
| Auth | OAuth2 client credentials or mutual TLS certificates |
| Authorization | Service account with ΧΚ creation permissions only |
| Data sensitivity | ΑΦΜ and financial data — encrypt at rest |
| Audit | Log all API calls with request/response hashes |
| Rate limiting | Max 100 requests/minute to OPS |

### Between Portal and ΑΑΔΕ

ΑΑΔΕ integration is handled by OPS — the Portal does not communicate directly with ΑΑΔΕ. OPS submits certified ΧΚ records to ΑΑΔΕ automatically.

### Credential Management

- Store OPS credentials in environment variables (`OPS_CLIENT_ID`, `OPS_CLIENT_SECRET`)
- Never log or expose credentials in API responses
- Rotate credentials quarterly
- Use separate credentials for development/staging/production

---

## 9. Phased Rollout

### Phase 1 — Enhanced Export (Current Sprint)
**Status: Partially implemented**

- [x] JSON export endpoint (`GET /api/sanction-decisions/{id}/export`)
- [x] Frontend export button with confirmation dialog
- [ ] Add XML format option
- [ ] Add bulk export endpoint
- [ ] Track export timestamp on decision record
- [ ] Add ΧΚ number manual entry field on decision detail page

**Effort:** 2-3 days
**Dependencies:** None

### Phase 2 — Status Synchronization (Next Quarter)

- [ ] Add OPS tracking columns to SanctionDecision model
- [ ] Manual status sync endpoint
- [ ] UI for entering ΧΚ number and tracking status
- [ ] Dashboard widget showing pending OPS submissions
- [ ] Notification when payment deadline approaching

**Effort:** 1-2 weeks
**Dependencies:** Phase 1 complete, OPS field mapping validated

### Phase 3 — Direct API Integration (When OPS API Available)

- [ ] Implement OPS API client (`backend/my_project/integrations/ops_client.py`)
- [ ] Auto-create ΧΚ on decision approval
- [ ] Webhook receiver for payment updates
- [ ] Full status lifecycle sync
- [ ] Error handling and retry logic

**Effort:** 2-4 weeks
**Dependencies:** OPS REST API access, ΓΓΠΣΔΔ approval, test environment

### Phase 4 — Full Automation (Future)

- [ ] Auto-submit to ΑΑΔΕ via OPS
- [ ] Payment reconciliation
- [ ] Overdue detection and escalation
- [ ] Reporting and analytics

**Effort:** 4-6 weeks
**Dependencies:** Phase 3 stable, ΑΑΔΕ integration tested

---

## 10. Decision Status Lifecycle with OPS

```
Portal                          OPS                         ΑΑΔΕ
──────                          ───                         ────
draft
  ↓
submitted
  ↓
approved ──── export JSON ────→ create ΧΚ
  ↓                               ↓
exported                        certify ΧΚ ──────────────→ register
  ↓                               ↓                          ↓
notified                        certified                  collection
  ↓                               ↓                          ↓
  ├── paid ←───────────────── payment received ←──────── taxpayer pays
  ├── appealed                    ↓
  ├── overdue                   closed
  └── cancelled
```

---

## 11. Error Handling

| Scenario | Portal Action | User Notification |
|----------|---------------|-------------------|
| OPS API unavailable | Queue export, retry later | "Εξαγωγή σε αναμονή" |
| Invalid ΑΦΜ | Block export, show validation | "Μη έγκυρο ΑΦΜ υπόχρεου" |
| Duplicate ΧΚ | Skip creation, link existing | "Η βεβαίωση υπάρχει ήδη: ΧΚ-XXX" |
| Amount mismatch | Log warning, allow override | "Απόκλιση ποσού — επαλήθευση" |
| OPS timeout | Retry 3x with exponential backoff | "Αποτυχία σύνδεσης — νέα προσπάθεια" |
| Payment webhook failure | Retry + manual status entry | "Αυτόματη ενημέρωση αποτυχία" |

---

## Appendix A: OPS XML Schema (Proposed)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ChrimatikosKatalogos>
  <Header>
    <CatalogType>64004/04</CatalogType>
    <DecisionNumber>ΑΠ-2026/456</DecisionNumber>
    <DecisionDate>2026-02-15</DecisionDate>
    <IridaProtocol></IridaProtocol>
    <DOY>Α' Αθηνών</DOY>
    <OrgUnit>Τμήμα Κοινωνικής Αλληλεγγύης</OrgUnit>
    <Reason>1560989001 - Πρόστιμο Ν.5041/2023 Συν.Ποσό 5.000,00€</Reason>
  </Header>
  <Obligor>
    <Category>ΙΔΙΩΤΕΣ</Category>
    <Name>Παπαδόπουλος Γεώργιος</Name>
    <AFM>034538000</AFM>
    <DOY>Α' Αθηνών</DOY>
    <Address>Μάχης Κρήτης 11, Αγ. Ανάργυροι 13562</Address>
  </Obligor>
  <Amounts>
    <StateBudget>
      <ALE>1560989001</ALE>
      <Amount>2500.00</Amount>
    </StateBudget>
    <RegionBudget>
      <KAE>64008</KAE>
      <Amount>2500.00</Amount>
    </RegionBudget>
    <TotalAmount>5000.00</TotalAmount>
    <LegalReference>Ν.5041/2023 αρ.100 §1</LegalReference>
  </Amounts>
</ChrimatikosKatalogos>
```

## Appendix B: Environment Variables

```bash
# OPS Integration (Phase 3)
OPS_BASE_URL=https://ops.gsis.gr/api/v1
OPS_CLIENT_ID=portal-social-welfare
OPS_CLIENT_SECRET=<secret>
OPS_TIMEOUT=30  # seconds
OPS_RETRY_MAX=3

# ΑΑΔΕ (via OPS, no direct integration)
# No additional env vars needed — ΑΑΔΕ communication is handled by OPS
```

## Appendix C: References

- **Ν.5041/2023 Άρθρο 100** — Legal basis for sanctions and fines
- **Existing export endpoint:** `backend/my_project/sanctions/routes.py:371-411`
- **SanctionDecision model:** `backend/my_project/sanctions/models.py:60-153`
- **SanctionRule model:** `backend/my_project/sanctions/models.py:5-57`
- **Frontend export dialog:** `frontend/src/features/registry/pages/SanctionsPage.jsx` (OPS Export AlertDialog)
- **ΙΡΙΔΑ client:** `backend/my_project/integrations/irida_client.py` (reference pattern for OPS client)
