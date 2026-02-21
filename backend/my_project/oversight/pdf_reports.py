"""PDF generation for oversight reports (advisor reports -> IRIDA)."""
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_JUSTIFY, TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os
import re


def _register_fonts():
    """Register Greek-capable fonts."""
    for name, filename in [('Arial', 'arial.ttf'), ('Arial-Bold', 'arialbd.ttf')]:
        for d in ['C:/Windows/Fonts', '/usr/share/fonts/truetype/msttcorefonts',
                   '/usr/share/fonts/truetype/dejavu', '/usr/share/fonts']:
            path = os.path.join(d, filename)
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont(name, path))
                    return True
                except Exception:
                    pass
    return False


def generate_advisor_report_pdf(report):
    """Generate a PDF for an advisor report. Returns bytes."""
    has_arial = _register_fonts()
    base_font = 'Arial' if has_arial else 'Helvetica'
    bold_font = 'Arial-Bold' if has_arial else 'Helvetica-Bold'

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4,
                            leftMargin=2.5*cm, rightMargin=2.5*cm,
                            topMargin=2.5*cm, bottomMargin=2.5*cm)

    styles = {
        'title': ParagraphStyle('Title', fontName=bold_font, fontSize=14,
                                leading=18, alignment=TA_CENTER, spaceAfter=12),
        'subtitle': ParagraphStyle('Subtitle', fontName=base_font, fontSize=10,
                                   leading=13, alignment=TA_CENTER, spaceAfter=20),
        'heading': ParagraphStyle('Heading', fontName=bold_font, fontSize=11,
                                  leading=14, spaceBefore=12, spaceAfter=6),
        'body': ParagraphStyle('Body', fontName=base_font, fontSize=10,
                               leading=13, alignment=TA_JUSTIFY, spaceAfter=6),
    }

    story = []
    structure = report.structure

    story.append(Paragraph('ΑΝΑΦΟΡΑ ΚΟΙΝΩΝΙΚΟΥ ΣΥΜΒΟΥΛΟΥ', styles['title']))
    story.append(Paragraph(
        f'Δομή: {structure.name if structure else "—"} | '
        f'Ημ/νία: {report.drafted_date}',
        styles['subtitle']))

    story.append(Paragraph('Αξιολόγηση', styles['heading']))
    # Strip HTML tags for PDF (simple approach)
    clean_assessment = re.sub('<[^<]+?>', '', report.assessment or '')
    story.append(Paragraph(clean_assessment or '—', styles['body']))

    if report.recommendations:
        story.append(Paragraph('Συστάσεις / Προτάσεις', styles['heading']))
        clean_recs = re.sub('<[^<]+?>', '', report.recommendations)
        story.append(Paragraph(clean_recs or '—', styles['body']))

    story.append(Spacer(1, 40))
    author = report.author
    story.append(Paragraph(
        f'Συντάκτης: {author.username if author else "—"}',
        styles['body']))

    doc.build(story)
    return buffer.getvalue()
