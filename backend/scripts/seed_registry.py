#!/usr/bin/env python
"""
Seed database with registry demo data.
Creates realistic Greek social care structures, inspections,
committees, reports, and sanctions for demo presentation.

Usage:
    python scripts/seed_registry.py
"""
import os
import sys
from datetime import date, datetime, timedelta

# Fix Unicode output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from my_project import create_app
from my_project.extensions import db
from my_project.models import User
from my_project.registry.models import StructureType, Structure, License, Sanction
from my_project.inspections.models import (
    InspectionCommittee, CommitteeMembership,
    CommitteeStructureAssignment, Inspection, InspectionReport
)
from my_project.oversight.models import UserRole, SocialAdvisorReport


def seed_registry():
    """Create demo registry data."""
    app = create_app()

    with app.app_context():
        admin = User.query.filter_by(username='admin').first()
        staff = User.query.filter_by(username='staff').first()

        if not admin or not staff:
            print("Error: Default users (admin, staff) not found. Run the app first.")
            return

        # Check if registry data already exists
        if Structure.query.count() > 0:
            print("Registry data already exists. Skipping seed.")
            return

        # Ensure structure types exist
        types = {st.code: st for st in StructureType.query.all()}
        if not types:
            print("Error: No structure types found. Run the app first to seed types.")
            return

        today = date.today()

        # --- Structures ---
        structures_data = [
            {
                'code': 'MFH-ATT-001', 'type_code': 'MFH',
                'name': 'Μονάδα Φροντίδας Ηλικιωμένων «Ο Άγιος Νεκτάριος»',
                'street': 'Λεωφόρος Μεσογείων 142', 'city': 'Αθήνα',
                'postal_code': '11527',
                'representative_name': 'Παναγιώτης Κωστόπουλος',
                'representative_afm': '123456789',
                'representative_phone': '2107234567',
                'representative_email': 'p.kostopoulos@example.gr',
                'capacity': 80, 'status': 'active', 'ownership': 'private_nonprofit',
                'license_number': 'ΑΔ-2023/1234',
                'license_date': today - timedelta(days=400),
                'license_expiry': today + timedelta(days=330),
            },
            {
                'code': 'MFH-THE-002', 'type_code': 'MFH',
                'name': 'Γηροκομείο Θεσσαλονίκης «Η Ελπίδα»',
                'street': 'Εγνατία 56', 'city': 'Θεσσαλονίκη',
                'postal_code': '54625',
                'representative_name': 'Ελένη Παπαδοπούλου',
                'representative_afm': '234567890',
                'representative_phone': '2310567890',
                'representative_email': 'e.papadopoulou@example.gr',
                'capacity': 120, 'status': 'active', 'ownership': 'npid',
                'license_number': 'ΑΔ-2022/5678',
                'license_date': today - timedelta(days=800),
                'license_expiry': today + timedelta(days=55),  # expiring soon
            },
            {
                'code': 'KDAP-ATT-003', 'type_code': 'KDAP',
                'name': 'ΚΔΑΠ Δήμου Περιστερίου «Χαρούμενα Παιδιά»',
                'street': 'Αγίου Κωνσταντίνου 12', 'city': 'Περιστέρι',
                'postal_code': '12134',
                'representative_name': 'Μαρία Γεωργίου',
                'representative_afm': '345678901',
                'representative_phone': '2105678901',
                'representative_email': 'm.georgiou@peristeri.gov.gr',
                'capacity': 60, 'status': 'active', 'ownership': 'public',
                'license_number': 'ΑΔ-2024/0012',
                'license_date': today - timedelta(days=200),
                'license_expiry': today + timedelta(days=530),
            },
            {
                'code': 'KDAP-PAT-004', 'type_code': 'KDAP',
                'name': 'ΚΔΑΠ «Φωτεινά Βήματα» Πάτρας',
                'street': 'Κορίνθου 34', 'city': 'Πάτρα',
                'postal_code': '26221',
                'representative_name': 'Δημήτρης Αλεξίου',
                'representative_afm': '456789012',
                'representative_phone': '2610345678',
                'representative_email': 'd.alexiou@example.gr',
                'capacity': 45, 'status': 'active', 'ownership': 'private_nonprofit',
                'license_number': 'ΑΔ-2023/3456',
                'license_date': today - timedelta(days=500),
                'license_expiry': today - timedelta(days=30),  # expired!
            },
            {
                'code': 'SYD-ATT-005', 'type_code': 'SYD',
                'name': 'Συμβουλευτικός Σταθμός Δήμου Αθηναίων',
                'street': 'Αθηνάς 63', 'city': 'Αθήνα',
                'postal_code': '10552',
                'representative_name': 'Σοφία Νικολάου',
                'representative_afm': '567890123',
                'representative_phone': '2103456789',
                'representative_email': 's.nikolaou@athens.gov.gr',
                'capacity': 30, 'status': 'active', 'ownership': 'public',
                'license_number': 'ΑΔ-2024/0789',
                'license_date': today - timedelta(days=100),
                'license_expiry': today + timedelta(days=630),
            },
            {
                'code': 'KDHF-LAR-006', 'type_code': 'KDHF-KAA',
                'name': 'ΚΔΗΦ-ΚΑΑ «Αγκαλιά» Λάρισας',
                'street': 'Παπαναστασίου 78', 'city': 'Λάρισα',
                'postal_code': '41222',
                'representative_name': 'Αθανάσιος Βλάχος',
                'representative_afm': '678901234',
                'representative_phone': '2410567890',
                'representative_email': 'a.vlachos@example.gr',
                'capacity': 25, 'status': 'active', 'ownership': 'npdd',
                'license_number': 'ΑΔ-2023/6789',
                'license_date': today - timedelta(days=600),
                'license_expiry': today + timedelta(days=130),
            },
            {
                'code': 'MFH-HER-007', 'type_code': 'MFH',
                'name': 'ΜΦΗ «Κνωσός» Ηρακλείου',
                'street': 'Λεωφόρος Κνωσού 45', 'city': 'Ηράκλειο',
                'postal_code': '71306',
                'representative_name': 'Γεώργιος Μαρκάκης',
                'representative_afm': '789012345',
                'representative_phone': '2810123456',
                'representative_email': 'g.markakis@example.gr',
                'capacity': 50, 'status': 'suspended', 'ownership': 'private_profit',
                'license_number': 'ΑΔ-2021/4321',
                'license_date': today - timedelta(days=1200),
                'license_expiry': today - timedelta(days=120),  # expired
            },
            {
                'code': 'MFPAD-IOA-008', 'type_code': 'MFPAD',
                'name': 'ΜΦΠΑΔ «Νέα Ζωή» Ιωαννίνων',
                'street': 'Δωδώνης 22', 'city': 'Ιωάννινα',
                'postal_code': '45221',
                'representative_name': 'Βασιλική Τσιούρη',
                'representative_afm': '890123456',
                'representative_phone': '2651098765',
                'representative_email': 'v.tsiouri@example.gr',
                'capacity': 35, 'status': 'active', 'ownership': 'private_nonprofit',
                'license_number': 'ΑΔ-2024/1111',
                'license_date': today - timedelta(days=150),
                'license_expiry': today + timedelta(days=580),
            },
            {
                'code': 'CAMP-LES-009', 'type_code': 'CAMP',
                'name': 'Κέντρο Φιλοξενίας Προσφύγων Λέσβου',
                'street': 'Περιοχή Καρά Τεπέ', 'city': 'Μυτιλήνη',
                'postal_code': '81100',
                'representative_name': 'Νίκος Στεφανίδης',
                'representative_afm': '901234567',
                'representative_phone': '2251076543',
                'representative_email': 'n.stefanidis@example.gr',
                'capacity': 500, 'status': 'active', 'ownership': 'public',
                'license_number': 'ΑΔ-2023/9999',
                'license_date': today - timedelta(days=300),
                'license_expiry': today + timedelta(days=430),
            },
            {
                'code': 'KDAP-VOL-010', 'type_code': 'KDAP',
                'name': 'ΚΔΑΠ Δήμου Βόλου «Αργοναύτες»',
                'street': 'Δημητριάδος 101', 'city': 'Βόλος',
                'postal_code': '38221',
                'representative_name': 'Κατερίνα Σταμούλη',
                'representative_afm': '012345678',
                'representative_phone': '2421078900',
                'representative_email': 'k.stamouli@volos.gov.gr',
                'capacity': 55, 'status': 'active', 'ownership': 'public',
                'license_number': 'ΑΔ-2024/0555',
                'license_date': today - timedelta(days=60),
                'license_expiry': today + timedelta(days=670),
            },
            {
                'code': 'SYD-KAV-011', 'type_code': 'SYD',
                'name': 'Κέντρο Κοινωνικής Στήριξης Καβάλας',
                'street': 'Ομονοίας 15', 'city': 'Καβάλα',
                'postal_code': '65403',
                'representative_name': 'Ανδρέας Πετρίδης',
                'representative_afm': '112233445',
                'representative_phone': '2510234567',
                'representative_email': 'a.petridis@kavala.gov.gr',
                'capacity': 20, 'status': 'active', 'ownership': 'public',
                'license_number': 'ΑΔ-2024/0333',
                'license_date': today - timedelta(days=90),
                'license_expiry': today + timedelta(days=640),
            },
            {
                'code': 'MFH-KOR-012', 'type_code': 'MFH',
                'name': 'ΜΦΗ «Αγία Παρασκευή» Κορίνθου',
                'street': 'Κολοκοτρώνη 28', 'city': 'Κόρινθος',
                'postal_code': '20100',
                'representative_name': 'Χρήστος Δημητρίου',
                'representative_afm': '223344556',
                'representative_phone': '2741056789',
                'representative_email': 'c.dimitriou@example.gr',
                'capacity': 65, 'status': 'active', 'ownership': 'private_nonprofit',
                'license_number': 'ΑΔ-2023/7777',
                'license_date': today - timedelta(days=450),
                'license_expiry': today + timedelta(days=280),
            },
        ]

        structures = []
        for s_data in structures_data:
            type_code = s_data.pop('type_code')
            st = types.get(type_code)
            if not st:
                print(f"  Warning: Type '{type_code}' not found, skipping {s_data['code']}")
                continue
            s_data['type_id'] = st.id
            s_data['advisor_id'] = staff.id
            structure = Structure(**s_data)
            db.session.add(structure)
            structures.append(structure)

        db.session.flush()
        print(f"  Created {len(structures)} structures")

        # --- Licenses ---
        # License fields: structure_id, type, protocol_number, issued_date, expiry_date, status, notes
        licenses_data = [
            (structures[0], 'active', 'ΑΔ-ΑΝ-2023/1234', 'ίδρυσης', today - timedelta(days=400), today + timedelta(days=330)),
            (structures[1], 'expiring', 'ΑΔ-ΑΝ-2022/5678', 'ίδρυσης', today - timedelta(days=800), today + timedelta(days=55)),
            (structures[3], 'expired', 'ΑΔ-ΑΝ-2023/3456', 'ίδρυσης', today - timedelta(days=500), today - timedelta(days=30)),
            (structures[6], 'revoked', 'ΑΔ-ΑΝ-2021/4321', 'ίδρυσης', today - timedelta(days=1200), today - timedelta(days=120)),
            (structures[2], 'active', 'ΑΔ-ΑΝ-2024/0012', 'λειτουργίας', today - timedelta(days=200), today + timedelta(days=530)),
        ]
        for structure, status, number, ltype, issued, expires in licenses_data:
            db.session.add(License(
                structure_id=structure.id,
                type=ltype,
                protocol_number=number,
                status=status,
                issued_date=issued,
                expiry_date=expires,
                notes=f'Άδεια {ltype} - {structure.name[:30]}'
            ))
        db.session.flush()
        print(f"  Created {len(licenses_data)} licenses")

        # --- Inspection Committees ---
        # Fields: decision_number, appointed_date, expiry_date, status, notes
        committee1 = InspectionCommittee(
            decision_number='ΑΠ-2025/1001',
            appointed_date=today - timedelta(days=365),
            expiry_date=today + timedelta(days=365),
            status='active',
            notes='Κεντρική επιτροπή ελέγχου δομών Αττικής'
        )
        committee2 = InspectionCommittee(
            decision_number='ΑΠ-2025/1002',
            appointed_date=today - timedelta(days=200),
            expiry_date=today + timedelta(days=530),
            status='active',
            notes='Επιτροπή ελέγχου δομών Θεσσαλονίκης και Κ. Μακεδονίας'
        )
        committee3 = InspectionCommittee(
            decision_number='ΑΠ-2024/0503',
            appointed_date=today - timedelta(days=600),
            expiry_date=today - timedelta(days=60),
            status='expired',
            notes='Επιτροπή ελέγχου δομών Κρήτης (ληγμένη)'
        )
        db.session.add_all([committee1, committee2, committee3])
        db.session.flush()
        print("  Created 3 inspection committees")

        # --- Committee Members ---
        db.session.add(CommitteeMembership(
            committee_id=committee1.id, user_id=admin.id, role='president'
        ))
        db.session.add(CommitteeMembership(
            committee_id=committee1.id, user_id=staff.id, role='member'
        ))
        db.session.add(CommitteeMembership(
            committee_id=committee2.id, user_id=admin.id, role='president'
        ))
        db.session.flush()

        # --- Committee → Structure Assignments ---
        # Fields: committee_id, structure_id, assigned_date
        for s in structures[:4]:
            db.session.add(CommitteeStructureAssignment(
                committee_id=committee1.id, structure_id=s.id,
                assigned_date=today - timedelta(days=300)
            ))
        db.session.add(CommitteeStructureAssignment(
            committee_id=committee2.id, structure_id=structures[1].id,
            assigned_date=today - timedelta(days=180)
        ))
        db.session.flush()

        # --- Inspections ---
        inspections = []
        inspections_data = [
            (structures[0], committee1, 'regular', 'completed', today - timedelta(days=60)),
            (structures[0], committee1, 'reinspection', 'scheduled', today + timedelta(days=30)),
            (structures[1], committee2, 'regular', 'completed', today - timedelta(days=90)),
            (structures[3], committee1, 'extraordinary', 'completed', today - timedelta(days=45)),
            (structures[6], committee1, 'extraordinary', 'completed', today - timedelta(days=180)),
            (structures[2], committee1, 'regular', 'cancelled', today - timedelta(days=15)),
        ]
        for structure, committee, itype, status, scheduled in inspections_data:
            insp = Inspection(
                structure_id=structure.id,
                committee_id=committee.id,
                type=itype,
                status=status,
                scheduled_date=scheduled,
                conclusion='normal' if status == 'completed' else None,
                notes=f'{"Ολοκληρώθηκε" if status == "completed" else "Προγραμματισμένος"} έλεγχος {structure.code}'
            )
            db.session.add(insp)
            inspections.append(insp)
        db.session.flush()
        print(f"  Created {len(inspections)} inspections")

        # --- Inspection Reports ---
        # Fields: inspection_id, protocol_number, drafted_date, findings, recommendations, status, submitted_by, submitted_at
        reports_data = [
            (inspections[0], 'submitted',
             'Η μονάδα λειτουργεί εντός νομικού πλαισίου. Πλήρης συμμόρφωση.'),
            (inspections[2], 'submitted',
             'Παρατηρήθηκαν ελλείψεις στον εξαερισμό χώρων. Απαιτείται διόρθωση εντός 30 ημερών.'),
            (inspections[3], 'submitted',
             'Σοβαρές παραβάσεις υγιεινής. Ανεπαρκές προσωπικό. Συστήνεται αναστολή λειτουργίας.'),
            (inspections[4], 'submitted',
             'Ακατάλληλες συνθήκες διαβίωσης. Αναστολή λειτουργίας μέχρι πλήρους αποκατάστασης.'),
        ]
        for i, (inspection, status, findings) in enumerate(reports_data):
            db.session.add(InspectionReport(
                inspection_id=inspection.id,
                protocol_number=f'ΕΚΘ-2025/{2001 + i}',
                drafted_date=today - timedelta(days=15),
                findings=findings,
                recommendations='Βλ. αναλυτικό πόρισμα',
                status=status,
                submitted_by=admin.id,
                submitted_at=datetime.utcnow() - timedelta(days=10),
            ))
        db.session.flush()
        print(f"  Created {len(reports_data)} inspection reports")

        # --- Sanctions ---
        # Fields: structure_id, inspection_id, type, amount, imposed_date, status, protocol_number, notes
        sanctions_data = [
            (structures[3], inspections[3], 'fine', 'imposed', 5000.0,
             'Πρόστιμο για ελλιπείς συνθήκες υγιεινής'),
            (structures[6], inspections[4], 'suspension', 'imposed', None,
             'Αναστολή λειτουργίας λόγω σοβαρών παραβάσεων'),
        ]
        for structure, inspection, stype, status, amount, notes in sanctions_data:
            db.session.add(Sanction(
                structure_id=structure.id,
                inspection_id=inspection.id,
                type=stype,
                status=status,
                amount=amount,
                notes=notes,
                imposed_date=today - timedelta(days=30),
                protocol_number=f'ΚΥΡ-2025/{3001}',
            ))
        db.session.flush()
        print(f"  Created {len(sanctions_data)} sanctions")

        # --- Advisor Reports ---
        # Fields: structure_id, author_id, drafted_date, type, assessment, recommendations, status, approved_by, approved_at
        advisor_reports_data = [
            (structures[0], 'regular', 'approved',
             'Τακτική αξιολόγηση δομής. Ικανοποιητικό επίπεδο λειτουργίας.'),
            (structures[1], 'regular', 'submitted',
             'Τακτική αξιολόγηση. Σημειώνονται ελλείψεις σε θέματα πυρασφάλειας.'),
            (structures[4], 'extraordinary', 'draft',
             'Έκτακτη αξιολόγηση μετά από καταγγελία.'),
        ]
        for structure, rtype, status, assessment in advisor_reports_data:
            db.session.add(SocialAdvisorReport(
                structure_id=structure.id,
                author_id=staff.id,
                type=rtype,
                status=status,
                assessment=assessment,
                drafted_date=today - timedelta(days=20),
                approved_by=admin.id if status == 'approved' else None,
                approved_at=datetime.utcnow() - timedelta(days=10) if status == 'approved' else None,
            ))
        db.session.flush()
        print(f"  Created {len(advisor_reports_data)} advisor reports")

        # --- UserRoles (ensure demo roles exist) ---
        # admin → director, administrative (may already exist from seed)
        for role in ('director', 'administrative'):
            if not UserRole.query.filter_by(user_id=admin.id, role=role).first():
                db.session.add(UserRole(user_id=admin.id, role=role, assigned_by=admin.id))
        # staff → social_advisor
        if not UserRole.query.filter_by(user_id=staff.id, role='social_advisor').first():
            db.session.add(UserRole(user_id=staff.id, role='social_advisor', assigned_by=admin.id))

        db.session.commit()
        print("\nRegistry seed data created successfully!")
        print(f"  Structures: {Structure.query.count()}")
        print(f"  Committees: {InspectionCommittee.query.count()}")
        print(f"  Inspections: {Inspection.query.count()}")
        print(f"  Reports: {InspectionReport.query.count()}")
        print(f"  Advisor Reports: {SocialAdvisorReport.query.count()}")
        print(f"  Sanctions: {Sanction.query.count()}")
        print(f"  Licenses: {License.query.count()}")


if __name__ == "__main__":
    seed_registry()
