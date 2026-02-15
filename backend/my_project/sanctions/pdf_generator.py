"""PDF generator for sanction decision documents.

Generates administrative fine decisions matching the standard format
used by Greek Regional Authorities (Περιφέρεια Αττικής).
"""
import os
import tempfile
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_JUSTIFY, TA_LEFT
from reportlab.lib.colors import black, HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Page width for calculations
PAGE_WIDTH = A4[0]
CONTENT_WIDTH = PAGE_WIDTH - 5 * cm  # 2.5cm margins on each side


def _register_fonts():
    """Register Greek-capable fonts. Falls back gracefully."""
    font_paths = {
        'Arial': 'arial.ttf',
        'Arial-Bold': 'arialbd.ttf',
        'Arial-Italic': 'ariali.ttf',
    }
    # Try Windows font directory first, then common Linux paths
    font_dirs = [
        'C:/Windows/Fonts',
        '/usr/share/fonts/truetype/msttcorefonts',
        '/usr/share/fonts/truetype/dejavu',
        '/usr/share/fonts',
    ]
    registered = set()
    for name, filename in font_paths.items():
        for d in font_dirs:
            path = os.path.join(d, filename)
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                    registered.add(name)
                except Exception:
                    pass
                break
    return 'Arial' in registered


def _get_styles(has_arial):
    """Build paragraph styles for the document."""
    base_font = 'Arial' if has_arial else 'Helvetica'
    bold_font = 'Arial-Bold' if has_arial else 'Helvetica-Bold'
    italic_font = 'Arial-Italic' if has_arial else 'Helvetica-Oblique'

    return {
        'header_left': ParagraphStyle(
            'HeaderLeft', fontName=base_font, fontSize=8,
            leading=10, alignment=TA_LEFT,
        ),
        'header_right': ParagraphStyle(
            'HeaderRight', fontName=base_font, fontSize=9,
            leading=12, alignment=TA_RIGHT,
        ),
        'subject': ParagraphStyle(
            'Subject', fontName=bold_font, fontSize=11,
            leading=14, alignment=TA_CENTER, spaceBefore=6, spaceAfter=6,
        ),
        'body': ParagraphStyle(
            'Body', fontName=base_font, fontSize=10,
            leading=13, alignment=TA_JUSTIFY, spaceBefore=3, spaceAfter=3,
        ),
        'body_bold': ParagraphStyle(
            'BodyBold', fontName=bold_font, fontSize=10,
            leading=13, alignment=TA_JUSTIFY, spaceBefore=3, spaceAfter=3,
        ),
        'body_center': ParagraphStyle(
            'BodyCenter', fontName=bold_font, fontSize=11,
            leading=14, alignment=TA_CENTER, spaceBefore=12, spaceAfter=6,
        ),
        'numbered': ParagraphStyle(
            'Numbered', fontName=base_font, fontSize=9,
            leading=12, alignment=TA_JUSTIFY, leftIndent=20,
            spaceBefore=2, spaceAfter=2,
        ),
        'signature': ParagraphStyle(
            'Signature', fontName=base_font, fontSize=10,
            leading=13, alignment=TA_RIGHT, spaceBefore=6,
        ),
        'footer': ParagraphStyle(
            'Footer', fontName=base_font, fontSize=8,
            leading=10, alignment=TA_LEFT,
        ),
        'small': ParagraphStyle(
            'Small', fontName=base_font, fontSize=8,
            leading=10, alignment=TA_LEFT, spaceBefore=2, spaceAfter=2,
        ),
        '_base': base_font,
        '_bold': bold_font,
        '_italic': italic_font,
    }


def _format_amount(amount):
    """Format amount in Greek locale style."""
    if amount is None:
        return '—'
    return f'{amount:,.2f} €'.replace(',', '.').replace('.00 €', ',00 €')


def _format_date_gr(dt):
    """Format datetime to Greek date string."""
    if dt is None:
        return '../../....'
    if hasattr(dt, 'strftime'):
        return dt.strftime('%d/%m/%Y')
    return str(dt)


# Standard legal references (Έχοντας υπόψη) template
STANDARD_LEGAL_REFS = [
    'Τις διατάξεις του Ν.3852/2010 «Νέα Αρχιτεκτονική της Αυτοδιοίκησης '
    'και της Αποκεντρωμένης Διοίκησης – Πρόγραμμα Καλλικράτης» (ΦΕΚ Α\' 87).',
    'Τις διατάξεις του Π.Δ. 145/2010 «Οργανισμός της Περιφέρειας Αττικής» '
    '(ΦΕΚ Α\' 238), όπως τροποποιήθηκε και ισχύει.',
    'Τις διατάξεις του Ν.3861/2010 «Ενίσχυση της διαφάνειας με την υποχρεωτική '
    'ανάρτηση νόμων και πράξεων των κυβερνητικών, διοικητικών και αυτοδιοικητικών '
    'οργάνων στο διαδίκτυο "Πρόγραμμα Διαύγεια"» (ΦΕΚ Α\' 112).',
]


def generate_decision_pdf(decision, rule=None):
    """Generate a sanction decision PDF and return bytes.

    Args:
        decision: SanctionDecision model instance (with .sanction relation)
        rule: Optional SanctionRule for legal references

    Returns:
        bytes: PDF file content
    """
    has_arial = _register_fonts()
    styles = _get_styles(has_arial)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2.5 * cm, rightMargin=2.5 * cm,
    )

    story = []

    # ── 1. Header ──────────────────────────────────────────────────
    header_left = (
        '<b>ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ</b><br/>'
        'ΠΕΡΙΦΕΡΕΙΑ ΑΤΤΙΚΗΣ<br/>'
        'ΓΕΝΙΚΗ Δ/ΝΣΗ ΔΗΜΟΣΙΑΣ ΥΓΕΙΑΣ<br/>'
        '&amp; ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ<br/>'
        'Δ/ΝΣΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ<br/>'
        'ΤΜΗΜΑ ΚΟΙΝΩΝΙΚΗΣ ΑΛΛΗΛΕΓΓΥΗΣ'
    )
    protocol = decision.protocol_number or '......./........'
    ada = decision.ada_code or ''
    approved_date = _format_date_gr(decision.approved_at)

    header_right = (
        f'Αθήνα, {approved_date}<br/>'
        f'Αρ. Πρωτ.: {protocol}<br/>'
    )
    if ada:
        header_right += f'ΑΔΑ: {ada}<br/>'

    header_table = Table(
        [[
            Paragraph(header_left, styles['header_left']),
            Paragraph(header_right, styles['header_right']),
        ]],
        colWidths=[CONTENT_WIDTH * 0.55, CONTENT_WIDTH * 0.45],
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 12))
    story.append(HRFlowable(width='100%', thickness=1, color=black))
    story.append(Spacer(1, 8))

    # ── 2. Subject (ΘΕΜΑ) ──────────────────────────────────────────
    amount_str = _format_amount(decision.final_amount)
    subject_text = (
        f'ΘΕΜΑ: Επιβολή προστίμου ποσού {amount_str} '
        f'στην επιχείρηση «{decision.obligor_name or "..."}» '
        f'(ΑΦΜ: {decision.obligor_afm or "..."})'
    )
    story.append(Paragraph(subject_text, styles['subject']))
    story.append(Spacer(1, 8))

    # ── 3. Έχοντας υπόψη ──────────────────────────────────────────
    story.append(Paragraph('Έχοντας υπόψη:', styles['body_bold']))

    # Standard references
    for i, ref in enumerate(STANDARD_LEGAL_REFS, 1):
        story.append(Paragraph(f'{i}. {ref}', styles['numbered']))

    # Dynamic: applicable law
    ref_num = len(STANDARD_LEGAL_REFS) + 1
    legal_ref = (rule.legal_reference if rule else None) or 'Ν.5041/2023 αρ.100'
    story.append(Paragraph(
        f'{ref_num}. Τις διατάξεις του {legal_ref}, '
        'περί επιβολής κυρώσεων σε φορείς κοινωνικής φροντίδας.',
        styles['numbered'],
    ))
    ref_num += 1

    # Dynamic: inspection findings
    if decision.inspection_finding:
        story.append(Paragraph(
            f'{ref_num}. Το πόρισμα ελέγχου, σύμφωνα με το οποίο: '
            f'«{decision.inspection_finding}».',
            styles['numbered'],
        ))
        ref_num += 1

    # Dynamic: justification
    if decision.justification:
        story.append(Paragraph(
            f'{ref_num}. Την αιτιολογία της υπηρεσίας: '
            f'«{decision.justification}».',
            styles['numbered'],
        ))
        ref_num += 1

    story.append(Spacer(1, 10))

    # ── 4. ΑΠΟΦΑΣΙΖΟΥΜΕ ───────────────────────────────────────────
    story.append(Paragraph('ΑΠΟΦΑΣΙΖΟΥΜΕ', styles['body_center']))

    # Main decision text
    bold = styles['_bold']
    violation_name = ''
    if rule:
        violation_name = rule.violation_name
    elif decision.violation_code:
        violation_name = decision.violation_code

    decision_text = (
        f'Την επιβολή προστίμου ύψους <b>{amount_str}</b> '
        f'({_amount_in_words(decision.final_amount)}) '
        f'στον/στην <b>{decision.obligor_name or "..."}</b> '
        f'του/της {decision.obligor_father_name or "..."}, '
        f'με ΑΦΜ <b>{decision.obligor_afm or "..."}</b>, '
        f'ΔΟΥ {decision.obligor_doy or "..."}, '
        f'κάτοικο {decision.obligor_address or "..."}, '
        f'για παράβαση: <b>{violation_name}</b>.'
    )
    story.append(Paragraph(decision_text, styles['body']))
    story.append(Spacer(1, 6))

    # Payment terms
    payment_days = 60
    appeal_days = 15
    if rule:
        payment_days = rule.payment_deadline_days or 60
        appeal_days = rule.appeal_deadline_days or 15

    story.append(Paragraph(
        f'Το πρόστιμο καταβάλλεται εντός <b>{payment_days} ημερών</b> '
        f'από την κοινοποίηση της παρούσας.',
        styles['body'],
    ))

    # Revenue split
    state_amount = _format_amount(decision.amount_state)
    region_amount = _format_amount(decision.amount_region)
    state_ale = '1560989001'
    region_kae = '64008'
    if rule:
        state_ale = rule.revenue_split_state_ale or state_ale
        region_kae = rule.revenue_split_region_kae or region_kae

    story.append(Paragraph(
        f'Το ποσό κατανέμεται: <b>{state_amount}</b> υπέρ Κρατικού '
        f'Προϋπολογισμού (ΑΛΕ {state_ale}) και <b>{region_amount}</b> '
        f'υπέρ Περιφέρειας (ΚΑΕ {region_kae}).',
        styles['body'],
    ))

    # Appeal rights
    story.append(Paragraph(
        f'Κατά της παρούσας χωρεί ένσταση ενώπιον του αρμόδιου Διοικητικού '
        f'Δικαστηρίου εντός <b>{appeal_days} ημερών</b> από την κοινοποίησή της.',
        styles['body'],
    ))

    story.append(Spacer(1, 20))

    # ── 5. Πίνακας Αποδεκτών ──────────────────────────────────────
    story.append(HRFlowable(width='100%', thickness=0.5, color=black))
    story.append(Spacer(1, 6))
    story.append(Paragraph('ΠΙΝΑΚΑΣ ΑΠΟΔΕΚΤΩΝ', styles['body_bold']))

    story.append(Paragraph('<b>Α. Για ενέργεια:</b>', styles['small']))
    story.append(Paragraph(
        f'1. {decision.obligor_name or "Υπόχρεος"} '
        f'({decision.obligor_address or "..."})',
        styles['small'],
    ))
    story.append(Paragraph(
        f'2. ΔΟΥ {decision.obligor_doy or "..."} (για βεβαίωση εσόδου)',
        styles['small'],
    ))

    story.append(Paragraph('<b>Β. Για κοινοποίηση:</b>', styles['small']))
    recipients = [
        'Υπουργείο Κοινωνικής Συνοχής & Οικογένειας',
        'Γεν. Γραμματεία Κοινωνικής Αλληλεγγύης',
        'Αποκεντρωμένη Διοίκηση Αττικής',
        'Αρμόδιος Δήμος',
        'Αστυνομικό Τμήμα περιοχής',
    ]
    for i, r in enumerate(recipients, 1):
        story.append(Paragraph(f'{i}. {r}', styles['small']))

    story.append(Spacer(1, 20))

    # ── 6. Signature ──────────────────────────────────────────────
    sig_text = (
        'Ο Αντιπεριφερειάρχης<br/>'
        'Κοινωνικής Μέριμνας<br/><br/><br/>'
        '________________________'
    )
    story.append(Paragraph(sig_text, styles['signature']))

    # Build
    doc.build(story)
    return buffer.getvalue()


def _amount_in_words(amount):
    """Simple Greek amount-to-words for common amounts."""
    if amount is None:
        return '...'
    # For demo purposes, return formatted number description
    whole = int(amount)
    cents = int(round((amount - whole) * 100))
    parts = []
    if whole > 0:
        parts.append(f'{whole:,}'.replace(',', '.'))
    if cents > 0:
        parts.append(f'{cents}/100')
    return ' '.join(parts) + ' ευρώ' if parts else '0 ευρώ'
