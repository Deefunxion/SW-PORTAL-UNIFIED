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
    if Structure.query.count() >= 8:
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
        ('MFPAD', 'Μονάδα Φροντίδας Παιδιών και Ατόμων με Αναπηρία',
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
    for s in structures:
        db.session.add(s)
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
    print(f"  Discussions: {Discussion.query.count()}")
    print(f"  Forum posts: {Post.query.count()}")
