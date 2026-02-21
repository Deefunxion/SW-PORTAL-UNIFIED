# Attica Structures Import Script — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Import 1,671 real social welfare structures from the Περιφέρεια Αττικής Excel dataset into the portal's registry, enriching MKO entries with AFM data from the EKKA certified organizations CSV.

**Architecture:** A standalone CLI script reads two data sources — the mapAttica Excel (structures with addresses/contacts) and the EKKA CSV (certified NGOs with AFM) — maps them to the existing `Structure` model, creates any missing `StructureType` records, and batch-inserts into PostgreSQL. Supports `--dry-run` for preview and is idempotent (skips existing codes).

**Tech Stack:** Python, openpyxl (already in requirements.txt), csv stdlib, Flask app context, SQLAlchemy

---

## Data Sources

**Excel** (`mapAttica-Αποτελέσματα Αναζήτησης.xlsx`): 1,671 rows, 13 columns
```
# | Τύπος Δομής | Ονομασία | Φορέας | Χαρακτήρας | Δυναμικότητα | Άδεια | Διεύθυνση | e-mail | site | Τηλέφωνα | Δήμος | Ενότητα
```

**EKKA CSV** (`Πίνακας.csv`): 190 rows, 10 columns
```
ΑΦΜ | Επωνυμία | Διακριτικός Τίτλος | Νομική Μορφή | ΦΕΚ | ΦΕΚ Ανανέωσης | Διάρκεια Πιστοποίησης Έως | Ηλικιακή Ομάδα | Υπηρεσίες | Δομές
```

## Field Mapping

| Excel Column | → Structure Field | Notes |
|---|---|---|
| `Ονομασία` | `name` | Direct |
| `Τύπος Δομής` | `type_id` | Via TYPE_MAP lookup → StructureType.code |
| `Διεύθυνση` | `street`, `postal_code` | Regex parse: `r'\b(\d{3})\s?(\d{2})\b'` for postal code, rest → street |
| `Δήμος` | `city` | Direct |
| `Ενότητα` | `peripheral_unit` | Direct |
| `e-mail` | `representative_email` | Direct |
| `Τηλέφωνα` | `representative_phone` | Cast to str (some are int in Excel) |
| `site` | `notes` | Stored as `"Website: {url}"` |
| `Φορέας` | `representative_name` | Only 148 MKO rows have this |
| `Δυναμικότητα` | `capacity` | Only 148 MKO rows |
| `Άδεια` | `license_number` | Skip if value is `;;` |
| _(generated)_ | `code` | Pattern: `{TYPE}-{PE}-{SEQ:04d}` |
| _(inferred)_ | `ownership` | municipal/ngo/private based on type & name |
| _(default)_ | `status` | `'active'` |

## Type Mapping

```python
TYPE_MAP = {
    'Μονάδες Φροντίδας Προσχολικής Αγωγής και Διαπαιδαγώγησης': 'MFPAD',  # existing
    'Μονάδα Φροντίδας Ηλικιωμένων': 'MFH',                                 # existing
    'Κέντρο Δημιουργικής Απασχόλησης Παιδιών': 'KDAP',                     # existing
    'Στέγη Υποστηριζόμενης Διαβίωσης': 'SYD',                              # existing
    'Κέντρα Αποθεραπείας-Αποκατάστασης (Κ.Α.Α.-ΚΔΗΦ)': 'KDHF-KAA',       # existing
    'Δημοτικός Σταθμός': 'DS',                                              # NEW (461 rows)
    'Κέντρο Δημιουργικής Απασχόλησης Παιδιών και Ατόμων με Αναπηρία': 'KDAP-AMEA',  # NEW (28)
    'Κέντρο Ημερήσιας Φροντίδας Ηλικιωμένων': 'KHFH',                     # NEW (9)
    'Πιστοποιημένος φορέας ΜΚΟ': 'MKO',                                    # NEW (148)
}
```

## PE Abbreviation Mapping

```python
PE_MAP = {
    'ΚΕΝΤΡΙΚΟΣ ΤΟΜΕΑΣ': 'KT',
    'ΒΟΡΕΙΟΣ ΤΟΜΕΑΣ': 'BT',
    'ΝΟΤΙΟΣ ΤΟΜΕΑΣ': 'NT',
    'ΑΝΑΤΟΛΙΚΗΣ ΑΤΤΙΚΗΣ': 'AA',
    'ΠΕΙΡΑΙΩΣ ΚΑΙ ΝΗΣΩΝ': 'PN',
    'ΔΥΤΙΚΟΣ ΤΟΜΕΑΣ': 'DT',
    'ΔΥΤΙΚΗ ΑΤΤΙΚΗ': 'DA',
}
```

---

### Task 1: Script skeleton with CLI args and app context

**Files:**
- Create: `backend/scripts/import_attica_structures.py`

**Step 1: Create script with argparse, Flask app context, and Windows UTF-8 fix**

```python
#!/usr/bin/env python
"""
Import Attica region social welfare structures from Excel + EKKA data.

Sources:
  - mapAttica-Αποτελέσματα Αναζήτησης.xlsx (1,671 structures from Περιφέρεια Αττικής)
  - Πίνακας.csv (190 EKKA-certified NGO operators with AFM)

Usage:
    python scripts/import_attica_structures.py                    # Full import
    python scripts/import_attica_structures.py --dry-run          # Preview only
    python scripts/import_attica_structures.py --clear-existing   # Clear Attica imports first
"""
import argparse
import csv
import os
import re
import sys
from collections import Counter

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from openpyxl import load_workbook

from my_project import create_app
from my_project.extensions import db
from my_project.registry.models import Structure, StructureType


# --- Constants ---

TYPE_MAP = {
    'Μονάδες Φροντίδας Προσχολικής Αγωγής και Διαπαιδαγώγησης': 'MFPAD',
    'Μονάδα Φροντίδας Ηλικιωμένων': 'MFH',
    'Κέντρο Δημιουργικής Απασχόλησης Παιδιών': 'KDAP',
    'Στέγη Υποστηριζόμενης Διαβίωσης': 'SYD',
    'Κέντρα Αποθεραπείας-Αποκατάστασης (Κ.Α.Α.-ΚΔΗΦ)': 'KDHF-KAA',
    'Δημοτικός Σταθμός': 'DS',
    'Κέντρο Δημιουργικής Απασχόλησης Παιδιών και Ατόμων με Αναπηρία': 'KDAP-AMEA',
    'Κέντρο Ημερήσιας Φροντίδας Ηλικιωμένων': 'KHFH',
    'Πιστοποιημένος φορέας ΜΚΟ': 'MKO',
}

NEW_TYPES = {
    'DS': ('DS', 'Δημοτικός Παιδικός Σταθμός', 'Δημοτικοί βρεφονηπιακοί και παιδικοί σταθμοί'),
    'KDAP-AMEA': ('KDAP-AMEA', 'ΚΔΑΠ Ατόμων με Αναπηρία', 'Κέντρα Δημιουργικής Απασχόλησης Παιδιών και Ατόμων με Αναπηρία'),
    'KHFH': ('KHFH', 'Κέντρο Ημερήσιας Φροντίδας Ηλικιωμένων', 'Κέντρα ημερήσιας φροντίδας και απασχόλησης ηλικιωμένων'),
    'MKO': ('MKO', 'Πιστοποιημένος Φορέας ΜΚΟ', 'Πιστοποιημένοι φορείς παροχής κοινωνικής φροντίδας (Μη Κερδοσκοπικοί)'),
}

PE_MAP = {
    'ΚΕΝΤΡΙΚΟΣ ΤΟΜΕΑΣ': 'KT',
    'ΒΟΡΕΙΟΣ ΤΟΜΕΑΣ': 'BT',
    'ΝΟΤΙΟΣ ΤΟΜΕΑΣ': 'NT',
    'ΑΝΑΤΟΛΙΚΗΣ ΑΤΤΙΚΗΣ': 'AA',
    'ΠΕΙΡΑΙΩΣ ΚΑΙ ΝΗΣΩΝ': 'PN',
    'ΔΥΤΙΚΟΣ ΤΟΜΕΑΣ': 'DT',
    'ΔΥΤΙΚΗ ΑΤΤΙΚΗ': 'DA',
}


def parse_args():
    parser = argparse.ArgumentParser(description='Import Attica structures from Excel + EKKA data')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing to DB')
    parser.add_argument('--clear-existing', action='store_true', help='Delete previously imported Attica structures first')
    parser.add_argument('--excel', default=None, help='Path to Excel file (default: auto-detect in project root)')
    parser.add_argument('--ekka', default=None, help='Path to EKKA CSV file (default: auto-detect in project root)')
    return parser.parse_args()


def main():
    args = parse_args()
    app = create_app()

    with app.app_context():
        print("Import Attica Structures")
        print("=" * 50)
        if args.dry_run:
            print("DRY RUN — no changes will be made\n")
        # TODO: implement import logic

    print("\nDone.")


if __name__ == '__main__':
    main()
```

**Step 2: Verify script runs**

Run: `cd backend && python scripts/import_attica_structures.py --dry-run`
Expected: Prints header, "DRY RUN", "Done."

**Step 3: Commit**

```bash
git add backend/scripts/import_attica_structures.py
git commit -m "feat: scaffold Attica structures import script"
```

---

### Task 2: Ensure structure types + load EKKA lookup

**Files:**
- Modify: `backend/scripts/import_attica_structures.py`

**Step 1: Add `ensure_types()` function**

Creates the 4 new StructureType records (DS, KDAP-AMEA, KHFH, MKO) if they don't already exist. Returns a `{code: StructureType}` dict of all types.

```python
def ensure_types(dry_run=False):
    """Ensure all required structure types exist, create missing ones."""
    existing = {st.code: st for st in StructureType.query.all()}
    created = []

    for code, (_, name, desc) in NEW_TYPES.items():
        if code not in existing:
            if dry_run:
                print(f"  [DRY] Would create type: {code} — {name}")
            else:
                st = StructureType(code=code, name=name, description=desc)
                db.session.add(st)
                created.append(code)

    if created and not dry_run:
        db.session.flush()
        existing = {st.code: st for st in StructureType.query.all()}
        print(f"  Created {len(created)} new structure types: {', '.join(created)}")
    elif not created:
        print(f"  All structure types already exist ({len(existing)} total)")

    return existing
```

**Step 2: Add `load_ekka_data()` function**

Reads the EKKA CSV and builds a lookup dict mapping normalized organization name → AFM.

```python
def _normalize(name):
    """Normalize Greek org name for fuzzy matching."""
    if not name:
        return ''
    name = name.upper().strip()
    # Remove quotes, extra whitespace
    name = re.sub(r'[«»""\'\"]+', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name


def load_ekka_data(csv_path):
    """Load EKKA certified orgs CSV → dict of normalized_name → {afm, legal_form, cert_expiry}."""
    ekka = {}
    if not os.path.exists(csv_path):
        print(f"  Warning: EKKA CSV not found at {csv_path}, skipping enrichment")
        return ekka

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            afm = row.get('ΑΦΜ', '').strip()
            name = row.get('Επωνυμία', '').strip()
            title = row.get('Διακριτικός Τίτλος', '').strip()
            legal_form = row.get('Νομική Μορφή', '').strip()
            cert_expiry = row.get('Διάρκεια Πιστοποίησης Έως', '').strip()

            if not afm or not name:
                continue

            entry = {'afm': afm, 'legal_form': legal_form, 'cert_expiry': cert_expiry}
            ekka[_normalize(name)] = entry
            if title and title != '-':
                ekka[_normalize(title)] = entry

    print(f"  Loaded {len(ekka)} EKKA lookup entries from {os.path.basename(csv_path)}")
    return ekka
```

**Step 3: Wire into main()**

```python
def main():
    args = parse_args()
    app = create_app()

    with app.app_context():
        print("Import Attica Structures")
        print("=" * 50)
        if args.dry_run:
            print("DRY RUN — no changes will be made\n")

        # Resolve file paths
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        excel_path = args.excel or os.path.join(project_root, 'mapAttica-Αποτελέσματα Αναζήτησης.xlsx')
        ekka_path = args.ekka or os.path.join(project_root, 'Πίνακας.csv')

        # Step 1: Ensure structure types
        print("\n[1/4] Structure Types")
        types = ensure_types(dry_run=args.dry_run)

        # Step 2: Load EKKA data
        print("\n[2/4] EKKA Data")
        ekka = load_ekka_data(ekka_path)

        # Step 3: Parse and import Excel
        # TODO: next task

    print("\nDone.")
```

**Step 4: Test**

Run: `cd backend && python scripts/import_attica_structures.py --dry-run`
Expected: Shows "[1/4] Structure Types" with 4 types that would be created, "[2/4] EKKA Data" with ~190+ lookup entries loaded.

**Step 5: Commit**

```bash
git add backend/scripts/import_attica_structures.py
git commit -m "feat: add structure type creation and EKKA data loading"
```

---

### Task 3: Address parsing and ownership inference helpers

**Files:**
- Modify: `backend/scripts/import_attica_structures.py`

**Step 1: Add `parse_address()` function**

```python
def parse_address(raw_address):
    """Parse combined Greek address into (street, postal_code) tuple.

    Examples:
        'ΜΕΣΟΓΕΙΩΝ 500 & ΕΥΚΑΛΥΠΤΩΝ 2, 15342,ΑΓ. ΠΑΡΑΣΚΕΥΗ' → ('ΜΕΣΟΓΕΙΩΝ 500 & ΕΥΚΑΛΥΠΤΩΝ 2', '15342')
        'ΣΟΥΛΙΟΥ 42Β, 15343, ΑΓ. ΠΑΡΑΣΚΕΥΗ' → ('ΣΟΥΛΙΟΥ 42Β', '15343')
        'Λ. ΜΕΣΟΓΕΙΩΝ 583, 153 43 ΣΤΑΥΡΟΣ' → ('Λ. ΜΕΣΟΓΕΙΩΝ 583', '15343')
    """
    if not raw_address:
        return None, None

    # Extract 5-digit postal code (may have space: "153 43")
    postal_match = re.search(r'\b(\d{3})\s?(\d{2})\b', raw_address)
    postal_code = None
    if postal_match:
        postal_code = postal_match.group(1) + postal_match.group(2)

    # Street is everything before the first comma (or before postal code)
    parts = [p.strip() for p in raw_address.split(',')]
    street = parts[0] if parts else raw_address

    return street, postal_code


def infer_ownership(type_name, structure_name):
    """Infer ownership type from structure type and name."""
    if type_name == 'Δημοτικός Σταθμός':
        return 'municipal'
    if type_name == 'Πιστοποιημένος φορέας ΜΚΟ':
        return 'ngo'

    name_upper = (structure_name or '').upper()
    if 'ΔΗΜΟΣ' in name_upper or 'ΔΗΜΟΤΙΚ' in name_upper or 'ΔΗΜΟΥ' in name_upper:
        return 'municipal'

    return 'private'
```

**Step 2: Verify with a quick mental check (no separate test needed for a script)**

The regex `r'\b(\d{3})\s?(\d{2})\b'` matches:
- `15342` → `('153', '42')` → `'15342'`
- `153 43` → `('153', '43')` → `'15343'`
- `ΤΚ 17235` → `('172', '35')` → `'17235'`

**Step 3: Commit**

```bash
git add backend/scripts/import_attica_structures.py
git commit -m "feat: add address parsing and ownership inference"
```

---

### Task 4: Excel parsing and structure creation loop

**Files:**
- Modify: `backend/scripts/import_attica_structures.py`

**Step 1: Add `find_ekka_match()` function**

```python
def find_ekka_match(foreas_name, ekka):
    """Try to match an Excel operator name to EKKA data."""
    if not foreas_name:
        return None

    normalized = _normalize(foreas_name)

    # Exact match
    if normalized in ekka:
        return ekka[normalized]

    # Substring match (EKKA name contains Excel name or vice versa)
    for ekka_name, data in ekka.items():
        if len(normalized) > 5 and (normalized in ekka_name or ekka_name in normalized):
            return data

    return None
```

**Step 2: Add `import_structures()` — the main import function**

```python
def import_structures(excel_path, types, ekka, dry_run=False, clear_existing=False):
    """Parse Excel and import structures into DB."""
    if not os.path.exists(excel_path):
        print(f"  ERROR: Excel file not found: {excel_path}")
        return

    # Clear existing Attica imports if requested
    if clear_existing and not dry_run:
        # Delete structures whose code matches our pattern (TYPE-PE-NNNN)
        pe_codes = list(PE_MAP.values())
        deleted = 0
        for structure in Structure.query.all():
            parts = structure.code.split('-')
            if len(parts) >= 3 and parts[-2] in pe_codes:
                db.session.delete(structure)
                deleted += 1
        if deleted:
            db.session.flush()
            print(f"  Cleared {deleted} previously imported Attica structures")

    wb = load_workbook(excel_path, read_only=True)
    ws = wb.active

    # Track sequence numbers per type-PE combo
    seq_counters = Counter()

    # Pre-load existing codes to check for duplicates
    existing_codes = set(s.code for s in Structure.query.with_entities(Structure.code).all())

    stats = {'imported': 0, 'skipped': 0, 'errors': 0, 'ekka_matched': 0}
    batch = []

    for i, row in enumerate(ws.iter_rows(min_row=3, values_only=True)):  # skip title + header
        row_num = i + 3

        try:
            # Unpack columns: #, type, name, foreas, character, capacity, license, address, email, site, phone, dimos, enotita
            _, type_name, name, foreas, character, capacity, license_raw, address, email, site, phone, dimos, enotita = row

            if not name or not type_name:
                stats['errors'] += 1
                continue

            # Map type
            type_code = TYPE_MAP.get(type_name)
            if not type_code:
                print(f"  Row {row_num}: Unknown type '{type_name}', skipping")
                stats['errors'] += 1
                continue

            if type_code not in types:
                print(f"  Row {row_num}: Type code '{type_code}' not in DB, skipping")
                stats['errors'] += 1
                continue

            # Generate code
            pe_abbrev = PE_MAP.get(enotita, 'XX')
            seq_key = f"{type_code}-{pe_abbrev}"
            seq_counters[seq_key] += 1
            code = f"{type_code}-{pe_abbrev}-{seq_counters[seq_key]:04d}"

            # Check uniqueness
            if code in existing_codes:
                stats['skipped'] += 1
                continue

            # Parse address
            street, postal_code = parse_address(address)

            # Phone → string
            phone_str = str(int(phone)) if isinstance(phone, (int, float)) else str(phone) if phone else None

            # License — skip if ';;' or empty
            license_number = None
            if license_raw and str(license_raw).strip() not in ('', ';;'):
                license_number = str(license_raw).strip()

            # Capacity — int or None
            cap = int(capacity) if capacity else None

            # Ownership
            ownership = infer_ownership(type_name, name)
            if character and str(character).strip():
                char_str = str(character).strip().lower()
                if 'δημόσι' in char_str or 'δημοτικ' in char_str:
                    ownership = 'municipal'
                elif 'ιδιωτικ' in char_str:
                    ownership = 'private'

            # Notes — include website if present
            notes_parts = []
            if site:
                notes_parts.append(f"Website: {site}")
            notes = '\n'.join(notes_parts) if notes_parts else None

            # Representative
            rep_name = str(foreas).strip() if foreas else None
            rep_email = str(email).strip() if email else None
            rep_afm = None

            # EKKA enrichment for MKO entries
            if type_code == 'MKO' and foreas:
                ekka_match = find_ekka_match(foreas, ekka)
                if ekka_match:
                    rep_afm = ekka_match['afm']
                    cert_info = f"Πιστοποίηση ΕΚΚΑ έως: {ekka_match['cert_expiry']}" if ekka_match.get('cert_expiry') else None
                    if cert_info:
                        notes_parts.append(cert_info)
                        notes = '\n'.join(notes_parts)
                    stats['ekka_matched'] += 1

            if dry_run:
                if stats['imported'] < 10:  # Show first 10
                    print(f"  [DRY] {code} | {name[:50]} | {dimos} | {pe_abbrev}" +
                          (f" | AFM:{rep_afm}" if rep_afm else ""))
                elif stats['imported'] == 10:
                    print(f"  ... (showing first 10 of many)")
                stats['imported'] += 1
                existing_codes.add(code)
                continue

            structure = Structure(
                code=code,
                type_id=types[type_code].id,
                name=str(name).strip(),
                street=street,
                city=str(dimos).strip() if dimos else None,
                postal_code=postal_code,
                representative_name=rep_name,
                representative_afm=rep_afm,
                representative_phone=phone_str,
                representative_email=rep_email,
                capacity=cap,
                status='active',
                ownership=ownership,
                license_number=license_number,
                peripheral_unit=str(enotita).strip() if enotita else None,
                notes=notes,
            )
            db.session.add(structure)
            existing_codes.add(code)
            batch.append(structure)
            stats['imported'] += 1

            # Batch flush every 200 rows
            if len(batch) >= 200:
                db.session.flush()
                batch.clear()

        except Exception as e:
            print(f"  Row {row_num}: ERROR — {e}")
            stats['errors'] += 1

    # Final flush + commit
    if batch and not dry_run:
        db.session.flush()

    if not dry_run:
        db.session.commit()

    wb.close()

    print(f"\n  Results:")
    print(f"    Imported:     {stats['imported']}")
    print(f"    Skipped:      {stats['skipped']} (already exist)")
    print(f"    Errors:       {stats['errors']}")
    print(f"    EKKA matches: {stats['ekka_matched']} / 148 MKO entries")
```

**Step 3: Complete main()**

```python
def main():
    args = parse_args()
    app = create_app()

    with app.app_context():
        print("Import Attica Structures")
        print("=" * 50)
        if args.dry_run:
            print("DRY RUN — no changes will be made\n")

        # Resolve file paths
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        excel_path = args.excel or os.path.join(project_root, 'mapAttica-Αποτελέσματα Αναζήτησης.xlsx')
        ekka_path = args.ekka or os.path.join(project_root, 'Πίνακας.csv')

        # Step 1: Ensure structure types
        print("\n[1/3] Structure Types")
        types = ensure_types(dry_run=args.dry_run)

        # Step 2: Load EKKA data
        print("\n[2/3] EKKA Data")
        ekka = load_ekka_data(ekka_path)

        # Step 3: Import structures
        print("\n[3/3] Importing Structures")
        import_structures(excel_path, types, ekka,
                          dry_run=args.dry_run,
                          clear_existing=args.clear_existing)

    print("\nDone.")
```

**Step 4: Test dry run**

Run: `cd backend && python scripts/import_attica_structures.py --dry-run`

Expected output:
```
Import Attica Structures
==================================================
DRY RUN — no changes will be made

[1/3] Structure Types
  [DRY] Would create type: DS — Δημοτικός Παιδικός Σταθμός
  [DRY] Would create type: KDAP-AMEA — ΚΔΑΠ Ατόμων με Αναπηρία
  [DRY] Would create type: KHFH — Κέντρο Ημερήσιας Φροντίδας Ηλικιωμένων
  [DRY] Would create type: MKO — Πιστοποιημένος Φορέας ΜΚΟ

[2/3] EKKA Data
  Loaded ~370 EKKA lookup entries from Πίνακας.csv

[3/3] Importing Structures
  [DRY] MFPAD-BT-0001 | ΤΗΣ ΕΙΡΗΝΗΣ | ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ | BT
  [DRY] MFPAD-BT-0002 | ΛΟΥΛΟΥΔΟΤΟΠΟΣ | ΑΓΙΑΣ ΠΑΡΑΣΚΕΥΗΣ | BT
  ... (showing first 10 of many)

  Results:
    Imported:     1671
    Skipped:      0 (already exist)
    Errors:       0
    EKKA matches: ~80-120 / 148 MKO entries

Done.
```

**Step 5: Commit**

```bash
git add backend/scripts/import_attica_structures.py
git commit -m "feat: implement Attica structures import with EKKA enrichment"
```

---

### Task 5: Run actual import and verify

**Step 1: Ensure Docker DB is running**

Run: `docker ps | grep sw_portal_db`
If not running: `docker-compose up -d`

**Step 2: Run the import**

Run: `cd backend && python scripts/import_attica_structures.py`

Expected: ~1,671 imported, 0 errors, some EKKA matches

**Step 3: Verify in database**

Run: `docker exec sw_portal_db psql -U sw_portal -d sw_portal -c "SELECT st.name, COUNT(*) FROM structures s JOIN structure_types st ON s.type_id=st.id GROUP BY st.name ORDER BY count DESC;"`

Expected:
```
                              name                              | count
----------------------------------------------------------------+-------
 Μονάδα Φροντίδας Προσχολικής Αγωγής                           |   635
 Δημοτικός Παιδικός Σταθμός                                     |   461
 Πιστοποιημένος Φορέας ΜΚΟ                                      |   148
 Μονάδα Φροντίδας Ηλικιωμένων                                   |   145
 ...
```

**Step 4: Verify EKKA AFM enrichment**

Run: `docker exec sw_portal_db psql -U sw_portal -d sw_portal -c "SELECT code, name, representative_afm FROM structures WHERE representative_afm IS NOT NULL AND code LIKE 'MKO-%' LIMIT 10;"`

**Step 5: Verify idempotency — run again**

Run: `cd backend && python scripts/import_attica_structures.py`

Expected: `Imported: 0, Skipped: 1671`

**Step 6: Final commit**

```bash
git add backend/scripts/import_attica_structures.py
git commit -m "feat: verified Attica import — 1,671 structures loaded"
```

---

## Verification Checklist

- [ ] `--dry-run` shows preview without touching DB
- [ ] Full import creates ~1,671 structures
- [ ] 4 new StructureType records created (DS, KDAP-AMEA, KHFH, MKO)
- [ ] Address parsed → `street` + `postal_code` populated
- [ ] MKO entries enriched with EKKA AFM where matched
- [ ] Idempotent — second run imports 0, skips all
- [ ] `--clear-existing` removes previous import, re-imports cleanly
- [ ] Registry page at `/registry` shows all structures
- [ ] No duplicate codes in DB
