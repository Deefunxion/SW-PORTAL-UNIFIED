# tests/test_ai/test_knowledge.py
import pytest
import os

def test_parse_txt_content():
    """Should parse plain text files."""
    from my_project.ai.knowledge import parse_document_content
    result = parse_document_content("Test content here.", "test.txt", "txt")
    assert "Test content here." in result

def test_process_document_creates_chunks(app):
    """Processing a document should create chunks in the database."""
    with app.app_context():
        from my_project.ai.knowledge import process_document_text
        from my_project.models import FileChunk
        from my_project.extensions import db

        # Process a small text document
        process_document_text(
            text="First paragraph about social welfare.\n\nSecond paragraph about licensing.",
            source_path="test/doc.txt",
            file_name="doc.txt",
            file_type="txt",
        )

        chunks = FileChunk.query.filter_by(source_path="test/doc.txt").all()
        assert len(chunks) >= 1
        assert any("social welfare" in c.content for c in chunks)

def test_fallback_keyword_search(app):
    """Fallback search should find chunks by keyword without loading all into memory."""
    with app.app_context():
        from my_project.ai.knowledge import process_document_text, _fallback_keyword_search
        from my_project.extensions import db

        # Ingest a document with known content
        process_document_text(
            text="Η αδειοδότηση ΚΔΑΠ απαιτεί συγκεκριμένα δικαιολογητικά.\n\nΟι μονάδες φροντίδας ηλικιωμένων λειτουργούν βάσει νόμου.",
            source_path="test/fallback_search.txt",
            file_name="fallback_search.txt",
            file_type="txt",
        )

        results = _fallback_keyword_search("αδειοδότηση ΚΔΑΠ", limit=5)
        assert len(results) >= 1
        assert any("ΚΔΑΠ" in r["content"] for r in results)
