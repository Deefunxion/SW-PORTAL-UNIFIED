"""
Comprehensive demo data for presentation to the Secretary General.
Creates a realistic snapshot of a fully operational social care oversight portal.
"""

from datetime import datetime, date, timedelta
from .extensions import db


def seed_demo_data():
    """Seed all demo data if the database is empty.
    Safe to call multiple times — checks before inserting."""

    from .models import User, Category, Discussion, Post, Notification, UserProfile
    from .registry.models import Structure, StructureType, License, Sanction
    from .inspections.models import (
        InspectionCommittee, CommitteeMembership,
        CommitteeStructureAssignment, Inspection, InspectionReport
    )
    from .oversight.models import UserRole, SocialAdvisorReport

    # Check if full demo data is already present (structures are the key indicator)
    if Structure.query.count() >= 15:
        print("[seed] Full demo data already exists — skipping.")
        return

    print("[seed] Creating demo data for presentation...")

    # ─── USERS (get-or-create to handle partial seeds) ──────
    def get_or_create_user(username, email, role, password):
        u = User.query.filter_by(username=username).first()
        if not u:
            u = User(username=username, email=email, role=role)
            u.set_password(password)
            db.session.add(u)
        return u

    users = {
        'admin': get_or_create_user('admin', 'admin@portal.gr', 'admin', 'admin123'),
        'mpapadopoulou': get_or_create_user('mpapadopoulou', 'm.papadopoulou@portal.gr', 'staff', 'staff123'),
        'gnikolaou': get_or_create_user('gnikolaou', 'g.nikolaou@portal.gr', 'staff', 'staff123'),
        'kkonstantinou': get_or_create_user('kkonstantinou', 'k.konstantinou@portal.gr', 'staff', 'staff123'),
        'athanasiou': get_or_create_user('athanasiou', 'a.thanasiou@portal.gr', 'staff', 'staff123'),
        'guest': get_or_create_user('guest', 'guest@portal.gr', 'guest', 'guest123'),
    }
    db.session.flush()  # Get IDs for foreign keys

    # Profiles (get-or-create — UserProfile has UNIQUE on user_id)
    profiles_data = [
        (users['admin'].id, 'Αντώνης Καραγιάννης', 'Διευθυντής Κοινωνικής Μέριμνας', 'Αθήνα'),
        (users['mpapadopoulou'].id, 'Μαρία Παπαδοπούλου', 'Κοινωνική Σύμβουλος — ΜΦΗ & ΚΔΑΠ', 'Αθήνα'),
        (users['gnikolaou'].id, 'Γιώργος Νικολάου', 'Κοινωνικός Λειτουργός — ΣΥΔ & ΚΔΗΦ', 'Πειραιάς'),
        (users['kkonstantinou'].id, 'Κατερίνα Κωνσταντίνου', 'Διοικητική Υπάλληλος — Αδειοδότηση', 'Αθήνα'),
        (users['athanasiou'].id, 'Αλέξανδρος Αθανασίου', 'Μέλος Επιτροπής Ελέγχου', 'Ελευσίνα'),
    ]
    for uid, display_name, bio, location in profiles_data:
        if not UserProfile.query.filter_by(user_id=uid).first():
            db.session.add(UserProfile(user_id=uid, display_name=display_name, bio=bio, location=location))

    # ─── USER ROLES (get-or-create — has UniqueConstraint) ──
    roles_data = [
        (users['admin'].id, 'director'),
        (users['admin'].id, 'administrative'),
        (users['mpapadopoulou'].id, 'social_advisor'),
        (users['gnikolaou'].id, 'social_advisor'),
        (users['kkonstantinou'].id, 'administrative'),
        (users['athanasiou'].id, 'committee_member'),
    ]
    for uid, role in roles_data:
        if not UserRole.query.filter_by(user_id=uid, role=role, structure_id=None).first():
            db.session.add(UserRole(user_id=uid, role=role))

    # ─── CATEGORIES (get-or-create) ────────────────────────
    categories_data = [
        ('Γενικά Θέματα', 'Συζητήσεις για οτιδήποτε δεν ταιριάζει στις άλλες κατηγορίες.'),
        ('Νομικά Θέματα', 'Ερωτήσεις και συζητήσεις νομικού περιεχομένου.'),
        ('Δύσκολα Θέματα', 'Για πιο σύνθετα και απαιτητικά ζητήματα.'),
        ('Νέα-Ανακοινώσεις', 'Ενημερώσεις και ανακοινώσεις από τη διαχείριση.'),
        ('Προτάσεις', 'Προτάσεις για τη βελτίωση του portal.'),
        ('Εποπτεία ΜΦΗ', 'Θέματα εποπτείας Μονάδων Φροντίδας Ηλικιωμένων.'),
        ('Εποπτεία ΚΔΑΠ', 'Θέματα εποπτείας Κέντρων Δημιουργικής Απασχόλησης Παιδιών.'),
        ('Εποπτεία ΣΥΔ', 'Θέματα εποπτείας Στεγών Υποστηριζόμενης Διαβίωσης.'),
        ('Αδειοδότηση Δομών', 'Θέματα αδειοδότησης και κανονιστικού πλαισίου δομών κοινωνικής φροντίδας.'),
    ]
    cats = {}
    for title, desc in categories_data:
        cat = Category.query.filter_by(title=title).first()
        if not cat:
            cat = Category(title=title, description=desc)
            db.session.add(cat)
        cats[title] = cat
    db.session.flush()

    # ─── STRUCTURE TYPES (get-or-create) ────────────────────
    types_data = [
        ('MFH', 'Μονάδα Φροντίδας Ηλικιωμένων', 'Γηροκομεία, μονάδες χρόνιας φροντίδας ηλικιωμένων'),
        ('KDAP', 'Κέντρο Δημιουργικής Απασχόλησης Παιδιών', 'Δομές δημιουργικής απασχόλησης για παιδιά σχολικής ηλικίας'),
        ('SYD', 'Στέγη Υποστηριζόμενης Διαβίωσης', 'Δομές αυτόνομης/ημιαυτόνομης διαβίωσης ΑμεΑ'),
        ('KDHF-KAA', 'Κέντρο Διημέρευσης-Ημερήσιας Φροντίδας / Κέντρο Αποθεραπείας-Αποκατάστασης',
         'Δομές ημερήσιας φροντίδας και αποκατάστασης'),
        ('MFPAD', 'Μονάδα Φροντίδας Προσχολικής Αγωγής και Διαπαιδαγώγησης',
         'Ιδρύματα/μονάδες φροντίδας για παιδιά και ΑμεΑ'),
        ('CAMP', 'Παιδικές Κατασκηνώσεις', 'Εποχικές δομές κατασκήνωσης'),
    ]
    stypes = {}
    for code, name, desc in types_data:
        st = StructureType.query.filter_by(code=code).first()
        if not st:
            st = StructureType(code=code, name=name, description=desc)
            db.session.add(st)
        stypes[code] = st
    db.session.flush()

    # ─── STRUCTURES (8 δομές σε διαφορετικά στάδια) ─────────
    today = date.today()

    def get_or_create_structure(s):
        """Insert structure if it doesn't exist by code, else return existing."""
        existing = Structure.query.filter_by(code=s.code).first()
        if existing:
            return existing
        db.session.add(s)
        return s

    structures = [
        Structure(
            code='MFH-ATT-001', type_id=stypes['MFH'].id,
            name='Γηροκομείο «Αγία Ελένη»',
            street='Λεωφ. Κηφισίας 142', city='Αθήνα', postal_code='11525',
            representative_name='Ελένη Δημητρίου', representative_afm='012345678',
            representative_phone='210-6543210', representative_email='info@agiaeleni.gr',
            capacity=120, status='active', ownership='private',
            license_number='ΑΔ-2023/4521', license_date=today - timedelta(days=400),
            license_expiry=today + timedelta(days=330),
            advisor_id=users['mpapadopoulou'].id,
            peripheral_unit='Κεντρικός Τομέας Αθηνών',
            notes='Λειτουργεί κανονικά. Τελευταίος έλεγχος: θετικός.',
        ),
        Structure(
            code='MFH-PEI-002', type_id=stypes['MFH'].id,
            name='Μονάδα Φροντίδας Ηλικιωμένων «Ευαγγελισμός»',
            street='Ακτή Μιαούλη 55', city='Πειραιάς', postal_code='18535',
            representative_name='Κωνσταντίνος Βλάχος', representative_afm='987654321',
            representative_phone='210-4180500', representative_email='info@mfh-evangelismos.gr',
            capacity=80, status='under_review', ownership='public',
            advisor_id=users['mpapadopoulou'].id,
            peripheral_unit='Πειραιάς',
            notes='Σε αναμονή ανανέωσης άδειας. Εκκρεμεί επιθεώρηση.',
        ),
        Structure(
            code='KDAP-ATT-003', type_id=stypes['KDAP'].id,
            name='ΚΔΑΠ «Χαμόγελο»',
            street='Αχαρνών 78', city='Αθήνα', postal_code='10438',
            representative_name='Σοφία Αντωνίου', representative_afm='456789123',
            representative_phone='210-8234567', representative_email='info@kdap-xamogelo.gr',
            capacity=45, status='active', ownership='municipal',
            license_number='ΑΔ-2024/1102', license_date=today - timedelta(days=200),
            license_expiry=today + timedelta(days=530),
            advisor_id=users['mpapadopoulou'].id,
            peripheral_unit='Κεντρικός Τομέας Αθηνών',
            notes='Άριστη λειτουργία. Βραβευμένο πρόγραμμα δημιουργικής απασχόλησης.',
        ),
        Structure(
            code='KDAP-ELE-004', type_id=stypes['KDAP'].id,
            name='ΚΔΑΠ «Ηλιαχτίδα»',
            street='Ελευθερίου Βενιζέλου 23', city='Ελευσίνα', postal_code='19200',
            representative_name='Δημήτρης Παπανικολάου', representative_afm='321654987',
            representative_phone='210-5541234', representative_email='info@kdap-iliachtida.gr',
            capacity=35, status='suspended', ownership='private',
            license_number='ΑΔ-2022/0891', license_date=today - timedelta(days=900),
            license_expiry=today - timedelta(days=170),
            peripheral_unit='Δυτική Αττική',
            notes='Αναστολή λειτουργίας λόγω παραβάσεων ασφαλείας. Εκκρεμεί συμμόρφωση.',
        ),
        Structure(
            code='SYD-ATT-005', type_id=stypes['SYD'].id,
            name='Στέγη Αυτόνομης Διαβίωσης «Ελπίδα»',
            street='Πατησίων 200', city='Αθήνα', postal_code='11256',
            representative_name='Μαρία Γεωργίου', representative_afm='654321789',
            representative_phone='210-8612345', representative_email='info@syd-elpida.gr',
            capacity=18, status='active', ownership='ngo',
            license_number='ΑΔ-2024/2205', license_date=today - timedelta(days=150),
            license_expiry=today + timedelta(days=580),
            advisor_id=users['gnikolaou'].id,
            peripheral_unit='Κεντρικός Τομέας Αθηνών',
            notes='Πρότυπη δομή ΣΥΔ. Συνεργασία με ΕΟΠΥΥ.',
        ),
        Structure(
            code='KDHF-PEI-006', type_id=stypes['KDHF-KAA'].id,
            name='Κέντρο Ημερήσιας Φροντίδας «Νέα Ζωή»',
            street='Γρηγορίου Λαμπράκη 88', city='Πειραιάς', postal_code='18533',
            representative_name='Ανδρέας Οικονόμου', representative_afm='789123456',
            representative_phone='210-4295678', representative_email='info@kdhf-neazoi.gr',
            capacity=40, status='pending_license', ownership='private',
            advisor_id=users['gnikolaou'].id,
            peripheral_unit='Πειραιάς',
            notes='Νέα δομή — αίτημα αδειοδότησης υποβλήθηκε 01/2026.',
        ),
        Structure(
            code='MFPAD-ATT-007', type_id=stypes['MFPAD'].id,
            name='Ίδρυμα Παιδικής Μέριμνας «Θεοτόκος»',
            street='Βασ. Σοφίας 112', city='Αθήνα', postal_code='11528',
            representative_name='Αικατερίνη Λιάπη', representative_afm='147258369',
            representative_phone='210-7234561', representative_email='info@theotokos.gr',
            capacity=60, status='active', ownership='ngo',
            license_number='ΑΔ-2023/3312', license_date=today - timedelta(days=500),
            license_expiry=today + timedelta(days=60),  # Λήγει σύντομα!
            advisor_id=users['mpapadopoulou'].id,
            peripheral_unit='Κεντρικός Τομέας Αθηνών',
            notes='Η άδεια λήγει σε 2 μήνες — απαιτείται ανανέωση.',
        ),
        Structure(
            code='CAMP-ATT-008', type_id=stypes['CAMP'].id,
            name='Παιδική Κατασκήνωση «Αγία Μαρίνα»',
            street='Θέση Αγία Μαρίνα', city='Ραφήνα', postal_code='19009',
            representative_name='Νίκος Σταματόπουλος', representative_afm='963852741',
            representative_phone='22940-71234', representative_email='info@camp-agiamarina.gr',
            capacity=200, status='active', ownership='public',
            license_number='ΑΔ-2025/0415', license_date=today - timedelta(days=90),
            license_expiry=today + timedelta(days=640),
            peripheral_unit='Ανατολική Αττική',
            notes='Λειτουργία μόνο Ιούνιο-Αύγουστο. Εποχική.',
        ),
    ]
    structures = [get_or_create_structure(s) for s in structures]
    db.session.flush()

    # ─── ADDITIONAL STRUCTURES (9-15) ────────────────────────
    extra_structures = [
        Structure(
            code='MFH-MAR-009', type_id=stypes['MFH'].id,
            name='Γηροκομείο «Άγιος Παντελεήμων»',
            street='Λεωφ. Μαραθώνος 45', city='Νέα Μάκρη', postal_code='19005',
            representative_name='Χαράλαμπος Κυριακίδης', representative_afm='258147369',
            representative_phone='22940-95432', representative_email='info@ag-panteleimon.gr',
            capacity=90, status='active', ownership='ngo',
            license_number='ΑΔ-2024/1850', license_date=today - timedelta(days=300),
            license_expiry=today + timedelta(days=430),
            advisor_id=users['mpapadopoulou'].id,
            peripheral_unit='Ανατολική Αττική',
            notes='Λειτουργεί κανονικά. Νέα πτέρυγα υπό κατασκευή.',
        ),
        Structure(
            code='KDAP-PEI-010', type_id=stypes['KDAP'].id,
            name='ΚΔΑΠ «Ουράνιο Τόξο»',
            street='Ηρώων Πολυτεχνείου 12', city='Πειραιάς', postal_code='18535',
            representative_name='Αγγελική Μαυρίδου', representative_afm='369258147',
            representative_phone='210-4125678', representative_email='info@kdap-ouranio.gr',
            capacity=50, status='active', ownership='municipal',
            license_number='ΑΔ-2024/0932', license_date=today - timedelta(days=240),
            license_expiry=today + timedelta(days=490),
            advisor_id=users['mpapadopoulou'].id,
            peripheral_unit='Πειραιάς',
            notes='Πρόγραμμα ένταξης παιδιών προσφύγων.',
        ),
        Structure(
            code='SYD-GLY-011', type_id=stypes['SYD'].id,
            name='Στέγη «Φως στη Ζωή»',
            street='Λαοδικείας 19', city='Γλυφάδα', postal_code='16675',
            representative_name='Ιωάννης Παπαντωνίου', representative_afm='741852963',
            representative_phone='210-9612345', representative_email='info@fos-sti-zoi.gr',
            capacity=12, status='under_review', ownership='ngo',
            advisor_id=users['gnikolaou'].id,
            peripheral_unit='Νότιος Τομέας Αθηνών',
            notes='Υπό αξιολόγηση μετά από αλλαγή διοίκησης.',
        ),
        Structure(
            code='KDHF-AMR-012', type_id=stypes['KDHF-KAA'].id,
            name='Κέντρο Αποκατάστασης «Ασκληπιός»',
            street='28ης Οκτωβρίου 78', city='Μαρούσι', postal_code='15124',
            representative_name='Δέσποινα Αλεξίου', representative_afm='852963741',
            representative_phone='210-6123456', representative_email='info@asklepios-rehab.gr',
            capacity=30, status='active', ownership='private',
            license_number='ΑΔ-2023/2890', license_date=today - timedelta(days=550),
            license_expiry=today + timedelta(days=180),
            advisor_id=users['gnikolaou'].id,
            peripheral_unit='Βόρειος Τομέας Αθηνών',
            notes='Εξειδίκευση σε ΑμεΑ. Άδεια λήγει σε 6 μήνες.',
        ),
        Structure(
            code='MFH-KER-013', type_id=stypes['MFH'].id,
            name='Μονάδα Φροντίδας «Κηφισιά»',
            street='Κολοκοτρώνη 5', city='Κηφισιά', postal_code='14562',
            representative_name='Βασίλειος Πετρόπουλος', representative_afm='159357486',
            representative_phone='210-8085432', representative_email='info@mfh-kifisia.gr',
            capacity=55, status='active', ownership='private',
            license_number='ΑΔ-2025/0212', license_date=today - timedelta(days=60),
            license_expiry=today + timedelta(days=670),
            advisor_id=users['mpapadopoulou'].id,
            peripheral_unit='Βόρειος Τομέας Αθηνών',
            notes='Νεόκτιστες εγκαταστάσεις. Πρώτη αδειοδότηση.',
        ),
        Structure(
            code='MFPAD-PER-014', type_id=stypes['MFPAD'].id,
            name='Κέντρο Παιδικής Προστασίας «Αστέρι»',
            street='Ιπποκράτους 32', city='Περιστέρι', postal_code='12134',
            representative_name='Ελευθερία Κωστοπούλου', representative_afm='951753864',
            representative_phone='210-5789012', representative_email='info@asteri-care.gr',
            capacity=40, status='suspended', ownership='ngo',
            license_number='ΑΔ-2023/1567', license_date=today - timedelta(days=700),
            license_expiry=today - timedelta(days=65),
            peripheral_unit='Δυτικός Τομέας Αθηνών',
            notes='Αναστολή λόγω ελλιπούς στελέχωσης. Υποβλήθηκε σχέδιο συμμόρφωσης.',
        ),
        Structure(
            code='CAMP-LAV-015', type_id=stypes['CAMP'].id,
            name='Κατασκήνωση «Λαύριο»',
            street='Παράλια Λαυρίου', city='Λαύριο', postal_code='19500',
            representative_name='Γεώργιος Τσιμπίδης', representative_afm='357159486',
            representative_phone='22920-26543', representative_email='info@camp-lavrio.gr',
            capacity=150, status='pending_license', ownership='public',
            peripheral_unit='Ανατολική Αττική',
            notes='Νέα κατασκήνωση δήμου Λαυρίου. Εκκρεμεί αρχικός έλεγχος.',
        ),
    ]
    extra_structures = [get_or_create_structure(s) for s in extra_structures]
    structures.extend(extra_structures)
    db.session.flush()

    # Lookup helpers
    s_agia_eleni = structures[0]
    s_evangelismos = structures[1]
    s_xamogelo = structures[2]
    s_iliachtida = structures[3]
    s_elpida = structures[4]
    s_neazoi = structures[5]
    s_theotokos = structures[6]
    s_camp = structures[7]
    s_panteleimon = structures[8]
    s_ouranio = structures[9]
    s_fos = structures[10]
    s_asklepios = structures[11]
    s_kifisia = structures[12]
    s_asteri = structures[13]
    s_lavrio = structures[14]

    # ─── LICENSES ───────────────────────────────────────────
    licenses = [
        License(structure_id=s_agia_eleni.id, type='operating',
                protocol_number='ΦΕΚ/Β/2023/4521', issued_date=today - timedelta(days=400),
                expiry_date=today + timedelta(days=330), status='active',
                notes='Κανονική άδεια λειτουργίας'),
        License(structure_id=s_xamogelo.id, type='operating',
                protocol_number='ΦΕΚ/Β/2024/1102', issued_date=today - timedelta(days=200),
                expiry_date=today + timedelta(days=530), status='active'),
        License(structure_id=s_iliachtida.id, type='operating',
                protocol_number='ΦΕΚ/Β/2022/0891', issued_date=today - timedelta(days=900),
                expiry_date=today - timedelta(days=170), status='expired',
                notes='Λήξη χωρίς ανανέωση — αναστολή λειτουργίας'),
        License(structure_id=s_elpida.id, type='operating',
                protocol_number='ΦΕΚ/Β/2024/2205', issued_date=today - timedelta(days=150),
                expiry_date=today + timedelta(days=580), status='active'),
        License(structure_id=s_theotokos.id, type='operating',
                protocol_number='ΦΕΚ/Β/2023/3312', issued_date=today - timedelta(days=500),
                expiry_date=today + timedelta(days=60), status='active',
                notes='ΠΡΟΣΟΧΗ: Λήξη σε 2 μήνες — πρέπει να ξεκινήσει ανανέωση'),
        License(structure_id=s_camp.id, type='operating',
                protocol_number='ΦΕΚ/Β/2025/0415', issued_date=today - timedelta(days=90),
                expiry_date=today + timedelta(days=640), status='active'),
        # Special license
        License(structure_id=s_agia_eleni.id, type='fire_safety',
                protocol_number='ΠΣ/2024/1890', issued_date=today - timedelta(days=250),
                expiry_date=today + timedelta(days=115), status='active',
                notes='Πιστοποιητικό πυρασφάλειας'),
    ]
    for lic in licenses:
        db.session.add(lic)

    # ─── COMMITTEES ─────────────────────────────────────────
    committee1 = InspectionCommittee(
        decision_number='ΑΠ-2025/Φ.01/892',
        appointed_date=today - timedelta(days=180),
        expiry_date=today + timedelta(days=185),
        status='active',
        notes='Επιτροπή Ελέγχου ΜΦΗ & ΚΔΑΠ Αττικής'
    )
    committee2 = InspectionCommittee(
        decision_number='ΑΠ-2025/Φ.02/1105',
        appointed_date=today - timedelta(days=90),
        expiry_date=today + timedelta(days=275),
        status='active',
        notes='Επιτροπή Ελέγχου ΣΥΔ & ΚΔΗΦ'
    )
    db.session.add_all([committee1, committee2])
    db.session.flush()

    # Committee memberships
    memberships = [
        CommitteeMembership(committee_id=committee1.id, user_id=users['athanasiou'].id, role='president'),
        CommitteeMembership(committee_id=committee1.id, user_id=users['mpapadopoulou'].id, role='member'),
        CommitteeMembership(committee_id=committee1.id, user_id=users['kkonstantinou'].id, role='secretary'),
        CommitteeMembership(committee_id=committee2.id, user_id=users['gnikolaou'].id, role='president'),
        CommitteeMembership(committee_id=committee2.id, user_id=users['athanasiou'].id, role='member'),
    ]
    for m in memberships:
        db.session.add(m)

    # Committee → Structure assignments
    assignments = [
        CommitteeStructureAssignment(committee_id=committee1.id, structure_id=s_agia_eleni.id,
                                      assigned_date=today - timedelta(days=160)),
        CommitteeStructureAssignment(committee_id=committee1.id, structure_id=s_evangelismos.id,
                                      assigned_date=today - timedelta(days=160)),
        CommitteeStructureAssignment(committee_id=committee1.id, structure_id=s_xamogelo.id,
                                      assigned_date=today - timedelta(days=160)),
        CommitteeStructureAssignment(committee_id=committee1.id, structure_id=s_iliachtida.id,
                                      assigned_date=today - timedelta(days=160)),
        CommitteeStructureAssignment(committee_id=committee2.id, structure_id=s_elpida.id,
                                      assigned_date=today - timedelta(days=80)),
        CommitteeStructureAssignment(committee_id=committee2.id, structure_id=s_neazoi.id,
                                      assigned_date=today - timedelta(days=80)),
        CommitteeStructureAssignment(committee_id=committee1.id, structure_id=s_panteleimon.id,
                                      assigned_date=today - timedelta(days=70)),
        CommitteeStructureAssignment(committee_id=committee1.id, structure_id=s_ouranio.id,
                                      assigned_date=today - timedelta(days=70)),
        CommitteeStructureAssignment(committee_id=committee2.id, structure_id=s_fos.id,
                                      assigned_date=today - timedelta(days=50)),
        CommitteeStructureAssignment(committee_id=committee2.id, structure_id=s_asklepios.id,
                                      assigned_date=today - timedelta(days=50)),
        CommitteeStructureAssignment(committee_id=committee2.id, structure_id=s_asteri.id,
                                      assigned_date=today - timedelta(days=50)),
        CommitteeStructureAssignment(committee_id=committee1.id, structure_id=s_lavrio.id,
                                      assigned_date=today - timedelta(days=30)),
    ]
    for a in assignments:
        db.session.add(a)

    # ─── INSPECTIONS ────────────────────────────────────────
    insp1 = Inspection(
        structure_id=s_agia_eleni.id, committee_id=committee1.id,
        type='regular', scheduled_date=today - timedelta(days=45),
        status='completed', conclusion='compliant',
        notes='Τακτικός έλεγχος — πλήρης συμμόρφωση.'
    )
    insp2 = Inspection(
        structure_id=s_iliachtida.id, committee_id=committee1.id,
        type='regular', scheduled_date=today - timedelta(days=60),
        status='completed', conclusion='non_compliant',
        notes='Διαπιστώθηκαν σοβαρές παραβάσεις ασφαλείας.'
    )
    insp3 = Inspection(
        structure_id=s_xamogelo.id, committee_id=committee1.id,
        type='regular', scheduled_date=today - timedelta(days=30),
        status='completed', conclusion='compliant',
        notes='Τακτικός έλεγχος — εξαιρετική λειτουργία.'
    )
    insp4 = Inspection(
        structure_id=s_elpida.id, committee_id=committee2.id,
        type='regular', scheduled_date=today - timedelta(days=15),
        status='completed', conclusion='partially_compliant',
        notes='Μικρές ελλείψεις στην τεκμηρίωση. Δόθηκε 30ήμερο συμμόρφωσης.'
    )
    insp5 = Inspection(
        structure_id=s_evangelismos.id, committee_id=committee1.id,
        type='regular', scheduled_date=today + timedelta(days=14),
        status='scheduled',
        notes='Προγραμματισμένη επιθεώρηση — σε αναμονή ανανέωσης άδειας.'
    )
    insp6 = Inspection(
        structure_id=s_neazoi.id, committee_id=committee2.id,
        type='pre_licensing', scheduled_date=today + timedelta(days=21),
        status='scheduled',
        notes='Έλεγχος προ-αδειοδότησης για νέα δομή.'
    )
    insp7 = Inspection(
        structure_id=s_theotokos.id, committee_id=committee1.id,
        type='follow_up', scheduled_date=today + timedelta(days=7),
        status='scheduled',
        notes='Επανέλεγχος ενόψει ανανέωσης άδειας.'
    )
    db.session.add_all([insp1, insp2, insp3, insp4, insp5, insp6, insp7])
    db.session.flush()

    # ─── INSPECTION REPORTS ─────────────────────────────────
    reports = [
        InspectionReport(
            inspection_id=insp1.id,
            protocol_number='ΕΚΘ-2026/0112',
            drafted_date=today - timedelta(days=40),
            findings='Η δομή λειτουργεί σε πλήρη συμμόρφωση με το ισχύον κανονιστικό πλαίσιο. '
                     'Το προσωπικό είναι επαρκές και εκπαιδευμένο. Οι εγκαταστάσεις βρίσκονται σε '
                     'άριστη κατάσταση. Τηρείται πλήρης φάκελος ωφελουμένων.',
            recommendations='Προτείνεται η ανανέωση πιστοποίησης πυρασφάλειας πριν τη λήξη.',
            status='approved',
            submitted_by=users['athanasiou'].id,
            submitted_at=datetime.utcnow() - timedelta(days=38),
        ),
        InspectionReport(
            inspection_id=insp2.id,
            protocol_number='ΕΚΘ-2026/0098',
            drafted_date=today - timedelta(days=55),
            findings='Διαπιστώθηκαν τα εξής:\n'
                     '1. Απουσία εγκεκριμένου πιστοποιητικού πυρασφάλειας\n'
                     '2. Ανεπαρκής αναλογία προσωπικού-παιδιών (1:18 αντί 1:12)\n'
                     '3. Ελλιπής σήμανση εξόδων κινδύνου\n'
                     '4. Μη τήρηση βιβλίου συμβάντων',
            recommendations='1. Άμεση αναστολή λειτουργίας μέχρι συμμόρφωση\n'
                           '2. Πρόστιμο για τις παραβάσεις ασφαλείας\n'
                           '3. Επανέλεγχος μετά τη συμμόρφωση',
            status='approved',
            submitted_by=users['athanasiou'].id,
            submitted_at=datetime.utcnow() - timedelta(days=52),
        ),
        InspectionReport(
            inspection_id=insp3.id,
            protocol_number='ΕΚΘ-2026/0145',
            drafted_date=today - timedelta(days=25),
            findings='Εξαιρετική λειτουργία. Πρότυπο πρόγραμμα δημιουργικής απασχόλησης με '
                     'ειδικές δράσεις για παιδιά με μαθησιακές δυσκολίες. Πλήρης τεκμηρίωση.',
            recommendations='Δεν απαιτούνται διορθωτικές ενέργειες. Προτείνεται ως πρότυπο ΚΔΑΠ.',
            status='approved',
            submitted_by=users['mpapadopoulou'].id,
            submitted_at=datetime.utcnow() - timedelta(days=22),
        ),
        InspectionReport(
            inspection_id=insp4.id,
            protocol_number='ΕΚΘ-2026/0167',
            drafted_date=today - timedelta(days=10),
            findings='Η δομή λειτουργεί ικανοποιητικά. Διαπιστώθηκαν μικρές ελλείψεις:\n'
                     '1. Ελλιπής τεκμηρίωση ατομικών πλάνων 3 ωφελουμένων\n'
                     '2. Καθυστέρηση ανανέωσης πιστοποίησης HACCP',
            recommendations='30ήμερο περιθώριο συμμόρφωσης για τις ελλείψεις τεκμηρίωσης.',
            status='submitted',
            submitted_by=users['gnikolaou'].id,
            submitted_at=datetime.utcnow() - timedelta(days=8),
        ),
    ]
    for r in reports:
        db.session.add(r)

    # ─── SANCTIONS ──────────────────────────────────────────
    sanctions = [
        Sanction(
            structure_id=s_iliachtida.id, inspection_id=insp2.id,
            type='suspension', imposed_date=today - timedelta(days=50),
            status='active', protocol_number='ΚΥΡΩ-2026/0034',
            notes='Αναστολή λειτουργίας λόγω σοβαρών παραβάσεων ασφαλείας.'
        ),
        Sanction(
            structure_id=s_iliachtida.id, inspection_id=insp2.id,
            type='fine', amount=5000.00, imposed_date=today - timedelta(days=50),
            status='imposed', protocol_number='ΚΥΡΩ-2026/0035',
            notes='Πρόστιμο 5.000€ για παράβαση αναλογίας προσωπικού.'
        ),
        Sanction(
            structure_id=s_evangelismos.id,
            type='warning', imposed_date=today - timedelta(days=90),
            status='complied', protocol_number='ΚΥΡΩ-2025/0198',
            notes='Σύσταση για ανανέωση άδειας λειτουργίας εντός 60 ημερών.'
        ),
    ]
    for s in sanctions:
        db.session.add(s)

    # ─── ADDITIONAL LICENSES (for new structures) ────────────
    extra_licenses = [
        License(structure_id=s_panteleimon.id, type='operating',
                protocol_number='ΦΕΚ/Β/2024/1850', issued_date=today - timedelta(days=300),
                expiry_date=today + timedelta(days=430), status='active'),
        License(structure_id=s_ouranio.id, type='operating',
                protocol_number='ΦΕΚ/Β/2024/0932', issued_date=today - timedelta(days=240),
                expiry_date=today + timedelta(days=490), status='active'),
        License(structure_id=s_asklepios.id, type='operating',
                protocol_number='ΦΕΚ/Β/2023/2890', issued_date=today - timedelta(days=550),
                expiry_date=today + timedelta(days=180), status='active',
                notes='Λήγει σε 6 μήνες — απαιτείται ανανέωση'),
        License(structure_id=s_kifisia.id, type='operating',
                protocol_number='ΦΕΚ/Β/2025/0212', issued_date=today - timedelta(days=60),
                expiry_date=today + timedelta(days=670), status='active'),
        License(structure_id=s_asteri.id, type='operating',
                protocol_number='ΦΕΚ/Β/2023/1567', issued_date=today - timedelta(days=700),
                expiry_date=today - timedelta(days=65), status='expired',
                notes='Λήξη χωρίς ανανέωση — δομή σε αναστολή'),
    ]
    for lic in extra_licenses:
        db.session.add(lic)

    # ─── ADDITIONAL INSPECTIONS ────────────────────────────
    insp8 = Inspection(
        structure_id=s_panteleimon.id, committee_id=committee1.id,
        type='regular', scheduled_date=today - timedelta(days=20),
        status='completed', conclusion='compliant',
        notes='Τακτικός έλεγχος — πλήρης συμμόρφωση. Εντυπωσιακές εγκαταστάσεις.'
    )
    insp9 = Inspection(
        structure_id=s_ouranio.id, committee_id=committee1.id,
        type='regular', scheduled_date=today - timedelta(days=10),
        status='completed', conclusion='partially_compliant',
        notes='Μικρές ελλείψεις στον εξωτερικό χώρο. Δόθηκε 15ήμερο.'
    )
    insp10 = Inspection(
        structure_id=s_asteri.id, committee_id=committee2.id,
        type='extraordinary', scheduled_date=today - timedelta(days=35),
        status='completed', conclusion='non_compliant',
        notes='Έκτακτος έλεγχος μετά από καταγγελία. Ελλιπής στελέχωση.'
    )
    insp11 = Inspection(
        structure_id=s_asklepios.id, committee_id=committee2.id,
        type='regular', scheduled_date=today + timedelta(days=28),
        status='scheduled',
        notes='Τακτικός ετήσιος έλεγχος.'
    )
    insp12 = Inspection(
        structure_id=s_lavrio.id, committee_id=committee1.id,
        type='pre_licensing', scheduled_date=today + timedelta(days=35),
        status='scheduled',
        notes='Πρώτος έλεγχος νέας κατασκηνωτικής δομής.'
    )
    insp13 = Inspection(
        structure_id=s_fos.id, committee_id=committee2.id,
        type='extraordinary', scheduled_date=today + timedelta(days=10),
        status='scheduled',
        notes='Έκτακτος έλεγχος μετά αλλαγή διοίκησης.'
    )
    db.session.add_all([insp8, insp9, insp10, insp11, insp12, insp13])
    db.session.flush()

    # Reports for new inspections
    extra_reports = [
        InspectionReport(
            inspection_id=insp8.id,
            protocol_number='ΕΚΘ-2026/0201',
            drafted_date=today - timedelta(days=18),
            findings='Η δομή λειτουργεί υποδειγματικά. Νέα πτέρυγα 20 κλινών υπό κατασκευή. '
                     'Πλήρες και εκπαιδευμένο προσωπικό.',
            recommendations='Συνέχιση τήρησης υψηλών προτύπων.',
            status='approved',
            submitted_by=users['athanasiou'].id,
            submitted_at=datetime.utcnow() - timedelta(days=16),
        ),
        InspectionReport(
            inspection_id=insp9.id,
            protocol_number='ΕΚΘ-2026/0215',
            drafted_date=today - timedelta(days=8),
            findings='Η δομή λειτουργεί ικανοποιητικά. Ελλείψεις:\n'
                     '1. Περίφραξη αυλής χρειάζεται επισκευή σε 2 σημεία\n'
                     '2. Ελαφρά υστέρηση ανανέωσης πιστοποιητικού πρώτων βοηθειών.',
            recommendations='15ήμερο συμμόρφωσης. Επανέλεγχος σε 30 ημέρες.',
            status='submitted',
            submitted_by=users['mpapadopoulou'].id,
            submitted_at=datetime.utcnow() - timedelta(days=6),
        ),
        InspectionReport(
            inspection_id=insp10.id,
            protocol_number='ΕΚΘ-2026/0178',
            drafted_date=today - timedelta(days=30),
            findings='Ο έκτακτος έλεγχος κατόπιν καταγγελίας επιβεβαίωσε:\n'
                     '1. Αναλογία προσωπικού 1:12 αντί 1:6 (εξαρτώμενα παιδιά)\n'
                     '2. Απουσία νυκτερινού φύλακα\n'
                     '3. Μη ενημερωμένα ατομικά πλάνα φροντίδας',
            recommendations='Αναστολή λειτουργίας μέχρι πλήρη συμμόρφωση.',
            status='approved',
            submitted_by=users['gnikolaou'].id,
            submitted_at=datetime.utcnow() - timedelta(days=28),
        ),
    ]
    for r in extra_reports:
        db.session.add(r)

    # Additional sanctions for new structures
    extra_sanctions = [
        Sanction(
            structure_id=s_asteri.id, inspection_id=insp10.id,
            type='suspension', imposed_date=today - timedelta(days=28),
            status='active', protocol_number='ΚΥΡΩ-2026/0051',
            notes='Αναστολή λειτουργίας λόγω ελλιπούς στελέχωσης.'
        ),
        Sanction(
            structure_id=s_asteri.id, inspection_id=insp10.id,
            type='fine', amount=6000.00, imposed_date=today - timedelta(days=28),
            status='appealed', protocol_number='ΚΥΡΩ-2026/0052',
            notes='Πρόστιμο 6.000€ — υποβλήθηκε ένσταση.'
        ),
        Sanction(
            structure_id=s_ouranio.id,
            type='warning', imposed_date=today - timedelta(days=8),
            status='imposed', protocol_number='ΚΥΡΩ-2026/0060',
            notes='Σύσταση για αποκατάσταση ελλείψεων εξωτερικού χώρου εντός 15 ημερών.'
        ),
    ]
    for s in extra_sanctions:
        db.session.add(s)

    # Additional advisor reports for new structures
    extra_advisor_reports = [
        SocialAdvisorReport(
            structure_id=s_panteleimon.id, author_id=users['mpapadopoulou'].id,
            drafted_date=today - timedelta(days=15),
            type='regular',
            assessment='Η δομή λειτουργεί άριστα. Νέα πτέρυγα θα αυξήσει τη δυναμικότητα κατά 20 κλίνες. '
                       'Το προσωπικό είναι σταθερό και εκπαιδευμένο.',
            recommendations='Πρόσθετη πρόσληψη νοσηλευτικού προσωπικού ενόψει επέκτασης.',
            status='approved',
            approved_by=users['admin'].id,
            approved_at=datetime.utcnow() - timedelta(days=12),
        ),
        SocialAdvisorReport(
            structure_id=s_asklepios.id, author_id=users['gnikolaou'].id,
            drafted_date=today - timedelta(days=7),
            type='regular',
            assessment='Εξειδικευμένη δομή αποκατάστασης. Αξιόλογο πρόγραμμα φυσιοθεραπείας. '
                       'Η άδεια λήγει σε 6 μήνες — πρέπει να ξεκινήσει η ανανέωση.',
            recommendations='Άμεση υποβολή αίτησης ανανέωσης άδειας. Ενημέρωση ΕΟΠΥΥ.',
            status='submitted',
        ),
    ]
    for ar in extra_advisor_reports:
        db.session.add(ar)

    # ─── SANCTION RULES (Ν.5041/2023, Άρθρο 100) ───────────
    from .sanctions.models import SanctionRule

    rules_data = [
        # General rules (all structure types)
        {'violation_code': 'NO_LICENSE', 'violation_name': 'Λειτουργία χωρίς άδεια',
         'base_fine': 60000, 'min_fine': 60000, 'max_fine': 60000,
         'category': 'admin', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §1',
         'can_trigger_suspension': True, 'suspension_threshold': 1,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0},
        {'violation_code': 'TERMS_VIOLATION', 'violation_name': 'Παράβαση όρων λειτουργίας',
         'base_fine': 5000, 'min_fine': 500, 'max_fine': 100000,
         'category': 'general', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': True, 'suspension_threshold': 3,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0},
        {'violation_code': 'FIRE_SAFETY', 'violation_name': 'Παραβίαση πυρασφάλειας',
         'base_fine': 8000, 'min_fine': 3000, 'max_fine': 50000,
         'category': 'safety', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': True, 'suspension_threshold': 2,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0},
        {'violation_code': 'HYGIENE', 'violation_name': 'Παραβίαση υγιεινής',
         'base_fine': 4000, 'min_fine': 500, 'max_fine': 30000,
         'category': 'hygiene', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': False, 'suspension_threshold': 0,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0},
        {'violation_code': 'MISSING_DOCS', 'violation_name': 'Έλλειψη τεκμηρίωσης',
         'base_fine': 2000, 'min_fine': 500, 'max_fine': 10000,
         'category': 'admin', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': False, 'suspension_threshold': 0,
         'escalation_2nd': 1.5, 'escalation_3rd_plus': 2.0},
        {'violation_code': 'NON_COMPLIANCE', 'violation_name': 'Μη συμμόρφωση εντός 3 μηνών',
         'base_fine': 5000, 'min_fine': 1000, 'max_fine': 50000,
         'category': 'general', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §3',
         'can_trigger_suspension': True, 'suspension_threshold': 2,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0},
        {'violation_code': 'ENDANGERMENT', 'violation_name': 'Σοβαρή παράβαση — κίνδυνος ωφελούμενων',
         'base_fine': 50000, 'min_fine': 20000, 'max_fine': 100000,
         'category': 'safety', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §4',
         'can_trigger_suspension': True, 'suspension_threshold': 1,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0},
        # MFH-specific rules
        {'violation_code': 'MFH_OVER_CAPACITY', 'violation_name': 'Υπέρβαση δυναμικότητας ΜΦΗ',
         'base_fine': 10000, 'min_fine': 5000, 'max_fine': 50000,
         'category': 'safety', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': True, 'suspension_threshold': 2,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['MFH'].id},
        {'violation_code': 'MFH_STAFF_RATIO', 'violation_name': 'Ελλιπής στελέχωση ΜΦΗ',
         'base_fine': 5000, 'min_fine': 2000, 'max_fine': 30000,
         'category': 'staff', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': False, 'suspension_threshold': 0,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['MFH'].id},
        {'violation_code': 'MFH_SAFETY', 'violation_name': 'Παραβίαση ασφάλειας ηλικιωμένων',
         'base_fine': 15000, 'min_fine': 5000, 'max_fine': 80000,
         'category': 'safety', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': True, 'suspension_threshold': 1,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['MFH'].id},
        {'violation_code': 'MFH_HYGIENE', 'violation_name': 'Παράβαση υγιεινής ΜΦΗ',
         'base_fine': 5000, 'min_fine': 1000, 'max_fine': 30000,
         'category': 'hygiene', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': False, 'suspension_threshold': 0,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['MFH'].id},
        {'violation_code': 'MFH_FIRE_SAFETY', 'violation_name': 'Παραβίαση πυρασφάλειας ΜΦΗ',
         'base_fine': 10000, 'min_fine': 5000, 'max_fine': 50000,
         'category': 'safety', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': True, 'suspension_threshold': 2,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['MFH'].id},
        # KDAP-specific rules
        {'violation_code': 'KDAP_CHILD_SAFETY', 'violation_name': 'Παράβαση ασφάλειας παιδιών',
         'base_fine': 15000, 'min_fine': 5000, 'max_fine': 80000,
         'category': 'safety', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': True, 'suspension_threshold': 1,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['KDAP'].id},
        {'violation_code': 'KDAP_STAFF_CERTS', 'violation_name': 'Ελλιπή πιστοποιητικά προσωπικού ΚΔΑΠ',
         'base_fine': 3000, 'min_fine': 1000, 'max_fine': 20000,
         'category': 'staff', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': False, 'suspension_threshold': 0,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['KDAP'].id},
        {'violation_code': 'KDAP_SPACE_REQS', 'violation_name': 'Ακαταλληλότητα χώρων ΚΔΑΠ',
         'base_fine': 5000, 'min_fine': 2000, 'max_fine': 30000,
         'category': 'safety', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': True, 'suspension_threshold': 2,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['KDAP'].id},
        # KIHI-specific rules (KDHF-KAA type)
        {'violation_code': 'KIHI_ACCESSIBILITY', 'violation_name': 'Παράβαση προσβασιμότητας ΚΗΦΗ',
         'base_fine': 5000, 'min_fine': 2000, 'max_fine': 30000,
         'category': 'safety', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': False, 'suspension_threshold': 0,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['KDHF-KAA'].id},
        {'violation_code': 'KIHI_PROGRAM', 'violation_name': 'Μη τήρηση προγράμματος ΚΗΦΗ',
         'base_fine': 3000, 'min_fine': 1000, 'max_fine': 15000,
         'category': 'general', 'legal_reference': 'Ν.5041/2023, Άρθρο 100, §2',
         'can_trigger_suspension': False, 'suspension_threshold': 0,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'structure_type_id': stypes['KDHF-KAA'].id},
        # COVID-era rules (inactive)
        {'violation_code': 'COVID_MEASURES', 'violation_name': 'Μη τήρηση υγειονομικών μέτρων',
         'base_fine': 3000, 'min_fine': 3000, 'max_fine': 10000,
         'category': 'hygiene', 'legal_reference': 'ΥΑ Δ1α/ΓΠ.οικ. 5432/2023',
         'can_trigger_suspension': False, 'suspension_threshold': 0,
         'escalation_2nd': 2.0, 'escalation_3rd_plus': 2.0,
         'is_active': False},
    ]
    for rule_dict in rules_data:
        existing = SanctionRule.query.filter_by(violation_code=rule_dict['violation_code']).first()
        if existing:
            for key, val in rule_dict.items():
                setattr(existing, key, val)
        else:
            db.session.add(SanctionRule(**rule_dict))

    # ─── SANCTION DECISIONS (workflow) ───────────────────────
    from .sanctions.models import SanctionDecision

    if SanctionDecision.query.count() == 0:
        _seed_decisions(db, users, s_agia_eleni, s_evangelismos, s_iliachtida,
                        s_ouranio, s_asklepios, s_asteri, today, Sanction, SanctionDecision, SanctionRule)

    # ─── CHECKLIST TEMPLATES ─────────────────────────────────
    from .inspections.models import ChecklistTemplate

    mfh_checklist_items = [
        {'category': 'Κτιριολογικά & Ασφάλεια', 'items': [
            {'id': 'B01', 'description': 'Πιστοποιητικό πυρασφάλειας σε ισχύ', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §36'},
            {'id': 'B02', 'description': 'Προσβασιμότητα ΑμεΑ (ράμπες, ανελκυστήρας)', 'is_required': True, 'legal_ref': 'Ν.4067/2012'},
            {'id': 'B03', 'description': 'Επαρκής φυσικός φωτισμός και αερισμός', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            {'id': 'B04', 'description': 'Σήμανση εξόδων κινδύνου', 'is_required': True, 'legal_ref': 'ΠΔ 71/88'},
            {'id': 'B05', 'description': 'Καταλληλότητα χώρων υγιεινής', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
        ]},
        {'category': 'Στελέχωση', 'items': [
            {'id': 'S01', 'description': 'Τήρηση αναλογίας προσωπικού/ωφελουμένων', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
            {'id': 'S02', 'description': 'Πτυχία και άδειες ασκήσεως σε ισχύ', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
            {'id': 'S03', 'description': 'Παρουσία νοσηλευτή κατά τη διάρκεια λειτουργίας', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            {'id': 'S04', 'description': 'Πρόγραμμα εκπαίδευσης προσωπικού', 'is_required': False, 'legal_ref': ''},
        ]},
        {'category': 'Υγιεινή & Διατροφή', 'items': [
            {'id': 'H01', 'description': 'Πιστοποιητικό υγείας τροφίμων (HACCP)', 'is_required': True, 'legal_ref': 'Κανονισμός (ΕΚ) 852/2004'},
            {'id': 'H02', 'description': 'Καθαριότητα χώρων (κοινόχρηστοι, κουζίνα, W/C)', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            {'id': 'H03', 'description': 'Τήρηση διαιτολογίου εγκεκριμένου από διαιτολόγο', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §39'},
            {'id': 'H04', 'description': 'Σωστή αποθήκευση φαρμάκων', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
        ]},
        {'category': 'Τεκμηρίωση', 'items': [
            {'id': 'D01', 'description': 'Ατομικοί φάκελοι ωφελουμένων ενημερωμένοι', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §40'},
            {'id': 'D02', 'description': 'Βιβλίο συμβάντων ενημερωμένο', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §41'},
            {'id': 'D03', 'description': 'Σύμβαση εργασίας κάθε εργαζόμενου', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
            {'id': 'D04', 'description': 'Ασφαλιστική ενημερότητα', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
        ]},
    ]

    kdap_checklist_items = [
        {'category': 'Κτιριολογικά & Ασφάλεια', 'items': [
            {'id': 'B01', 'description': 'Πιστοποιητικό πυρασφάλειας σε ισχύ', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §36'},
            {'id': 'B02', 'description': 'Ασφάλεια εξωτερικών χώρων (αυλή, περίφραξη)', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            {'id': 'B03', 'description': 'Καταλληλότητα χώρων για ηλικιακή ομάδα', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            {'id': 'B04', 'description': 'Σήμανση εξόδων κινδύνου', 'is_required': True, 'legal_ref': 'ΠΔ 71/88'},
        ]},
        {'category': 'Στελέχωση', 'items': [
            {'id': 'S01', 'description': 'Τήρηση αναλογίας παιδαγωγών/παιδιών (1:25)', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
            {'id': 'S02', 'description': 'Πτυχία παιδαγωγών σε ισχύ', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
            {'id': 'S03', 'description': 'Πιστοποίηση πρώτων βοηθειών', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
        ]},
        {'category': 'Υγιεινή', 'items': [
            {'id': 'H01', 'description': 'Καθαριότητα χώρων & WC', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            {'id': 'H02', 'description': 'Διαθεσιμότητα φαρμακείου πρώτων βοηθειών', 'is_required': True, 'legal_ref': 'ΥΑ Γ2α/οικ.2973'},
            {'id': 'H03', 'description': 'Ασφάλεια υλικών δημιουργικής απασχόλησης', 'is_required': True, 'legal_ref': 'ΕΚ Directive 2009/48/EC'},
        ]},
        {'category': 'Τεκμηρίωση', 'items': [
            {'id': 'D01', 'description': 'Φάκελοι παιδιών με στοιχεία γονέων/κηδεμόνων', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §40'},
            {'id': 'D02', 'description': 'Πρόγραμμα δραστηριοτήτων', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §40'},
            {'id': 'D03', 'description': 'Βιβλίο συμβάντων', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §41'},
            {'id': 'D04', 'description': 'Ασφαλιστική ενημερότητα', 'is_required': True, 'legal_ref': 'Ν.4756/2020, §38'},
        ]},
    ]

    checklist_templates = [
        ('Πρότυπο Ελέγχου ΜΦΗ', 'MFH', mfh_checklist_items),
        ('Πρότυπο Ελέγχου ΚΔΑΠ', 'KDAP', kdap_checklist_items),
    ]
    for tpl_name, type_code, items in checklist_templates:
        stype = StructureType.query.filter_by(code=type_code).first()
        if stype and not ChecklistTemplate.query.filter_by(
            structure_type_id=stype.id, is_active=True
        ).first():
            db.session.add(ChecklistTemplate(
                structure_type_id=stype.id,
                name=tpl_name,
                items=items,
            ))

    # ─── ADVISOR REPORTS ────────────────────────────────────
    advisor_reports = [
        SocialAdvisorReport(
            structure_id=s_agia_eleni.id, author_id=users['mpapadopoulou'].id,
            drafted_date=today - timedelta(days=30),
            type='regular',
            assessment='Η δομή λειτουργεί εξαιρετικά. Το προσωπικό είναι αφοσιωμένο και '
                       'εκπαιδευμένο. Οι ωφελούμενοι εκφράζουν ικανοποίηση. Τηρούνται '
                       'όλα τα πρότυπα ποιότητας.',
            recommendations='Προτείνεται η εισαγωγή προγράμματος ψυχοκοινωνικής στήριξης '
                           'για τα μέλη των οικογενειών.',
            status='approved',
            approved_by=users['admin'].id,
            approved_at=datetime.utcnow() - timedelta(days=25),
        ),
        SocialAdvisorReport(
            structure_id=s_elpida.id, author_id=users['gnikolaou'].id,
            drafted_date=today - timedelta(days=12),
            type='regular',
            assessment='Η ΣΥΔ λειτουργεί ικανοποιητικά. Οι ωφελούμενοι διαβιούν αυτόνομα '
                       'με κατάλληλη υποστήριξη. Μικρές ελλείψεις στην τεκμηρίωση.',
            recommendations='Ολοκλήρωση ατομικών πλάνων εντός 30 ημερών.',
            status='submitted',
        ),
        SocialAdvisorReport(
            structure_id=s_iliachtida.id, author_id=users['mpapadopoulou'].id,
            drafted_date=today - timedelta(days=5),
            type='incident',
            assessment='Μετά τον έλεγχο και την αναστολή λειτουργίας, η δομή δεν έχει '
                       'υποβάλει σχέδιο συμμόρφωσης. Οι 35 ωφελούμενοι μεταφέρθηκαν '
                       'προσωρινά σε γειτονικά ΚΔΑΠ.',
            recommendations='1. Κλήση του φορέα σε ακρόαση\n'
                           '2. Εξέταση οριστικής ανάκλησης άδειας αν δεν υποβληθεί '
                           'σχέδιο συμμόρφωσης εντός 15 ημερών.',
            status='draft',
        ),
    ]
    for ar in advisor_reports:
        db.session.add(ar)

    # ─── FORUM DISCUSSIONS ──────────────────────────────────
    discussions_data = [
        # (category_key, user_key, title, description, days_ago, posts)
        ('Νέα-Ανακοινώσεις', 'admin',
         'Ενεργοποίηση Ψηφιακής Πλατφόρμας Εποπτείας',
         'Ανακοίνωση για την επίσημη λειτουργία του νέου ψηφιακού συστήματος εποπτείας δομών.',
         60,
         [('admin', 'Αγαπητοί συνάδελφοι,\n\nΣας ενημερώνουμε ότι τέθηκε σε πιλοτική λειτουργία '
                    'η νέα Ψηφιακή Πλατφόρμα Εποπτείας Δομών Κοινωνικής Φροντίδας. '
                    'Η πλατφόρμα επιτρέπει:\n\n'
                    '• Ηλεκτρονική καταχώριση και παρακολούθηση δομών\n'
                    '• Διαχείριση επιθεωρήσεων και εκθέσεων\n'
                    '• Παρακολούθηση αδειοδότησης\n'
                    '• Αυτοματοποιημένες ειδοποιήσεις\n\n'
                    'Παρακαλούμε ενημερώστε μας για τυχόν προβλήματα.', 60),
          ('mpapadopoulou', 'Εξαιρετική πρωτοβουλία! Ήδη καταχώρισα τις δομές μου. '
                           'Πολύ πιο εύκολο από τα χειρόγραφα αρχεία.', 58),
          ('gnikolaou', 'Συμφωνώ με τη Μαρία. Η δυνατότητα εξαγωγής αναφορών είναι πολύ χρήσιμη. '
                       'Ρωτάω: θα υπάρξει σύνδεση με την ΙΡΙΔΑ;', 57),
          ('admin', 'Γιώργο, η σύνδεση με ΙΡΙΔΑ (ΣΗΔΕ) είναι ήδη σε λειτουργία σε Επίπεδο 2 '
                   '(ημι-αυτοματοποιημένη εξαγωγή). Θα βρεις κουμπί "Ίριδα" στις εγκεκριμένες εκθέσεις.', 56),
         ]),

        ('Εποπτεία ΜΦΗ', 'mpapadopoulou',
         'Κριτήρια ελέγχου αναλογίας προσωπικού σε ΜΦΗ',
         'Συζήτηση για τα ισχύοντα κριτήρια αναλογίας προσωπικού/ωφελουμένων.',
         45,
         [('mpapadopoulou', 'Συνάδελφοι, θέλω να μοιραστώ μια πρόσφατη εμπειρία. Κατά τον έλεγχο '
                           'ΜΦΗ στον Πειραιά, διαπίστωσα αναλογία 1:15 αντί της προβλεπόμενης 1:8. '
                           'Σύμφωνα με τον Ν.4756/2020, η ελάχιστη αναλογία είναι:\n\n'
                           '• Αυτοεξυπηρετούμενοι: 1 νοσηλευτής ανά 10 ωφελούμενους\n'
                           '• Ημι-εξαρτημένοι: 1:6\n'
                           '• Κλινήρεις: 1:4\n\n'
                           'Πώς χειρίζεστε παρόμοιες περιπτώσεις;', 45),
          ('gnikolaou', 'Μαρία, σωστά τα στοιχεία. Εγώ σε παρόμοια περίπτωση έδωσα 30ήμερο '
                       'συμμόρφωσης και ζήτησα πρόγραμμα προσλήψεων. Αν δεν συμμορφωθούν, '
                       'εισηγούμαι κύρωση.', 43),
          ('athanasiou', 'Ως πρόεδρος επιτροπής ελέγχου, επιβεβαιώνω ότι τα πρόστιμα για '
                        'παράβαση αναλογίας κυμαίνονται 3.000€-10.000€ ανάλογα με τη σοβαρότητα.', 42),
         ]),

        ('Εποπτεία ΚΔΑΠ', 'mpapadopoulou',
         'Πρότυπο πρόγραμμα ΚΔΑΠ «Χαμόγελο» — μοιραζόμαστε καλές πρακτικές',
         'Παρουσίαση ενός ΚΔΑΠ με εξαιρετικές πρακτικές στη δημιουργική απασχόληση.',
         35,
         [('mpapadopoulou', 'Θέλω να αναδείξω τις εξαιρετικές πρακτικές του ΚΔΑΠ «Χαμόγελο» '
                           'στην Αχαρνών:\n\n'
                           '✅ Ειδικό πρόγραμμα για παιδιά με μαθησιακές δυσκολίες\n'
                           '✅ Συνεργασία με ψυχολόγο 3 φορές/εβδομάδα\n'
                           '✅ Πλήρης τεκμηρίωση με ψηφιακό φάκελο ανά παιδί\n'
                           '✅ Εκπαίδευση προσωπικού κάθε τρίμηνο\n\n'
                           'Θα μπορούσε να χρησιμεύσει ως πρότυπο για άλλα ΚΔΑΠ.', 35),
          ('kkonstantinou', 'Ενδιαφέρον! Από διοικητικής πλευράς, η ψηφιακή τεκμηρίωση '
                           'διευκολύνει πολύ τους ελέγχους. Θα μπορούσαμε να φτιάξουμε '
                           'οδηγό βέλτιστων πρακτικών;', 33),
          ('admin', 'Κατερίνα, εξαιρετική ιδέα. Θα το συζητήσουμε στην επόμενη σύσκεψη. '
                   'Μαρία, μπορείς να ετοιμάσεις πρόταση;', 32),
         ]),

        ('Αδειοδότηση Δομών', 'kkonstantinou',
         'Διαδικασία ανανέωσης αδειών — checklist',
         'Πρακτικός οδηγός για τη διαδικασία ανανέωσης αδειών δομών κοινωνικής φροντίδας.',
         25,
         [('kkonstantinou', 'Συνάδελφοι, δημοσιεύω τη λίστα ελέγχου για ανανέωση αδειών:\n\n'
                           '📋 **Απαιτούμενα δικαιολογητικά:**\n'
                           '1. Αίτηση ανανέωσης (τουλάχιστον 3 μήνες πριν τη λήξη)\n'
                           '2. Πιστοποιητικό πυρασφάλειας σε ισχύ\n'
                           '3. Υγειονομική βεβαίωση\n'
                           '4. Αντίγραφο ποινικού μητρώου υπεύθυνου\n'
                           '5. Φορολογική ενημερότητα\n'
                           '6. Ασφαλιστική ενημερότητα\n'
                           '7. Τελευταία έκθεση κοινωνικού συμβούλου\n'
                           '8. Αντίγραφο ισχύουσας σύμβασης (για ιδιωτικές)\n\n'
                           '⏰ **Χρονοδιάγραμμα:** 15-30 εργάσιμες ημέρες.', 25),
          ('mpapadopoulou', 'Πολύ χρήσιμο, Κατερίνα! Να προσθέσω: για τις ΜΦΗ απαιτείται '
                           'επιπλέον έκθεση του φαρμακοποιού.', 24),
          ('gnikolaou', 'Και για τις ΣΥΔ χρειάζεται η γνωμοδότηση του ΕΟΠΥΥ.', 23),
         ]),

        ('Νομικά Θέματα', 'gnikolaou',
         'Ερμηνεία Ν.4756/2020 — Δικαιώματα ωφελουμένων',
         'Συζήτηση για τα νομικά δικαιώματα των ωφελουμένων δομών κοινωνικής φροντίδας.',
         20,
         [('gnikolaou', 'Ο Ν.4756/2020 (ΦΕΚ Α\' 235) καθιερώνει σαφή δικαιώματα ωφελουμένων:\n\n'
                       '• Δικαίωμα αξιοπρεπούς διαβίωσης (Άρθρο 12)\n'
                       '• Δικαίωμα πληροφόρησης (Άρθρο 13)\n'
                       '• Δικαίωμα υποβολής καταγγελίας (Άρθρο 15)\n'
                       '• Δικαίωμα πρόσβασης στον ατομικό φάκελο (Άρθρο 14)\n\n'
                       'Στην πράξη, πόσες δομές τηρούν πλήρως αυτά τα δικαιώματα;', 20),
          ('mpapadopoulou', 'Από τις 4 δομές που παρακολουθώ, οι 3 τηρούν πλήρως. Η 4η (που '
                           'βρίσκεται σε αναστολή) είχε σοβαρές ελλείψεις στο Άρθρο 12.', 19),
          ('admin', 'Η ψηφιακή πλατφόρμα θα βοηθήσει στην καλύτερη παρακολούθηση. '
                   'Σχεδιάζουμε checklist δικαιωμάτων σε κάθε επιθεώρηση.', 18),
         ]),

        ('Δύσκολα Θέματα', 'gnikolaou',
         'Διαχείριση περιστατικών κακοποίησης σε δομές',
         'Εμπιστευτική συζήτηση για τη σωστή αντιμετώπιση περιστατικών.',
         15,
         [('gnikolaou', 'Χωρίς να αναφέρω στοιχεία, ήθελα να συζητήσουμε τα βήματα σε '
                       'περίπτωση καταγγελίας κακοποίησης:\n\n'
                       '1. Άμεση ενημέρωση Εισαγγελίας\n'
                       '2. Επείγουσα επιθεώρηση εντός 24 ωρών\n'
                       '3. Ενεργοποίηση πρωτοκόλλου προστασίας ωφελουμένων\n'
                       '4. Ενημέρωση Γ.Γ. εντός 48 ωρών\n\n'
                       'Έχετε εμπειρία; Ποια είναι τα κρίσιμα σημεία;', 15),
          ('mpapadopoulou', 'Γιώργο, το κρίσιμο είναι η ταχύτητα. Στην τελευταία μου περίπτωση, '
                           'η Εισαγγελία ζήτησε και ψηφιακά αντίγραφα του φακέλου — η πλατφόρμα '
                           'βοήθησε πολύ στην άμεση πρόσβαση.', 14),
         ]),

        ('Προτάσεις', 'kkonstantinou',
         'Αυτοματοποιημένες ειδοποιήσεις λήξης αδειών',
         'Πρόταση για σύστημα αυτόματων ειδοποιήσεων πριν τη λήξη αδειών.',
         10,
         [('kkonstantinou', 'Προτείνω να ενεργοποιηθεί αυτόματη ειδοποίηση:\n\n'
                           '🔔 90 ημέρες πριν τη λήξη → ειδοποίηση στον κοινωνικό σύμβουλο\n'
                           '🔔 60 ημέρες → ειδοποίηση στη δομή + κοιν. σύμβουλο\n'
                           '🔔 30 ημέρες → ειδοποίηση σε Δ/ντή + αυτόματη αλλαγή status\n'
                           '🔔 0 ημέρες → αυτόματη αναστολή\n\n'
                           'Αυτό θα αποτρέψει περιπτώσεις λειτουργίας χωρίς άδεια.', 10),
          ('admin', 'Κατερίνα, εξαιρετική πρόταση. Θα την εντάξουμε στη Φάση 2 του συστήματος.', 9),
          ('gnikolaou', 'Συμφωνώ 100%. Τώρα κάνω manual tracking σε spreadsheet — πολύ επιρρεπές σε λάθη.', 8),
          ('mpapadopoulou', '+1. Επίσης, θα ήταν χρήσιμο να υπάρχει αναφορά με όλες τις '
                           'άδειες που λήγουν τους επόμενους 3 μήνες.', 7),
         ]),

        ('Γενικά Θέματα', 'athanasiou',
         'Εκπαίδευση χρήσης νέας πλατφόρμας',
         'Συζήτηση για εκπαιδευτικά υλικά και tutorials.',
         5,
         [('athanasiou', 'Μόλις ολοκλήρωσα τον πρώτο μου έλεγχο μέσω πλατφόρμας. Πολύ πιο '
                        'εύκολο από τον παλιό τρόπο. Θα υπάρξει βιντεοσκοπημένο tutorial;', 5),
          ('admin', 'Αλέξανδρε, ναι! Ετοιμάζουμε video tutorials για κάθε ρόλο:\n'
                   '- Κοινωνικός Σύμβουλος\n'
                   '- Μέλος Επιτροπής\n'
                   '- Διοικητικός\n'
                   '- Διευθυντής\n\n'
                   'Θα αναρτηθούν εδώ.', 4),
          ('kkonstantinou', 'Εγώ πρόσθεσα ένα γρήγορο οδηγό στα Αρχεία (Αποθήκη Εγγράφων). '
                           'Κοιτάξτε στο φάκελο "Εγχειρίδια".', 3),
         ]),
    ]

    for cat_key, author_key, title, desc, days_ago, posts_data in discussions_data:
        disc = Discussion(
            title=title, description=desc,
            category_id=cats[cat_key].id,
            user_id=users[author_key].id,
            created_at=datetime.utcnow() - timedelta(days=days_ago),
        )
        db.session.add(disc)
        db.session.flush()

        for post_author_key, content, post_days_ago in posts_data:
            post = Post(
                content=content,
                discussion_id=disc.id,
                user_id=users[post_author_key].id,
                created_at=datetime.utcnow() - timedelta(days=post_days_ago),
            )
            db.session.add(post)

    # ─── NOTIFICATIONS ──────────────────────────────────────
    notifications = [
        Notification(
            user_id=users['admin'].id,
            title='Νέα έκθεση κοινωνικού συμβούλου',
            content='Η Μαρία Παπαδοπούλου υπέβαλε έκθεση για τη δομή «Ελπίδα».',
            notification_type='report_submitted',
            is_read=False,
            action_url='/registry/structures',
        ),
        Notification(
            user_id=users['admin'].id,
            title='Άδεια λήγει σύντομα',
            content='Η άδεια λειτουργίας του Ιδρύματος «Θεοτόκος» λήγει σε 60 ημέρες.',
            notification_type='license_expiry',
            is_read=False,
            action_url='/registry/structures',
        ),
        Notification(
            user_id=users['mpapadopoulou'].id,
            title='Προγραμματισμένη επιθεώρηση',
            content='Η επιθεώρηση στη δομή «Ευαγγελισμός» είναι σε 14 ημέρες.',
            notification_type='inspection_scheduled',
            is_read=True,
            read_at=datetime.utcnow() - timedelta(days=1),
        ),
        Notification(
            user_id=users['gnikolaou'].id,
            title='Έγκριση έκθεσης',
            content='Η έκθεσή σας για τη δομή «Αγία Ελένη» εγκρίθηκε.',
            notification_type='report_approved',
            is_read=True,
            read_at=datetime.utcnow() - timedelta(days=3),
        ),
    ]
    for n in notifications:
        db.session.add(n)

    # ─── COMMIT ALL ─────────────────────────────────────────
    db.session.commit()
    print("[seed] ✓ Demo data created successfully!")
    print(f"  Users: {User.query.count()}")
    print(f"  Structures: {Structure.query.count()}")
    print(f"  Inspections: {Inspection.query.count()}")
    print(f"  Sanction Decisions: {SanctionDecision.query.count()}")
    print(f"  Discussions: {Discussion.query.count()}")
    print(f"  Forum posts: {Post.query.count()}")


def _seed_decisions(db, users, s_agia_eleni, s_evangelismos, s_iliachtida,
                    s_ouranio, s_asklepios, s_asteri, today, Sanction, SanctionDecision, SanctionRule):
    """Seed 6 demo SanctionDecisions in various workflow stages."""
    from datetime import datetime, timedelta

    # 1. Draft — ΜΦΗ Αγία Ελένη, υπέρβαση δυναμικότητας
    dec1_sanction = Sanction(
        structure_id=s_agia_eleni.id, type='fine', amount=10000.00,
        imposed_date=today - timedelta(days=3), status='imposed',
        notes='Υπέρβαση δυναμικότητας κατά 15 ωφελούμενους.'
    )
    db.session.add(dec1_sanction)
    db.session.flush()
    db.session.add(SanctionDecision(
        sanction_id=dec1_sanction.id, status='draft',
        drafted_by=users['mpapadopoulou'].id,
        drafted_at=datetime.utcnow() - timedelta(days=3),
        violation_code='MFH_OVER_CAPACITY',
        inspection_finding='Βρέθηκαν 135 ωφελούμενοι σε χώρο δυναμικότητας 120.',
        calculated_amount=10000, final_amount=10000,
        justification='Πρώτη παράβαση — βασικό πρόστιμο.',
        obligor_name='Ελένη Δημητρίου', obligor_afm='012345678',
        obligor_doy='ΔΟΥ Αθηνών', obligor_address='Λεωφ. Κηφισίας 142, Αθήνα',
        amount_state=5000, amount_region=5000,
    ))

    # 2. Submitted — ΚΔΑΠ Ουράνιο Τόξο, ελλιπή πιστοποιητικά
    dec2_sanction = Sanction(
        structure_id=s_ouranio.id, type='fine', amount=3000.00,
        imposed_date=today - timedelta(days=7), status='imposed',
        notes='Ελλιπή πιστοποιητικά 2 παιδαγωγών.'
    )
    db.session.add(dec2_sanction)
    db.session.flush()
    db.session.add(SanctionDecision(
        sanction_id=dec2_sanction.id, status='submitted',
        drafted_by=users['mpapadopoulou'].id,
        drafted_at=datetime.utcnow() - timedelta(days=7),
        violation_code='KDAP_STAFF_CERTS',
        inspection_finding='Δύο παιδαγωγοί χωρίς ενημερωμένο πιστοποιητικό πρώτων βοηθειών.',
        calculated_amount=3000, final_amount=3000,
        justification='Πρώτη παράβαση — εντός ελαχίστου ορίου.',
        obligor_name='Αγγελική Μαυρίδου', obligor_afm='369258147',
        obligor_doy='ΔΟΥ Πειραιά', obligor_address='Ηρώων Πολυτεχνείου 12, Πειραιάς',
        amount_state=1500, amount_region=1500,
    ))

    # 3. Approved — ΚΔΑΠ Ηλιαχτίδα, λειτουργία χωρίς άδεια
    dec3_sanction = Sanction(
        structure_id=s_iliachtida.id, type='fine', amount=60000.00,
        imposed_date=today - timedelta(days=20), status='imposed',
        protocol_number='ΚΥΡΩ-2026/0070',
        notes='Λειτουργία χωρίς ενεργή άδεια.'
    )
    db.session.add(dec3_sanction)
    db.session.flush()
    db.session.add(SanctionDecision(
        sanction_id=dec3_sanction.id, status='approved',
        drafted_by=users['mpapadopoulou'].id,
        drafted_at=datetime.utcnow() - timedelta(days=20),
        violation_code='NO_LICENSE',
        inspection_finding='Η δομή λειτουργούσε με ληγμένη άδεια (170 ημέρες).',
        calculated_amount=60000, final_amount=60000,
        justification='Σοβαρότατη παράβαση — μέγιστο πρόστιμο Ν.5041/2023 §1.',
        approved_by=users['admin'].id,
        approved_at=datetime.utcnow() - timedelta(days=15),
        protocol_number=f'{today.year}/0001',
        obligor_name='Δημήτρης Παπανικολάου', obligor_afm='321654987',
        obligor_doy='ΔΟΥ Ελευσίνας', obligor_address='Ελευθερίου Βενιζέλου 23, Ελευσίνα',
        amount_state=30000, amount_region=30000,
    ))

    # 4. Notified — ΚΗΦΗ Ασκληπιός, παράβαση προσβασιμότητας
    dec4_sanction = Sanction(
        structure_id=s_asklepios.id, type='fine', amount=6000.00,
        imposed_date=today - timedelta(days=30), status='imposed',
        protocol_number='ΚΥΡΩ-2026/0065',
        notes='Έλλειψη ράμπας πρόσβασης σε βοηθητικούς χώρους.'
    )
    db.session.add(dec4_sanction)
    db.session.flush()
    db.session.add(SanctionDecision(
        sanction_id=dec4_sanction.id, status='notified',
        drafted_by=users['gnikolaou'].id,
        drafted_at=datetime.utcnow() - timedelta(days=30),
        violation_code='KIHI_ACCESSIBILITY',
        inspection_finding='Δεν υπάρχει ράμπα πρόσβασης ΑμεΑ στους βοηθητικούς χώρους.',
        calculated_amount=6000, final_amount=6000,
        justification='Πρώτη παράβαση — ποσό εντός νομοθετικού πλαισίου.',
        approved_by=users['admin'].id,
        approved_at=datetime.utcnow() - timedelta(days=25),
        protocol_number=f'{today.year}/0002',
        notified_at=datetime.utcnow() - timedelta(days=20),
        notification_method='registered_mail',
        payment_deadline=today + timedelta(days=40),
        appeal_deadline=today - timedelta(days=5),
        obligor_name='Δέσποινα Αλεξίου', obligor_afm='852963741',
        obligor_doy='ΔΟΥ Αμαρουσίου', obligor_address='28ης Οκτωβρίου 78, Μαρούσι',
        amount_state=3000, amount_region=3000,
    ))

    # 5. Paid — MFPAD Αστέρι, ελλιπής στελέχωση
    dec5_sanction = Sanction(
        structure_id=s_asteri.id, type='fine', amount=5000.00,
        imposed_date=today - timedelta(days=60), status='paid',
        protocol_number='ΚΥΡΩ-2026/0045',
        notes='Πρόστιμο για ελλιπή στελέχωση — εξοφλήθηκε.'
    )
    db.session.add(dec5_sanction)
    db.session.flush()
    db.session.add(SanctionDecision(
        sanction_id=dec5_sanction.id, status='paid',
        drafted_by=users['gnikolaou'].id,
        drafted_at=datetime.utcnow() - timedelta(days=60),
        violation_code='TERMS_VIOLATION',
        inspection_finding='Αναλογία προσωπικού 1:12 αντί 1:6.',
        calculated_amount=5000, final_amount=5000,
        justification='Πρώτη παράβαση — βασικό πρόστιμο.',
        approved_by=users['admin'].id,
        approved_at=datetime.utcnow() - timedelta(days=55),
        protocol_number=f'{today.year - 1}/0012',
        notified_at=datetime.utcnow() - timedelta(days=50),
        notification_method='in_person',
        payment_deadline=today - timedelta(days=10),
        appeal_deadline=today - timedelta(days=35),
        paid_at=datetime.utcnow() - timedelta(days=15),
        paid_amount=5000,
        obligor_name='Ελευθερία Κωστοπούλου', obligor_afm='951753864',
        obligor_doy='ΔΟΥ Περιστερίου', obligor_address='Ιπποκράτους 32, Περιστέρι',
        amount_state=2500, amount_region=2500,
    ))

    # 6. Overdue — ΜΦΗ Ευαγγελισμός, παράβαση υγιεινής
    dec6_sanction = Sanction(
        structure_id=s_evangelismos.id, type='fine', amount=8000.00,
        imposed_date=today - timedelta(days=90), status='imposed',
        protocol_number='ΚΥΡΩ-2026/0030',
        notes='Πρόστιμο 8.000€ για παράβαση υγιεινής — ΕΚΠΡΟΘΕΣΜΟ.'
    )
    db.session.add(dec6_sanction)
    db.session.flush()
    db.session.add(SanctionDecision(
        sanction_id=dec6_sanction.id, status='notified',
        drafted_by=users['mpapadopoulou'].id,
        drafted_at=datetime.utcnow() - timedelta(days=90),
        violation_code='HYGIENE',
        inspection_finding='Ακαταλληλότητα αποθηκευτικών χώρων τροφίμων.',
        calculated_amount=8000, final_amount=8000,
        justification='Δεύτερη παράβαση υγιεινής εντός έτους.',
        approved_by=users['admin'].id,
        approved_at=datetime.utcnow() - timedelta(days=85),
        protocol_number=f'{today.year - 1}/0008',
        notified_at=datetime.utcnow() - timedelta(days=80),
        notification_method='registered_mail',
        payment_deadline=today - timedelta(days=20),
        appeal_deadline=today - timedelta(days=65),
        obligor_name='Κωνσταντίνος Βλάχος', obligor_afm='987654321',
        obligor_doy='ΔΟΥ Πειραιά', obligor_address='Ακτή Μιαούλη 55, Πειραιάς',
        amount_state=4000, amount_region=4000,
    ))
    db.session.flush()
