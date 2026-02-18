"""Document template rendering engine with placeholder resolution and PDF generation.

Renders DecisionTemplate body_template by filling {{placeholder}} syntax with
data from Structure models and user-provided field values.
"""
import re
import os
import html
from io import BytesIO
from datetime import date, datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont


def _register_fonts():
    """Register Greek-capable fonts. Returns font name to use."""
    font_dirs = [
        'C:/Windows/Fonts',
        '/usr/share/fonts/truetype/msttcorefonts',
        '/usr/share/fonts/truetype/dejavu',
    ]
    for d in font_dirs:
        path = os.path.join(d, 'arial.ttf')
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont('Greek', path))
                bold_path = os.path.join(d, 'arialbd.ttf')
                if os.path.exists(bold_path):
                    pdfmetrics.registerFont(TTFont('Greek-Bold', bold_path))
                return 'Greek'
            except Exception:
                pass
    # Fallback to DejaVu on Linux
    deja_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    if os.path.exists(deja_path):
        try:
            pdfmetrics.registerFont(TTFont('Greek', deja_path))
            return 'Greek'
        except Exception:
            pass
    return 'Helvetica'


def resolve_placeholders(template_body, structure, user_data):
    """
    Replace {{placeholder}} in template body with actual values.

    Args:
        template_body: HTML string with {{key}} placeholders
        structure: Structure model instance (or None)
        user_data: dict of user-provided field values

    Returns:
        Rendered HTML string
    """
    ctx = {}
    if structure:
        ctx.update({
            'όνομα_δομής': structure.name,
            'κωδικός_δομής': structure.code or '',
            'πόλη': structure.city or '',
            'οδός': structure.street or '',
            'ΤΚ': structure.postal_code or '',
            'εκπρόσωπος': structure.representative_name or '',
            'ΑΦΜ_εκπροσώπου': structure.representative_afm or '',
            'τηλέφωνο_εκπροσώπου': structure.representative_phone or '',
            'email_εκπροσώπου': structure.representative_email or '',
            'δυναμικότητα': str(structure.capacity or ''),
            'κατάσταση': structure.status or '',
            'ιδιοκτησία': structure.ownership or '',
            'αριθμός_αδείας': structure.license_number or '',
        })
        if structure.license_date:
            ctx['ημερομηνία_αδείας'] = structure.license_date.strftime('%d/%m/%Y')
        if structure.license_expiry:
            ctx['λήξη_αδείας'] = structure.license_expiry.strftime('%d/%m/%Y')
        if hasattr(structure, 'structure_type') and structure.structure_type:
            ctx['τύπος_δομής'] = structure.structure_type.name

    # Overlay user-provided data (takes precedence)
    ctx.update(user_data)

    # Format dates nicely
    for key, val in list(ctx.items()):
        if isinstance(val, (date, datetime)):
            ctx[key] = val.strftime('%d/%m/%Y')

    def replacer(match):
        key = match.group(1).strip()
        return str(ctx.get(key, f'[{key}]'))

    rendered = re.sub(r'\{\{(.+?)\}\}', replacer, template_body)
    return rendered


def generate_decision_pdf(rendered_html, title, recipients=None):
    """
    Generate a PDF from rendered HTML decision text.

    Args:
        rendered_html: HTML string (rendered template)
        title: Document title for header
        recipients: list of recipient dicts

    Returns:
        PDF bytes
    """
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            topMargin=2*cm, bottomMargin=2*cm,
                            leftMargin=2.5*cm, rightMargin=2.5*cm)

    font_name = _register_fonts()

    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(
        'GreekTitle', parent=styles['Title'],
        fontName=font_name, fontSize=14, alignment=TA_CENTER,
        spaceAfter=12))
    styles.add(ParagraphStyle(
        'GreekBody', parent=styles['Normal'],
        fontName=font_name, fontSize=11, alignment=TA_JUSTIFY,
        leading=16, spaceAfter=8))
    styles.add(ParagraphStyle(
        'GreekSmall', parent=styles['Normal'],
        fontName=font_name, fontSize=9, alignment=TA_JUSTIFY,
        leading=12, spaceAfter=4))

    story = []

    # Title
    story.append(Paragraph(title, styles['GreekTitle']))
    story.append(Spacer(1, 0.5*cm))

    # Body — split HTML into paragraphs
    clean = re.sub(r'<br\s*/?>', '\n', rendered_html)
    clean = re.sub(r'<p>', '', clean)
    clean = re.sub(r'</p>', '\n\n', clean)
    clean = re.sub(r'<[^>]+>', '', clean)
    clean = html.unescape(clean)

    for para_text in clean.split('\n\n'):
        text = para_text.strip()
        if text:
            story.append(Paragraph(text, styles['GreekBody']))

    # Recipients table
    if recipients:
        story.append(Spacer(1, 1*cm))
        story.append(Paragraph('ΠΙΝΑΚΑΣ ΑΠΟΔΕΚΤΩΝ', styles['GreekTitle']))
        for i, r in enumerate(recipients, 1):
            name = r.get('name', '')
            story.append(
                Paragraph(f'{i}. {name}', styles['GreekSmall']))

    doc.build(story)
    buf.seek(0)
    return buf.read()
