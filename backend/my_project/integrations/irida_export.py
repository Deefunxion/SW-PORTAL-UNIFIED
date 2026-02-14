"""
Ίριδα (ΣΗΔΕ) — Level 2 Integration: Export for manual import.

Generates metadata JSON + document bundles that can be imported
into Ίριδα via the "Εισαγωγή Εγγράφου" (§4.13) workflow.

Workflow:
  Πύλη: "Εξαγωγή για Ίριδα" button →
    → Downloads ZIP (metadata.json + document.pdf) →
    → Γραμματεία imports into Ίριδα via "Εισαγωγή Εγγράφου" →
    → Ίριδα assigns protocol number →
    → User enters protocol number back in Πύλη
"""

import json
import os
import zipfile
import tempfile
from datetime import datetime


# Ίριδα document type mapping
IRIDA_TYPE_MAP = {
    'inspection_report': 'Πρακτικό Ελέγχου',
    'advisor_report': 'Έκθεση Αξιολόγησης Κοιν. Συμβούλου',
    'license': 'Απόφαση Αδειοδότησης',
    'sanction': 'Απόφαση Κύρωσης',
}


def _generate_subject(document_type, record):
    """Generate a descriptive Greek subject line for Ίριδα."""
    structure_name = ''
    if hasattr(record, 'structure') and record.structure:
        structure_name = record.structure.name

    subjects = {
        'inspection_report': f'Πρακτικό ελέγχου δομής «{structure_name}»',
        'advisor_report': f'Έκθεση αξιολόγησης δομής «{structure_name}»',
        'license': f'Αδειοδότηση δομής «{structure_name}»',
        'sanction': f'Κύρωση δομής «{structure_name}»',
    }
    return subjects.get(document_type, f'Έγγραφο — {structure_name}')


def _get_structure_folder(record):
    """Determine Ίριδα folder name from structure type."""
    if hasattr(record, 'structure') and record.structure:
        st = record.structure
        if hasattr(st, 'structure_type') and st.structure_type:
            return st.structure_type.name
    return 'Γενικά'


def export_metadata(document_type, record):
    """
    Generate Ίριδα-compatible metadata for a document.

    Args:
        document_type: 'inspection_report' | 'advisor_report' | 'license' | 'sanction'
        record: SQLAlchemy model instance

    Returns:
        dict with Ίριδα metadata fields
    """
    protocol = getattr(record, 'protocol_number', None)

    return {
        'irida_version': '2.1.22',
        'export_date': datetime.utcnow().isoformat(),
        'document_type': IRIDA_TYPE_MAP.get(document_type, 'Έγγραφο'),
        'subject': _generate_subject(document_type, record),
        'folder': _get_structure_folder(record),
        'priority': 'Κανονική',
        'classification': 'Αδιαβάθμητο',
        'protocol_number': protocol,
        'related_structure': record.structure.name if hasattr(record, 'structure') and record.structure else None,
        'source_system': 'Πύλη Κοινωνικής Μέριμνας',
        'record_id': record.id,
        'record_type': document_type,
    }


def create_export_zip(document_type, record, upload_folder):
    """
    Create a ZIP file containing metadata.json and the attached document.

    Args:
        document_type: document type key
        record: SQLAlchemy model instance
        upload_folder: base path for uploaded files

    Returns:
        path to the temporary ZIP file
    """
    metadata = export_metadata(document_type, record)

    # Create temp ZIP
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.zip', prefix='irida_export_')
    tmp_path = tmp.name
    tmp.close()

    with zipfile.ZipFile(tmp_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Always include metadata
        zf.writestr('metadata.json', json.dumps(metadata, ensure_ascii=False, indent=2))

        # Include attached file if available
        file_path = getattr(record, 'file_path', None)
        if file_path:
            full_path = os.path.join(upload_folder, file_path) if not os.path.isabs(file_path) else file_path
            if os.path.exists(full_path):
                zf.write(full_path, os.path.basename(full_path))

    return tmp_path
