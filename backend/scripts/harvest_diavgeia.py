#!/usr/bin/env python
"""
Harvest decisions from Diavgeia API for all Attica Social Welfare Directorates.

Phase 1: Download decision metadata from 7 units → diavgeia_harvest.json
Phase 2: Classify decisions (overtime excluded, everything else relevant)
Phase 3: Match relevant decisions to DB structures, create License records

Usage:
    python scripts/harvest_diavgeia.py --all-units              # Harvest all 7 units
    python scripts/harvest_diavgeia.py --unit 79005             # Harvest specific unit
    python scripts/harvest_diavgeia.py --skip-harvest --link    # Link to DB (dry run)
    python scripts/harvest_diavgeia.py --skip-harvest --link --apply  # Create License records
    python scripts/harvest_diavgeia.py --all-units --link --apply     # Full pipeline
    python scripts/harvest_diavgeia.py --from-year 2020         # Start from specific year
"""
import argparse
import json
import os
import re
import sys
import time
import unicodedata
import urllib.request
import urllib.error
import base64
from datetime import datetime

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# --- Constants ---

API_BASE = 'https://diavgeia.gov.gr/opendata'

# All 7 Attica Social Welfare Directorates (Δ/νσεις Κοινωνικής Μέριμνας)
UNITS = {
    '78977': 'Κεντρικός Τομέας',
    '79005': 'Βόρειος Τομέας',
    '78997': 'Νότιος Τομέας',
    '80888': 'Ανατολική Αττική',
    '100034109': 'Πειραιάς & Νήσοι',
    '81945': 'Δυτικός Τομέας',
    '80893': 'Δυτική Αττική',
}

DEFAULT_UNIT = '80888'  # backwards compat

# Map structure peripheral_unit values → Diavgeia unit ID
# Covers all 18 variants found in attica_structures.json
PE_TO_UNIT = {
    'ΚΕΝΤΡΙΚΟΣ ΤΟΜΕΑΣ': '78977',
    'ΚΕΝΤΡΙΚΟΣ ΤΟΜΕΑΣ ΑΘΗΝΩΝ': '78977',
    'ΑΝΑΤΟΛΙΚΟΣ ΤΟΜΕΑΣ': '78977',       # falls under Κεντρικός
    'ΒΟΡΕΙΟΣ ΤΟΜΕΑΣ': '79005',
    'ΒΟΡΕΙΟΣ ΤΟΜΕΑΣ ΑΘΗΝΩΝ': '79005',
    'ΝΟΤΙΟΣ ΤΟΜΕΑΣ': '78997',
    'ΝΟΤΙΟΣ ΤΟΜΕΑΣ ΑΘΗΝΩΝ': '78997',
    'ΑΝΑΤΟΛΙΚΗ ΑΤΤΙΚΗ': '80888',
    'ΑΝΑΤΟΛΙΚΗΣ ΑΤΤΙΚΗΣ': '80888',
    'ΠΕΙΡΑΙΩΣ ΚΑΙ ΝΗΣΩΝ': '100034109',
    'ΠΕΙΡΑΙΩΣ ΝΗΣΩΝ': '100034109',
    'ΠΕΙΡΑΙΩΣ & ΝΗΣΩΝ': '100034109',
    'ΠΕΙΡΑΙΩΣ -ΝΗΣΩΝ': '100034109',
    'ΠΕΙΡΑΙΑΣ': '100034109',
    'ΔΥΤΙΚΟΣ ΤΟΜΕΑΣ': '81945',
    'ΔΥΤΙΚΟΣ ΤΟΜΕΑΣ ΑΘΗΝΩΝ': '81945',
    'ΔΥΤΙΚΗ ΑΤΤΙΚΗ': '80893',
    'ΔΥΤΙΚΗΣ ΑΤΤΙΚΗΣ': '80893',
}

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
HARVEST_FILE = os.path.join(DATA_DIR, 'diavgeia_harvest.json')
PDF_DIR = os.path.join(DATA_DIR, 'diavgeia_pdfs')


def pe_to_unit_id(peripheral_unit):
    """Map a structure's peripheral_unit to a Diavgeia unit ID."""
    if not peripheral_unit:
        return None
    normed = strip_accents(str(peripheral_unit).strip().upper())
    return PE_TO_UNIT.get(normed)

# Only overtime decisions are excluded — everything else is relevant
OVERTIME_KEYWORDS = ['υπερωρ']

# Structure type identification from subject text
# Order matters: more specific patterns checked first
TYPE_PATTERNS = [
    ('KDAP-AMEA', [
        r'κδαπ[\s\-]*μεα', r'κδαπ[\s\-]*αμεα',
        r'κ\.?δ\.?α\.?π\.?[\s\-]*(?:μεα|αμεα)',
        r'δημιουργικ\w+\s+απασχόλησ\w+.*αναπηρ',
    ]),
    ('KDAP', [
        r'κδαπ(?![\s\-]*(?:μεα|αμεα))',
        r'κ\.?δ\.?α\.?π\.?(?![\s\-]*(?:μεα|αμεα))',
        r'δημιουργικ\w+\s+απασχόλησ\w+\s+παιδ',
    ]),
    ('CAMP', [
        r'κατασκήνωσ', r'κατασκηνωσ',
        r'παιδικ\w+\s+εξοχ', r'παιδικ\w+\s+κατασκ',
    ]),
    ('MFH', [
        r'μονάδ\w*\s+φροντίδ\w*\s+ηλικιωμέν',
        r'γηροκομ', r'ηλικιωμέν\w*.*μονάδ',
        r'φροντίδ\w+\s+ηλικ',
    ]),
    ('SYD', [
        r'στέγ\w*\s+υποστηριζόμεν',
        r'σ\.?υ\.?δ\.?\s', r'σ\.?υ\.?δ\.?$',
        r'υποστηριζόμεν\w*\s+διαβίωσ',
    ]),
    ('KAA', [
        r'αποθεραπ', r'αποκατάστασ', r'αποκαταστ',
    ]),
    ('KHFH', [
        r'κηφη', r'κ\.?η\.?φ\.?η',
        r'κέντρο\s+ημερήσι\w*\s+φροντίδ',
    ]),
    ('KDHF-KAA', [
        r'κέντρο\s+διημέρευσ', r'κδηφ',
    ]),
    ('MPP', [
        r'παιδικ\w*\s+προστασ',
    ]),
    ('DS', [
        r'παιδικ\w*\s+σταθμ', r'βρεφ\w*σταθμ', r'βρεφονηπια',
    ]),
    ('MFPAD', [
        r'προσχολικ\w*\s+αγωγ',
    ]),
]


# --- API Helpers ---

def api_get(path, params=None, auth=None):
    """Make a GET request to Diavgeia API."""
    url = f'{API_BASE}/{path}.json'
    if params:
        query = '&'.join(f'{k}={v}' for k, v in params.items() if v is not None)
        url = f'{url}?{query}'

    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    if auth:
        credentials = base64.b64encode(f'{auth[0]}:{auth[1]}'.encode()).decode()
        req.add_header('Authorization', f'Basic {credentials}')

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        print(f'    HTTP {e.code}: {url[:100]}')
        return None
    except Exception as e:
        print(f'    Error: {e}')
        return None


def download_pdf(ada, out_dir, auth=None):
    """Download the PDF document for a decision."""
    url = f'{API_BASE}/../api/decisions/{ada}/document'
    req = urllib.request.Request(url)
    if auth:
        credentials = base64.b64encode(f'{auth[0]}:{auth[1]}'.encode()).decode()
        req.add_header('Authorization', f'Basic {credentials}')

    out_path = os.path.join(out_dir, f'{ada}.pdf')
    if os.path.exists(out_path):
        return out_path

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            with open(out_path, 'wb') as f:
                f.write(resp.read())
        return out_path
    except Exception as e:
        print(f'    PDF download error for {ada}: {e}')
        return None


# --- Harvest ---

def harvest_decisions(from_year, to_year, unit_id, auth=None):
    """Harvest all decision metadata from Diavgeia in 180-day windows for a single unit."""
    all_decisions = []
    seen_adas = set()

    for year in range(from_year, to_year + 1):
        windows = [
            (f'{year}-01-01', f'{year}-06-29'),
            (f'{year}-06-29', f'{year}-12-26'),
        ]
        for from_date, to_date in windows:
            page = 0
            while True:
                params = {
                    'unit': unit_id,
                    'from_issue_date': from_date,
                    'to_issue_date': to_date,
                    'size': '500',
                    'page': str(page),
                    'status': 'published',
                }
                data = api_get('search', params, auth)
                if not data:
                    break

                decisions = data.get('decisions', [])
                if not decisions:
                    break

                for d in decisions:
                    ada = d.get('ada')
                    if ada and ada not in seen_adas:
                        seen_adas.add(ada)
                        issue_ts = d.get('issueDate')
                        issue_date = None
                        if issue_ts:
                            issue_date = datetime.fromtimestamp(issue_ts / 1000).strftime('%Y-%m-%d')

                        all_decisions.append({
                            'ada': ada,
                            'harvest_unit_id': unit_id,
                            'subject': d.get('subject', ''),
                            'protocol_number': d.get('protocolNumber', ''),
                            'issue_date': issue_date,
                            'decision_type': d.get('decisionTypeId', ''),
                            'signer_ids': d.get('signerIds', []),
                            'organization_id': d.get('organizationId', ''),
                            'unit_ids': d.get('unitIds', []),
                            'status': d.get('status', ''),
                            'document_url': d.get('documentUrl', ''),
                        })

                total = data['info'].get('total', 0)
                actual = data['info'].get('actualSize', 0)
                if actual < int(params['size']) or (page + 1) * int(params['size']) >= total:
                    break
                page += 1
                time.sleep(0.3)

            count = len(all_decisions)
            print(f'    {from_date} -> {to_date}: {data["info"].get("total", 0) if data else 0} found (running total: {count})')
            time.sleep(0.3)

    return all_decisions


def harvest_all_units(from_year, to_year, unit_ids, auth=None):
    """Harvest decisions from multiple units, dedup by ADA."""
    all_decisions = []
    seen_adas = set()

    # Load existing harvest to preserve already-fetched data
    if os.path.exists(HARVEST_FILE):
        with open(HARVEST_FILE, 'r', encoding='utf-8') as f:
            existing = json.load(f)
        for d in existing:
            if d['ada'] not in seen_adas:
                seen_adas.add(d['ada'])
                all_decisions.append(d)
        print(f'  Loaded {len(all_decisions)} existing decisions (dedup base)')

    for uid in unit_ids:
        label = UNITS.get(uid, uid)
        print(f'\n  --- Unit {uid}: {label} ---')

        # Skip units whose decisions are already in the file
        unit_count = sum(1 for d in all_decisions if d.get('harvest_unit_id') == uid)
        if unit_count > 0:
            print(f'    Already have {unit_count} decisions for this unit, skipping harvest')
            print(f'    (delete them from JSON or use --force-reharvest to re-fetch)')
            continue

        unit_decisions = harvest_decisions(from_year, to_year, uid, auth)

        # Merge with dedup
        new_count = 0
        for d in unit_decisions:
            if d['ada'] not in seen_adas:
                seen_adas.add(d['ada'])
                all_decisions.append(d)
                new_count += 1

        print(f'    Fetched {len(unit_decisions)}, {new_count} new (after dedup)')

        # Save incrementally after each unit (crash-safe)
        with open(HARVEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(all_decisions, f, ensure_ascii=False, indent=1)
        print(f'    Saved ({len(all_decisions)} total in file)')

    return all_decisions


# --- Classify ---

def classify_all(decisions):
    """Classify decisions: overtime (excluded) vs relevant (everything else)."""
    stats = {'relevant': 0, 'overtime': 0}
    for d in decisions:
        subject_lower = d.get('subject', '').lower()
        is_overtime = any(kw in subject_lower for kw in OVERTIME_KEYWORDS)
        d['category'] = 'overtime' if is_overtime else 'relevant'
        stats[d['category']] += 1
    return stats


# --- Entity Extraction & Type Identification ---

def strip_accents(s):
    """Remove Greek diacritical marks (accents, breathing, dialytika)."""
    nfkd = unicodedata.normalize('NFKD', s)
    return ''.join(c for c in nfkd if not unicodedata.combining(c))


    # Replace Latin look-alikes with Greek equivalents (common in OCR/copy-paste)
LATIN_TO_GREEK = str.maketrans('ABEHIKMNOPTXY', 'ΑΒΕΗΙΚΜΝΟΡΤΧΥ')


def normalize_name(s):
    """Aggressive normalization for matching."""
    s = str(s).strip().upper()
    s = strip_accents(s)  # Ξένοιαστο → ΞΕΝΟΙΑΣΤΟ (not ΞΈΝΟΙΑΣΤΟ)
    s = s.translate(LATIN_TO_GREEK)  # Latin A/I/Y → Greek Α/Ι/Υ
    for ch in '«»\u201c\u201d\u201e\u201f\u2018\u2019\u201a\u201b"\'.()':
        s = s.replace(ch, '')
    s = re.sub(r'\s+', ' ', s)
    s = s.strip(' .\u2013\u2014-')
    return s


def collapse_doubles(s):
    """Collapse consecutive identical characters for fuzzy matching.
    Handles Greek spelling variants: Χριστιαννούπολη → ΧΡΙΣΤΙΑΝΟΥΠΟΛΗ
    """
    return re.sub(r'(.)\1', r'\1', s)


def extract_entity_names(subject):
    """Extract potential entity/structure names from a decision subject.

    Tries multiple strategies in priority order:
    1. Text in guillemets «...»
    2. Text in chevrons <<...>>
    3. Text in curly/straight double quotes
    4. After 'με (την) επωνυμία' / 'με (τον) διακριτικό τίτλο'
    5. After 'της εταιρείας/του ιδρύματος/του σωματείου'
    6. After 'στην εταιρεία' (bare, without quotes)
    """
    names = []

    def _add(text):
        text = text.strip().strip('«»<>\u201c\u201d"')
        text = re.sub(r'\s+', ' ', text).strip()
        if 3 < len(text) < 80 and text not in names:
            names.append(text)

    # 1. Guillemets «...» — most reliable (59% of decisions)
    for m in re.finditer(r'«([^»]+)»', subject):
        _add(m.group(1))

    # 2. ASCII chevrons <<...>> (older data entry style)
    for m in re.finditer(r'<<([^>]+)>>', subject):
        _add(m.group(1))

    # 3. Curly double quotes
    for m in re.finditer(r'\u201c([^\u201d]+)\u201d', subject):
        _add(m.group(1))

    # 4. Straight double quotes "..."
    for m in re.finditer(r'"([^"]{3,78})"', subject):
        _add(m.group(1))

    # 5. After 'με (την) επωνυμία' / 'με (τον) διακριτικό τίτλο'
    for m in re.finditer(
        r'(?:με\s+(?:την?\s+)?επωνυμία|με\s+(?:τον?\s+)?διακριτικ\w+\s+τίτλο)\s+'
        r'[«<\u201c"]?(.+?)[»>\u201d"]?'
        r'(?:\s*[,.]|\s+(?:στ[οηε]ν?|που|και|με|ο\s|η\s|το\s)\s)',
        subject, re.IGNORECASE
    ):
        _add(m.group(1))

    # 6. After 'στην εταιρεία/στο ίδρυμα/στον/στο' (bare entity)
    for m in re.finditer(
        r'(?:στην?\s+εταιρεία|στο[νη]?\s+(?:φιλανθρωπικ\w+\s+)?(?:σωματε[ιί]ο|ίδρυμα))\s*'
        r'[«<\u201c"]?(.+?)[»>\u201d"]?'
        r'(?:\s*[,.]|\s+(?:στ[οηε]ν?\s|που\s|επί\s)|$)',
        subject, re.IGNORECASE
    ):
        _add(m.group(1))

    # 7. After 'της εταιρείας/του ιδρύματος/του σωματείου'
    for m in re.finditer(
        r'(?:της\s+(?:\w+\s+)?εταιρ\w+|του\s+(?:\w+\s+)?ιδρ[υύ]ματο\w*|'
        r'του\s+(?:\w+\s+)?σωματε[ιί]ου)\s+'
        r'[«<\u201c"]?(.+?)[»>\u201d"]?'
        r'(?:\s*[,.]|\s+(?:στ[οηε]ν?|που|με)\s|$)',
        subject, re.IGNORECASE
    ):
        _add(m.group(1))

    return names


def extract_municipality(subject):
    """Extract municipality name from subject."""
    m = re.search(
        r'Δήμο[υς]?\s+'
        r'([Α-ΩΆ-Ώα-ωά-ώ\s.\-]+?)'
        r'(?:\s*[,.]|\s+(?:στ[οηε]ν?|που|της|του|και|Ν\.)|$)',
        subject
    )
    if m:
        return normalize_name(m.group(1))
    return None


def identify_type(subject):
    """Identify structure type code from subject text."""
    s = subject.lower()
    for type_code, patterns in TYPE_PATTERNS:
        for pat in patterns:
            if re.search(pat, s):
                return type_code
    return None


def determine_license_type(subject):
    """Determine the license action type from the subject."""
    s = subject.lower()
    if any(kw in s for kw in ['ανάκληση', 'αναστολή', 'διακοπή λειτουργ']):
        return 'revocation'
    if 'τροποποίηση' in s:
        return 'amendment'
    if 'ανανέωση' in s or 'παράταση' in s:
        return 'renewal'
    if 'ίδρυση' in s and 'λειτουργ' in s:
        return 'establishment_and_operating'
    if 'ίδρυση' in s or 'ίδρυσ' in s:
        return 'establishment'
    if 'πρόστιμο' in s or 'κύρωση' in s:
        return 'sanction'
    if 'κατασκήνωσ' in s or 'εξοχ' in s:
        return 'camp_permit'
    if 'άδεια' in s or 'αδει' in s or 'λειτουργ' in s:
        return 'operating'
    if 'συγκρότηση' in s or 'επιτροπ' in s:
        return 'committee'
    return 'other'


# --- Matching Helpers ---

# Words that describe the structure TYPE generically — not distinctive for matching
TYPE_STOP_WORDS = {
    # Type descriptors
    'ΚΕΝΤΡΟ', 'ΚΕΝΤΡΑ', 'ΜΟΝΑΔΑ', 'ΜΟΝΑΔΕΣ', 'ΣΤΕΓΗ', 'ΣΤΕΓΕΣ',
    'ΔΗΜΙΟΥΡΓΙΚΗΣ', 'ΑΠΑΣΧΟΛΗΣΗΣ', 'ΠΑΙΔΙΩΝ', 'ΠΑΙΔΙΚΟΣ', 'ΠΑΙΔΙΚΗ', 'ΠΑΙΔΙΚΕΣ',
    'ΦΡΟΝΤΙΔΑΣ', 'ΦΡΟΝΤΙΔΑ', 'ΗΛΙΚΙΩΜΕΝΩΝ', 'ΒΡΕΦΟΝΗΠΙΑΚΟΣ',
    'ΥΠΟΣΤΗΡΙΖΟΜΕΝΗΣ', 'ΔΙΑΒΙΩΣΗΣ', 'ΑΠΟΘΕΡΑΠΕΙΑΣ', 'ΑΠΟΚΑΤΑΣΤΑΣΗΣ',
    'ΗΜΕΡΗΣΙΑΣ', 'ΠΡΟΣΧΟΛΙΚΗΣ', 'ΑΓΩΓΗΣ', 'ΔΙΑΠΑΙΔΑΓΩΓΗΣΗΣ',
    'ΚΑΤΑΣΚΗΝΩΣΗ', 'ΚΑΤΑΣΚΗΝΩΣΕΙΣ', 'ΚΑΤΑΣΚΗΝΩΣΗΣ', 'ΚΑΤΑΣΚΗΝΩΣΕΩΝ',
    'ΕΞΟΧΗ', 'ΕΞΟΧΕΣ', 'ΣΤΑΘΜΟΣ', 'ΣΤΑΘΜΟΙ',
    'ΠΡΟΣΤΑΣΙΑΣ', 'ΕΙΔΙΚΩΝ', 'ΑΤΟΜΩΝ',
    # Action words from subjects
    'ΑΔΕΙΑ', 'ΑΔΕΙΑΣ', 'ΙΔΡΥΣΗΣ', 'ΛΕΙΤΟΥΡΓΙΑΣ', 'ΧΟΡΗΓΗΣΗ',
    'ΤΡΟΠΟΠΟΙΗΣΗ', 'ΑΝΑΚΛΗΣΗ', 'ΑΝΑΝΕΩΣΗ', 'ΑΠΟΦΑΣΗ',
    # Common filler
    'ΚΑΙ', 'ΤΗΣ', 'ΤΟΥ', 'ΤΟ', 'ΤΩΝ', 'ΜΕ', 'ΣΤΟ', 'ΣΤΗΝ',
}


# Missing camp structures identified from unmatched Diavgeia decisions
# (name, city, foreas/operator)
MISSING_CAMPS = [
    ('Κατασκήνωση «Απόστολος Παύλος»', 'Μαρκόπουλο', 'Χριστιανικές Μαθητικές Ομάδες'),
    ('Κατασκηνώσεις ΔΕΣΜΟΣ', 'Κάλαμος', 'ΔΕΣΜΟΣ Α.Ε.'),
    ('Εξοχές Ελληνικής Αστυνομίας', 'Νέα Μάκρη', 'Ίδρυμα Μέριμνας Ελληνικής Αστυνομίας'),
    ('Κατασκηνώσεις Ι. Νεοφώτιστος', 'Ανάβυσσος', 'Ι. ΝΕΟΦΩΤΙΣΤΟΣ & ΣΙΑ Ε.Ε.'),
    ('Κατασκήνωση Ευαγγελικής Εκκλησίας της Ελλάδος', 'Κάλαμος', 'Ευαγγελική Εκκλησία της Ελλάδος'),
    ('Κατασκήνωση Τράπεζας Ελλάδος - Μετόχι', 'Αχαρνές', 'Τράπεζα της Ελλάδος'),
    ('Κατασκηνώσεις ΚΟΡΕΛΚΟ', 'Κάλαμος', 'ΚΟΡΕΛΚΟ Α.Ε.'),
    ('Κατασκήνωση Δήμου Αγίου Δημητρίου', 'Ραφήνα', 'Δήμος Αγίου Δημητρίου'),
    ('Κατασκηνώσεις «Μαρσόρι» Ιεράς Αρχιεπισκοπής Αθηνών', 'Ωρωπός', 'Ιερά Αρχιεπισκοπή Αθηνών'),
    ('Κατασκηνώσεις «Μουσούρη» Ιεράς Αρχιεπισκοπής Αθηνών', 'Ωρωπός', 'Ιερά Αρχιεπισκοπή Αθηνών'),
    ('Παιδικές Κατασκηνώσεις Ασημακοπούλου', 'Αφιδνές', 'ΝΙΚ. ΑΘ. ΑΣΗΜΑΚΟΠΟΥΛΟΣ Ο.Ε.'),
    ('Χαρούμενο Ακρογιάλι', 'Σούνιο', 'Ομοσπονδία Συλλόγων Υπ. Οικονομικών'),
    ('Χαρούμενο Χωριό - ΣΤΑΣΥ', 'Βαρυμπόμπη', 'ΣΤΑΘΕΡΕΣ ΣΥΓΚΟΙΝΩΝΙΕΣ Α.Ε.'),
    ('Κατασκήνωση Ελληνικής Ευαγγελικής Εκκλησίας', 'Κάλαμος', 'Ελληνική Ευαγγελική Εκκλησία'),
    ('Κατασκήνωση ΤΥΠΕΤ', 'Διόνυσος', 'Ταμείο Υγείας Προσωπικού Εθνικής Τράπεζας'),
    ('Παιδικές Εξοχές Δήμου Αθηναίων', 'Νέα Μάκρη', 'Δήμος Αθηναίων'),
    ('Κατασκήνωση «Παράδεισος του Παιδιού»', 'Ωρωπός', None),
    ('Κατασκήνωση «Φωλιά του Παιδιού»', 'Ωρωπός', None),
]


def create_missing_camps(dry_run=True):
    """Create missing camp structures identified from unmatched Diavgeia decisions."""
    from my_project import create_app
    from my_project.extensions import db
    from my_project.registry.models import Structure, StructureType

    app = create_app()
    with app.app_context():
        camp_type = StructureType.query.filter_by(code='CAMP').first()
        if not camp_type:
            print('  ERROR: CAMP structure type not found in DB')
            return

        # Find all existing camps for duplicate detection
        all_camps = Structure.query.filter_by(type_id=camp_type.id).all()
        existing_names = {normalize_name(s.name) for s in all_camps}

        # Find max CAMP-AA code number
        max_num = 0
        for s in all_camps:
            if s.code and s.code.startswith('CAMP-AA-'):
                try:
                    num = int(s.code.split('-')[-1])
                    if num > max_num:
                        max_num = num
                except (ValueError, IndexError):
                    pass

        next_num = max_num + 1
        print(f'  CAMP type_id: {camp_type.id}')
        print(f'  Existing camps: {len(all_camps)} (max CAMP-AA code: {max_num:04d})')
        print(f'  Will create up to {len(MISSING_CAMPS)} new camps from CAMP-AA-{next_num:04d}')
        print()

        created = 0
        for name, city, foreas in MISSING_CAMPS:
            norm = normalize_name(name)
            if norm in existing_names:
                print(f'    SKIP (exists): {name}')
                continue

            code = f'CAMP-AA-{next_num:04d}'

            if dry_run:
                print(f'    Would create: {code} — {name} ({city})')
            else:
                structure = Structure(
                    name=name[:300],
                    code=code,
                    type_id=camp_type.id,
                    city=city[:100] if city else None,
                    peripheral_unit='Ανατολική Αττική',
                    representative_name=foreas[:200] if foreas else None,
                )
                db.session.add(structure)
                print(f'    Created: {code} — {name} ({city})')

            existing_names.add(norm)
            next_num += 1
            created += 1

        if not dry_run and created:
            db.session.commit()

        action = 'Would create' if dry_run else 'Created'
        print(f'\n  {action}: {created} new camp structures')


def tokenize(s, filter_stop=False):
    """Split normalized name into meaningful tokens (3+ chars)."""
    s = normalize_name(s)
    # Remove common legal suffixes for cleaner token matching
    s = re.sub(r'\b(A\.?E\.?|Α\.?Ε\.?|Ε\.?Ε\.?|Ε\.?Π\.?Ε\.?|'
               r'Ο\.?Ε\.?|Ι\.?Κ\.?Ε\.?|ΝΠΔΔ|ΑΜΚΕ)\b', '', s)
    tokens = s.split()
    tokens = [t for t in tokens if len(t) > 2]
    if filter_stop:
        tokens = [t for t in tokens if t not in TYPE_STOP_WORDS]
    return tokens


def token_match_score(db_name, text):
    """What fraction of the DB name's distinctive tokens appear in the text?

    Filters out type-descriptive stop words to avoid false positives
    (e.g. "ΚΕΝΤΡΟ ΔΗΜΙΟΥΡΓΙΚΗΣ ΑΠΑΣΧΟΛΗΣΗΣ ΠΑΙΔΙΩΝ" matching every KDAP decision).
    """
    db_tokens = set(tokenize(db_name, filter_stop=True))
    text_tokens = set(tokenize(text, filter_stop=True))
    if not db_tokens or len(db_tokens) < 2:
        return 0.0  # Single-token names are too ambiguous for token matching
    return len(db_tokens & text_tokens) / len(db_tokens)


# --- Link to DB ---

def link_to_structures(decisions, dry_run=True):
    """Match non-overtime decisions to DB structures and create License records."""
    from my_project import create_app
    from my_project.extensions import db
    from my_project.registry.models import Structure, StructureType, License

    app = create_app()
    with app.app_context():
        # Load structure types: id → code
        type_code_by_id = {}
        for st in StructureType.query.all():
            type_code_by_id[st.id] = st.code

        # Load all structures
        structures = Structure.query.all()
        print(f'  {len(structures)} structures in DB')

        # Build indices
        by_type = {}          # type_code → [Structure]
        name_index = {}       # normalized_name → Structure
        city_index = {}       # (type_code, normalized_city) → [Structure]
        # PE-scoped: unit_id → [Structure]
        by_unit = {}

        for s in structures:
            code = type_code_by_id.get(s.type_id, 'UNKNOWN')
            by_type.setdefault(code, []).append(s)

            norm = normalize_name(s.name)
            name_index[norm] = s

            if s.city:
                key = (code, normalize_name(s.city))
                city_index.setdefault(key, []).append(s)

            # Map structure → unit for PE-scoped matching
            uid = pe_to_unit_id(s.peripheral_unit)
            if uid:
                by_unit.setdefault(uid, []).append(s)

        print(f'  Types in DB: {", ".join(f"{k}({len(v)})" for k, v in sorted(by_type.items()))}')
        print(f'  Structures by unit: {", ".join(f"{UNITS.get(k,k)[:8]}({len(v)})" for k, v in sorted(by_unit.items()))}')

        # Build PE-scoped type index: (unit_id, type_code) → [Structure]
        by_unit_type = {}
        for s in structures:
            code = type_code_by_id.get(s.type_id, 'UNKNOWN')
            uid = pe_to_unit_id(s.peripheral_unit)
            if uid:
                by_unit_type.setdefault((uid, code), []).append(s)

        # Check existing licenses by ADA (avoid duplicates)
        existing_adas = set()
        for lic in License.query.all():
            if lic.notes and 'ADA:' in lic.notes:
                ada_match = re.search(r'ADA:\s*(\S+)', lic.notes)
                if ada_match:
                    existing_adas.add(ada_match.group(1))

        # Process all non-overtime decisions
        relevant = [d for d in decisions if d.get('category') != 'overtime']
        print(f'  {len(relevant)} relevant decisions to process')
        print(f'  {len(existing_adas)} existing ADA licenses (will skip)')

        matched = 0
        skipped = 0
        unmatched_list = []
        match_log = []

        for d in relevant:
            ada = d['ada']
            if ada in existing_adas:
                skipped += 1
                continue

            subject = d.get('subject', '')
            harvest_uid = d.get('harvest_unit_id')

            # --- Step 1: Extract entity names ---
            entity_names = extract_entity_names(subject)

            # --- Step 2: Identify structure type ---
            detected_type = identify_type(subject)

            # --- Step 3: Get candidate structures (PE-scoped with fallback) ---
            # First try: structures in the same PE as the harvesting unit
            candidates = None
            if harvest_uid and detected_type:
                pe_candidates = by_unit_type.get((harvest_uid, detected_type), [])
                if pe_candidates:
                    candidates = pe_candidates

            # Fallback: all structures of that type (cross-PE decisions)
            if candidates is None:
                if detected_type and detected_type in by_type:
                    candidates = by_type[detected_type]
                else:
                    candidates = structures

            # --- Step 4: Multi-strategy matching ---
            best_match = None
            match_method = None
            subject_norm = normalize_name(subject)

            # Strategy A: DB name as substring of normalized subject
            best_len = 0
            for s in candidates:
                s_norm = normalize_name(s.name)
                if len(s_norm) > 5 and s_norm in subject_norm:
                    if len(s_norm) > best_len:
                        best_len = len(s_norm)
                        best_match = s
                        match_method = 'db_name_in_subject'

            # Strategy B: Match extracted entity names against DB
            if not best_match and entity_names:
                for entity in entity_names:
                    entity_norm = normalize_name(entity)

                    # B1: Exact match on normalized name
                    if entity_norm in name_index:
                        best_match = name_index[entity_norm]
                        match_method = 'entity_exact'
                        break

                    # B2: Entity substring of DB name or vice versa
                    for s in candidates:
                        s_norm = normalize_name(s.name)
                        if len(entity_norm) > 5 and len(s_norm) > 5:
                            if entity_norm in s_norm or s_norm in entity_norm:
                                best_match = s
                                match_method = 'entity_substring'
                                break
                    if best_match:
                        break

                    # B3: Token overlap (only for multi-word names)
                    best_score = 0.0
                    for s in candidates:
                        score = token_match_score(s.name, entity)
                        if score >= 0.6 and score > best_score:
                            best_score = score
                            best_match = s
                            match_method = f'entity_tokens({score:.0%})'
                    if best_match:
                        break

            # Strategy C: Full subject token overlap (last resort, strict)
            if not best_match:
                best_score = 0.0
                for s in candidates:
                    score = token_match_score(s.name, subject)
                    if score >= 0.75 and score > best_score:
                        best_score = score
                        best_match = s
                        match_method = f'subject_tokens({score:.0%})'

            # Strategy D: Collapsed double consonants (Χριστιαννούπολη → ΧΡΙΣΤΙΑΝΟΥΠΟΛΗ)
            if not best_match:
                subject_collapsed = collapse_doubles(subject_norm)
                best_len = 0
                for s in candidates:
                    s_collapsed = collapse_doubles(normalize_name(s.name))
                    if len(s_collapsed) > 5 and s_collapsed in subject_collapsed:
                        if len(s_collapsed) > best_len:
                            best_len = len(s_collapsed)
                            best_match = s
                            match_method = 'collapsed_doubles'

            # Strategy E: Distinctive single-token match (acronyms like ΤΥΠΕΤ, ΔΕΣΜΟΣ)
            if not best_match:
                for s in candidates:
                    s_tokens = tokenize(s.name, filter_stop=True)
                    if len(s_tokens) == 1 and len(s_tokens[0]) >= 5:
                        if s_tokens[0] in subject_norm:
                            best_match = s
                            match_method = 'distinctive_token'
                            break

            # Strategy F: Token stem prefix in entity (handles Greek declension:
            # ΑΣΗΜΑΚΟΠΟΥΛΟΣ ↔ ΑΣΗΜΑΚΟΠΟΥΛΟΥ, same root different endings)
            if not best_match and entity_names:
                for entity in entity_names:
                    entity_norm = normalize_name(entity)
                    for s in candidates:
                        s_tokens = tokenize(s.name, filter_stop=True)
                        for tok in s_tokens:
                            prefix = tok[:10]
                            if len(tok) >= 10 and prefix in entity_norm:
                                best_match = s
                                match_method = f'stem_prefix({prefix})'
                                break
                        if best_match:
                            break
                    if best_match:
                        break

            # --- Step 4b: PE fallback — retry with ALL structures of that type ---
            # If PE-scoped candidates found nothing, expand to full type list
            if not best_match and harvest_uid and detected_type:
                all_type_candidates = by_type.get(detected_type, [])
                pe_candidates = by_unit_type.get((harvest_uid, detected_type), [])
                if len(all_type_candidates) > len(pe_candidates):
                    fallback = [s for s in all_type_candidates if s not in pe_candidates]
                    if fallback:
                        # Re-run Strategy A on fallback
                        best_len = 0
                        for s in fallback:
                            s_norm = normalize_name(s.name)
                            if len(s_norm) > 5 and s_norm in subject_norm:
                                if len(s_norm) > best_len:
                                    best_len = len(s_norm)
                                    best_match = s
                                    match_method = 'db_name_in_subject(fallback)'

                        # Re-run Strategy B on fallback
                        if not best_match and entity_names:
                            for entity in entity_names:
                                entity_norm = normalize_name(entity)
                                for s in fallback:
                                    s_norm = normalize_name(s.name)
                                    if len(entity_norm) > 5 and len(s_norm) > 5:
                                        if entity_norm in s_norm or s_norm in entity_norm:
                                            best_match = s
                                            match_method = 'entity_substring(fallback)'
                                            break
                                if best_match:
                                    break

            # --- Step 5: Record result ---
            license_type = determine_license_type(subject)

            if best_match:
                matched += 1
                struct_code = best_match.code or f'id:{best_match.id}'

                d['matched_structure'] = struct_code
                d['match_method'] = match_method

                issue_date = None
                if d.get('issue_date'):
                    try:
                        issue_date = datetime.strptime(d['issue_date'], '%Y-%m-%d').date()
                    except ValueError:
                        pass

                match_log.append({
                    'ada': ada,
                    'harvest_unit_id': harvest_uid,
                    'structure_code': struct_code,
                    'structure_name': best_match.name[:60],
                    'method': match_method,
                    'license_type': license_type,
                    'detected_type': detected_type,
                    'date': d.get('issue_date', ''),
                    'subject': subject[:120],
                })

                if not dry_run:
                    doc_url = d.get('document_url') or f'https://diavgeia.gov.gr/doc/{ada}'

                    lic = License(
                        structure_id=best_match.id,
                        type=license_type,
                        protocol_number=d.get('protocol_number', '')[:100],
                        issued_date=issue_date,
                        status='active',
                        notes=(
                            f'ADA: {ada}\n'
                            f'Διαύγεια: '
                            f'https://diavgeia.gov.gr/decision/view/{ada}\n'
                            f'{subject[:300]}'
                        ),
                        file_path=doc_url[:500],
                    )
                    db.session.add(lic)
            else:
                d['matched_structure'] = None
                d['match_method'] = None
                unmatched_list.append({
                    'ada': ada,
                    'harvest_unit_id': harvest_uid,
                    'detected_type': detected_type,
                    'license_type': license_type,
                    'entities': entity_names[:3],
                    'date': d.get('issue_date', ''),
                    'subject': subject[:180],
                })

        if not dry_run and matched:
            db.session.commit()

        # --- Print results ---
        print(f'\n  {"=" * 50}')
        print(f'  RESULTS')
        print(f'  {"=" * 50}')
        print(f'  Matched:    {matched}')
        if dry_run:
            print(f'  (DRY RUN - would create {matched} License records)')
        else:
            print(f'  (APPLIED - created {matched} License records)')
        print(f'  Skipped:    {skipped} (already have ADA in License)')
        print(f'  Unmatched:  {len(unmatched_list)}')

        # Match breakdown by unit
        if match_log:
            unit_stats = {}
            for e in match_log:
                uid = e.get('harvest_unit_id', DEFAULT_UNIT)
                unit_stats[uid] = unit_stats.get(uid, 0) + 1
            print(f'\n  Matched by unit:')
            for uid, c in sorted(unit_stats.items(), key=lambda x: -x[1]):
                label = UNITS.get(uid, uid)
                # Count unmatched for this unit
                u_count = sum(1 for e in unmatched_list if e.get('harvest_unit_id', DEFAULT_UNIT) == uid)
                total = c + u_count
                rate = f'{c/total:.0%}' if total else '?'
                print(f'    {label}: {c} matched / {total} relevant ({rate})')

        # Match breakdown by method
        if match_log:
            methods = {}
            for e in match_log:
                m = e['method'].split('(')[0]  # strip score
                methods[m] = methods.get(m, 0) + 1
            print(f'\n  Match methods:')
            for m, c in sorted(methods.items(), key=lambda x: -x[1]):
                print(f'    {m}: {c}')

        # Match breakdown by type
        if match_log:
            types = {}
            for e in match_log:
                t = e['detected_type'] or '?'
                types[t] = types.get(t, 0) + 1
            print(f'\n  Matched by type:')
            for t, c in sorted(types.items(), key=lambda x: -x[1]):
                print(f'    {t}: {c}')

        # Print matched samples
        if match_log:
            print(f'\n  Sample matches (first 20):')
            for e in match_log[:20]:
                print(f'    {e["ada"]} ({e["date"]}) -> {e["structure_code"]} [{e["method"]}]')
                print(f'      {e["subject"]}')

        # Unmatched breakdown by type
        if unmatched_list:
            utypes = {}
            for e in unmatched_list:
                t = e['detected_type'] or '?'
                utypes[t] = utypes.get(t, 0) + 1
            print(f'\n  Unmatched by type:')
            for t, c in sorted(utypes.items(), key=lambda x: -x[1]):
                print(f'    {t}: {c}')

        # Print unmatched samples
        if unmatched_list:
            print(f'\n  Unmatched decisions (first 20):')
            for e in unmatched_list[:20]:
                type_tag = f'[{e["detected_type"]}]' if e['detected_type'] else '[?]'
                ents = ', '.join(e['entities']) if e['entities'] else '-'
                print(f'    {e["ada"]} {type_tag} ({e["license_type"]}) {e["date"]}')
                print(f'      Entities: {ents}')
                print(f'      {e["subject"]}')

        # Save match report as JSON
        report = {
            'summary': {
                'matched': matched,
                'skipped': skipped,
                'unmatched': len(unmatched_list),
                'total_relevant': len(relevant),
            },
            'match_log': match_log,
            'unmatched_log': unmatched_list,
        }
        report_file = os.path.join(DATA_DIR, 'diavgeia_match_report.json')
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=1)
        print(f'\n  Full report: {os.path.basename(report_file)}')


# --- CLI ---

def main():
    parser = argparse.ArgumentParser(description='Harvest Diavgeia decisions')
    parser.add_argument('--from-year', type=int, default=2016, help='Start year (default: 2016)')
    parser.add_argument('--to-year', type=int, default=2026, help='End year (default: 2026)')
    parser.add_argument('--all-units', action='store_true', help='Harvest all 7 Attica units')
    parser.add_argument('--unit', type=str, help='Harvest specific unit ID')
    parser.add_argument('--download-pdfs', action='store_true', help='Download PDFs for relevant decisions')
    parser.add_argument('--link', action='store_true', help='Link decisions to DB structures')
    parser.add_argument('--apply', action='store_true', help='Actually write License records to DB')
    parser.add_argument('--create-camps', action='store_true', help='Create missing camp structures from Diavgeia data')
    parser.add_argument('--skip-harvest', action='store_true', help='Skip harvest, use existing JSON')
    parser.add_argument('--force-reharvest', action='store_true', help='Re-fetch even if unit already in JSON')
    args = parser.parse_args()

    # Determine which units to harvest
    if args.all_units:
        target_units = list(UNITS.keys())
    elif args.unit:
        if args.unit not in UNITS:
            print(f'ERROR: Unknown unit {args.unit}. Known units:')
            for uid, name in UNITS.items():
                print(f'  {uid}: {name}')
            sys.exit(1)
        target_units = [args.unit]
    else:
        target_units = [DEFAULT_UNIT]

    # Load credentials from env
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
    username = os.getenv('DIAVGEIA_USERNAME')
    password = os.getenv('DIAVGEIA_PASSWORD')
    auth = (username, password) if username and password else None

    os.makedirs(DATA_DIR, exist_ok=True)

    unit_labels = ', '.join(UNITS.get(u, u) for u in target_units)
    print('=' * 60)
    print(f'Διαύγεια Harvest — {len(target_units)} unit(s): {unit_labels}')
    print('=' * 60)
    if auth:
        print(f'Auth: {username[:6]}***')
    else:
        print('Auth: anonymous')
    print()

    # Phase 1: Harvest
    if args.skip_harvest and os.path.exists(HARVEST_FILE):
        print('[1/3] Loading existing harvest...')
        with open(HARVEST_FILE, 'r', encoding='utf-8') as f:
            decisions = json.load(f)
        print(f'  Loaded {len(decisions)} decisions from {os.path.basename(HARVEST_FILE)}')

        # Backfill harvest_unit_id for old records that don't have it
        backfilled = 0
        for d in decisions:
            if 'harvest_unit_id' not in d:
                d['harvest_unit_id'] = DEFAULT_UNIT
                backfilled += 1
        if backfilled:
            print(f'  Backfilled harvest_unit_id={DEFAULT_UNIT} for {backfilled} legacy records')
    else:
        print(f'[1/3] Harvesting decisions ({args.from_year}-{args.to_year})...')
        if args.force_reharvest and os.path.exists(HARVEST_FILE):
            # Remove existing records for target units before re-fetching
            with open(HARVEST_FILE, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            kept = [d for d in existing if d.get('harvest_unit_id') not in target_units]
            with open(HARVEST_FILE, 'w', encoding='utf-8') as f:
                json.dump(kept, f, ensure_ascii=False, indent=1)
            print(f'  Cleared {len(existing) - len(kept)} records for target units, kept {len(kept)}')

        decisions = harvest_all_units(args.from_year, args.to_year, target_units, auth)
        print(f'\n  Total in file: {len(decisions)} unique decisions')

    # Phase 2: Classify
    print(f'\n[2/3] Classifying decisions...')
    stats = classify_all(decisions)
    print(f'  Relevant:  {stats["relevant"]} (licensing, committees, admin)')
    print(f'  Overtime:  {stats["overtime"]} (excluded)')

    # Show per-unit decision counts
    unit_counts = {}
    for d in decisions:
        uid = d.get('harvest_unit_id', DEFAULT_UNIT)
        unit_counts[uid] = unit_counts.get(uid, 0) + 1
    print(f'\n  Decisions per unit:')
    for uid, c in sorted(unit_counts.items(), key=lambda x: -x[1]):
        label = UNITS.get(uid, uid)
        print(f'    {label} ({uid}): {c}')

    # Show type breakdown for relevant decisions
    relevant = [d for d in decisions if d['category'] != 'overtime']
    type_counts = {}
    for d in relevant:
        t = identify_type(d.get('subject', '')) or '?'
        type_counts[t] = type_counts.get(t, 0) + 1
    print(f'\n  Type breakdown:')
    for t, c in sorted(type_counts.items(), key=lambda x: -x[1]):
        print(f'    {t}: {c}')

    # Download PDFs
    if args.download_pdfs:
        os.makedirs(PDF_DIR, exist_ok=True)
        print(f'\n  Downloading PDFs for {len(relevant)} relevant decisions...')
        downloaded = 0
        for d in relevant:
            path = download_pdf(d['ada'], PDF_DIR, auth)
            if path:
                downloaded += 1
                d['pdf_path'] = path
            time.sleep(0.5)
        print(f'  Downloaded: {downloaded}/{len(relevant)}')
        with open(HARVEST_FILE, 'w', encoding='utf-8') as f:
            json.dump(decisions, f, ensure_ascii=False, indent=1)

    # Phase 2.5: Create missing camps (if requested)
    if args.create_camps:
        print(f'\n[2.5/3] Creating missing camp structures...')
        if not args.apply:
            print('  DRY RUN — pass --apply to write to DB')
        create_missing_camps(dry_run=not args.apply)

    # Phase 3: Link to DB
    if args.link:
        print(f'\n[3/3] Linking to DB structures...')
        if not args.apply:
            print('  DRY RUN — pass --apply to create License records')
        link_to_structures(decisions, dry_run=not args.apply)
    else:
        print(f'\n[3/3] Skipped (pass --link to match with DB structures)')

    # Save final version with categories + match results
    with open(HARVEST_FILE, 'w', encoding='utf-8') as f:
        json.dump(decisions, f, ensure_ascii=False, indent=1)

    print('\nDone.')


if __name__ == '__main__':
    main()
