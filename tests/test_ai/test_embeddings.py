"""Tests for embedding engine."""
import pytest

def test_chunk_text_basic():
    """Text chunker should split text into chunks."""
    from my_project.ai.embeddings import chunk_text
    text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph."
    chunks = chunk_text(text, chunk_size=30, overlap=5)
    assert len(chunks) >= 2
    assert all(hasattr(c, 'content') for c in chunks)

def test_chunk_text_preserves_content():
    """All original content should appear in at least one chunk."""
    from my_project.ai.embeddings import chunk_text
    text = "Alpha. Bravo. Charlie. Delta. Echo."
    chunks = chunk_text(text, chunk_size=20, overlap=5)
    combined = " ".join(c.content for c in chunks)
    for word in ["Alpha", "Bravo", "Charlie", "Delta", "Echo"]:
        assert word in combined

def test_chunk_text_empty():
    """Empty text should return empty list."""
    from my_project.ai.embeddings import chunk_text
    assert chunk_text("", chunk_size=100, overlap=10) == []
