#!/usr/bin/env python
"""
Seed Attica structures from pre-exported JSON data.

Usage:
    python scripts/seed_attica.py              # Import (skip existing)
    python scripts/seed_attica.py --dry-run    # Preview only
    python scripts/seed_attica.py --clear      # Clear and re-import
"""
import argparse
import json
import os
import sys

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from datetime import date
from my_project import create_app
from my_project.extensions import db
from my_project.registry.models import Structure, StructureType, License

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'attica_structures.json')
LICENSES_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'diavgeia_licenses.json')

NEW_TYPES = {
    'DS': ('Δημοτικός Παιδικός Σταθμός', 'Δημοτικοί βρεφονηπιακοί και παιδικοί σταθμοί'),
    'KAA': ('Κέντρο Αποκατάστασης-Αποθεραπείας', 'Κέντρα Αποκατάστασης-Αποθεραπείας (ΚΑΑ) και ΚΑΑ ΑΜΕΑ'),
    'KDAP-AMEA': ('ΚΔΑΠ Ατόμων με Αναπηρία', 'Κέντρα Δημιουργικής Απασχόλησης Παιδιών και Ατόμων με Αναπηρία'),
    'KHFH': ('Κέντρο Ημερήσιας Φροντίδας Ηλικιωμένων', 'Κέντρα ημερήσιας φροντίδας και απασχόλησης ηλικιωμένων'),
    'MKO': ('Πιστοποιημένος Φορέας ΜΚΟ', 'Πιστοποιημένοι φορείς παροχής κοινωνικής φροντίδας (Μη Κερδοσκοπικοί)'),
    'MPP': ('Μονάδα Παιδικής Προστασίας', 'Μονάδες Παιδικής Προστασίας (ΜΠΠ)'),
}

PE_CODES = ['KT', 'BT', 'NT', 'AA', 'PN', 'DT', 'DA']


def main():
    parser = argparse.ArgumentParser(description='Seed Attica structures from JSON')
    parser.add_argument('--dry-run', action='store_true', help='Preview without writing')
    parser.add_argument('--clear', action='store_true', help='Clear existing Attica structures first')
    args = parser.parse_args()

    app = create_app()

    with app.app_context():
        print("Seed Attica Structures")
        print("=" * 50)
        if args.dry_run:
            print("DRY RUN\n")

        # Load JSON
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            records = json.load(f)
        print(f"Loaded {len(records)} records from JSON\n")

        # Ensure structure types
        existing_types = {st.code: st for st in StructureType.query.all()}
        created = []
        for code, (name, desc) in NEW_TYPES.items():
            if code not in existing_types:
                if not args.dry_run:
                    st = StructureType(code=code, name=name, description=desc)
                    db.session.add(st)
                    created.append(code)
                else:
                    print(f"  [DRY] Would create type: {code}")

        if created:
            db.session.flush()
            existing_types = {st.code: st for st in StructureType.query.all()}
            print(f"  Created types: {', '.join(created)}")

        # Clear if requested
        if args.clear and not args.dry_run:
            from sqlalchemy import text
            attica_ids = [s.id for s in Structure.query.all()
                          if len(s.code.split('-')) >= 3 and s.code.split('-')[-2] in PE_CODES]
            if attica_ids:
                ids_csv = ','.join(str(i) for i in attica_ids)
                # Delete in FK-safe order (deepest children first)
                # Level 3: sanction_decisions -> sanctions
                db.session.execute(text(f"DELETE FROM sanction_decisions WHERE sanction_id IN (SELECT id FROM sanctions WHERE structure_id IN ({ids_csv}))"))
                # Level 2: inspection_reports -> inspections
                db.session.execute(text(f"DELETE FROM inspection_reports WHERE inspection_id IN (SELECT id FROM inspections WHERE structure_id IN ({ids_csv}))"))
                # Level 1: tables referencing both structures and inspections
                for t in ['sanctions', 'social_advisor_reports']:
                    db.session.execute(text(f"DELETE FROM {t} WHERE structure_id IN ({ids_csv})"))
                # Level 1: inspections (must come after sanctions/social_advisor_reports which also ref inspections)
                db.session.execute(text(f"DELETE FROM inspections WHERE structure_id IN ({ids_csv})"))
                # Level 1: direct children of structures only
                for t in ['licenses', 'decision_records', 'user_roles', 'committee_structure_assignments']:
                    db.session.execute(text(f"DELETE FROM {t} WHERE structure_id IN ({ids_csv})"))
                # Finally: structures themselves
                db.session.execute(text(f"DELETE FROM structures WHERE id IN ({ids_csv})"))
                db.session.flush()
                print(f"  Cleared {len(attica_ids)} existing Attica structures")

        # Import
        existing_codes = set(r[0] for r in db.session.query(Structure.code).all())
        imported = 0
        skipped = 0
        batch = []

        for r in records:
            if r['code'] in existing_codes:
                skipped += 1
                continue

            type_code = r['type_code']
            if type_code not in existing_types:
                continue

            if args.dry_run:
                if imported < 5:
                    print(f"  [DRY] {r['code']} | {r['name'][:50]}")
                elif imported == 5:
                    print(f"  ... ({len(records) - skipped} total)")
                imported += 1
                continue

            s = Structure(
                code=r['code'],
                type_id=existing_types[type_code].id,
                name=r['name'],
                street=r.get('street'),
                city=r.get('city'),
                postal_code=r.get('postal_code'),
                representative_name=r.get('representative_name'),
                representative_afm=r.get('representative_afm'),
                representative_phone=r.get('representative_phone'),
                representative_email=r.get('representative_email'),
                capacity=r.get('capacity'),
                ownership=r.get('ownership'),
                license_number=r.get('license_number'),
                peripheral_unit=r.get('peripheral_unit'),
                notes=r.get('notes'),
                status='active',
            )
            db.session.add(s)
            batch.append(s)
            imported += 1

            if len(batch) >= 200:
                db.session.flush()
                batch.clear()

        if batch and not args.dry_run:
            db.session.flush()

        if not args.dry_run:
            db.session.commit()

        print(f"\n  Imported: {imported}")
        print(f"  Skipped:  {skipped} (already exist)")

        # --- Import Diavgeia licenses ---
        if os.path.exists(LICENSES_FILE):
            print(f"\n{'=' * 50}")
            print("Diavgeia Licenses")
            print(f"{'=' * 50}")

            with open(LICENSES_FILE, 'r', encoding='utf-8') as f:
                lic_records = json.load(f)
            print(f"Loaded {len(lic_records)} license records from JSON")

            # Build code → structure_id mapping
            code_to_id = {s.code: s.id for s in Structure.query.all()}

            # Find existing ADAs to avoid duplicates
            existing_adas = set()
            for lic in License.query.all():
                if lic.notes and 'ADA:' in lic.notes:
                    import re
                    m = re.search(r'ADA:\s*(\S+)', lic.notes)
                    if m:
                        existing_adas.add(m.group(1))

            lic_imported = 0
            lic_skipped = 0

            for r in lic_records:
                # Check for duplicate ADA
                if r.get('notes'):
                    import re
                    m = re.search(r'ADA:\s*(\S+)', r['notes'])
                    if m and m.group(1) in existing_adas:
                        lic_skipped += 1
                        continue

                struct_id = code_to_id.get(r['structure_code'])
                if not struct_id:
                    lic_skipped += 1
                    continue

                issued = None
                if r.get('issued_date'):
                    try:
                        issued = date.fromisoformat(r['issued_date'])
                    except ValueError:
                        pass

                if args.dry_run:
                    if lic_imported < 3:
                        print(f"  [DRY] {r['structure_code']} | {r['type']} | {r.get('issued_date', '')}")
                    elif lic_imported == 3:
                        print(f"  ... ({len(lic_records)} total)")
                    lic_imported += 1
                    continue

                lic = License(
                    structure_id=struct_id,
                    type=r.get('type', ''),
                    protocol_number=r.get('protocol_number', ''),
                    issued_date=issued,
                    status=r.get('status', 'active'),
                    notes=r.get('notes', ''),
                    file_path=r.get('file_path'),
                )
                db.session.add(lic)
                lic_imported += 1

            if not args.dry_run and lic_imported:
                db.session.commit()

            print(f"\n  Imported: {lic_imported}")
            print(f"  Skipped:  {lic_skipped} (duplicate ADA or missing structure)")

    print("\nDone.")


if __name__ == '__main__':
    main()
