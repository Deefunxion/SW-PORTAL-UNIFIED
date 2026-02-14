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


def test_read_source_file_absolute_path(app, tmp_path):
    """_read_source_file should read a file given an absolute path."""
    with app.app_context():
        from my_project.ai.knowledge import _read_source_file

        # Create a temp file
        test_file = tmp_path / "test_doc.txt"
        test_file.write_text("Νόμος 4455/2017 περί αδειοδότησης ΚΔΑΠ", encoding="utf-8")

        result = _read_source_file(str(test_file))
        assert "Νόμος 4455/2017" in result


def test_read_source_file_missing_returns_empty(app):
    """_read_source_file should return empty string for missing files."""
    with app.app_context():
        from my_project.ai.knowledge import _read_source_file

        result = _read_source_file("/nonexistent/path/fake.txt")
        assert result == ""


def test_load_full_documents_groups_by_file(app, tmp_path):
    """load_full_documents should load full files from chunk source paths."""
    with app.app_context():
        from my_project.ai.knowledge import load_full_documents

        # Create temp source files
        file_a = tmp_path / "law_a.txt"
        file_a.write_text("Full text of Law A about ΚΔΑΠ licensing.", encoding="utf-8")

        file_b = tmp_path / "law_b.txt"
        file_b.write_text("Full text of Law B about ΜΦΗ inspections.", encoding="utf-8")

        # Simulate chunks from search_chunks()
        chunks = [
            {"source_path": str(file_a), "content": "chunk1", "similarity": 0.9},
            {"source_path": str(file_a), "content": "chunk2", "similarity": 0.85},
            {"source_path": str(file_b), "content": "chunk3", "similarity": 0.7},
        ]

        docs = load_full_documents(chunks)
        assert len(docs) == 2
        # file_a has 2 hits → ranked first
        assert "Law A" in docs[0]["content"]
        assert docs[0]["chunk_hits"] == 2
        assert "Law B" in docs[1]["content"]


def test_load_full_documents_respects_char_budget(app, tmp_path):
    """load_full_documents should stop loading when max_total_chars is reached."""
    with app.app_context():
        from my_project.ai.knowledge import load_full_documents

        # Create a large file and a small file
        big_file = tmp_path / "big.txt"
        big_file.write_text("X" * 5000, encoding="utf-8")

        small_file = tmp_path / "small.txt"
        small_file.write_text("Small content", encoding="utf-8")

        chunks = [
            {"source_path": str(big_file), "content": "chunk1", "similarity": 0.9},
            {"source_path": str(small_file), "content": "chunk2", "similarity": 0.8},
        ]

        # Budget only allows the big file
        docs = load_full_documents(chunks, max_total_chars=5000)
        assert len(docs) == 1
        assert len(docs[0]["content"]) == 5000


def test_load_full_documents_empty_chunks(app):
    """load_full_documents should return empty list for empty input."""
    with app.app_context():
        from my_project.ai.knowledge import load_full_documents
        assert load_full_documents([]) == []
