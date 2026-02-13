# tests/test_ai/test_models.py
import pytest

def test_file_chunk_creation(app):
    """FileChunk model should store content and metadata."""
    with app.app_context():
        from my_project.extensions import db
        from my_project.models import FileChunk

        chunk = FileChunk(
            source_path="content/test.pdf",
            content="Test content for embedding",
            chunk_index=0,
            chunk_type="text",
        )
        db.session.add(chunk)
        db.session.commit()

        saved = FileChunk.query.filter_by(source_path="content/test.pdf").first()
        assert saved is not None
        assert saved.content == "Test content for embedding"
        assert saved.chunk_index == 0

def test_document_index_creation(app):
    """DocumentIndex should track processed documents."""
    with app.app_context():
        from my_project.extensions import db
        from my_project.models import DocumentIndex

        doc = DocumentIndex(
            file_path="content/ΝΟΜΟΘΕΣΙΑ/law1.pdf",
            file_name="law1.pdf",
            file_type="pdf",
            chunk_count=15,
            status="ready",
        )
        db.session.add(doc)
        db.session.commit()

        saved = DocumentIndex.query.filter_by(file_path="content/ΝΟΜΟΘΕΣΙΑ/law1.pdf").first()
        assert saved is not None
        assert saved.status == "ready"
        assert saved.chunk_count == 15
