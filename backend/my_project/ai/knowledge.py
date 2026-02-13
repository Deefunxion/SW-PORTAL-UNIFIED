"""
Knowledge service for SW Portal.
Document parsing, chunking, embedding, and vector search.
Adapted from Academicon's knowledge_service.py.
"""
import os
import hashlib
import logging
from typing import List, Optional, Dict, Any

from my_project.extensions import db
from my_project.models import DocumentIndex, FileChunk
from my_project.ai.embeddings import chunk_text, generate_embedding, generate_embeddings_batch

logger = logging.getLogger(__name__)


# ── Document Parsing ──

def parse_document_content(content_or_path: str, filename: str, file_type: str) -> str:
    """Parse document and extract text content.

    For txt/md: content_or_path IS the text content.
    For pdf/docx: content_or_path is the file path on disk.
    """
    file_type = file_type.lower().strip(".")

    if file_type in ("txt", "md"):
        return content_or_path

    if file_type == "pdf":
        return _parse_pdf(content_or_path)

    if file_type == "docx":
        return _parse_docx(content_or_path)

    logger.warning(f"Unsupported file type: {file_type}")
    return ""


def _parse_pdf(file_path: str) -> str:
    """Extract text from PDF using PyMuPDF."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
        return "\n\n".join(text_parts)
    except Exception as e:
        logger.error(f"PDF parsing error for {file_path}: {e}")
        return ""


def _parse_docx(file_path: str) -> str:
    """Extract text from DOCX."""
    try:
        from docx import Document
        doc = Document(file_path)
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        logger.error(f"DOCX parsing error for {file_path}: {e}")
        return ""


# ── Document Processing Pipeline ──

def process_document_text(
    text: str,
    source_path: str,
    file_name: str,
    file_type: str,
    generate_vectors: bool = False,
) -> DocumentIndex:
    """Process text into chunks and optionally generate embeddings.

    Args:
        text: The full text content of the document.
        source_path: Path relative to content/ directory.
        file_name: Original filename.
        file_type: File extension (pdf, docx, txt).
        generate_vectors: If True, call OpenAI API for embeddings.
    """
    # Check if already processed
    existing = DocumentIndex.query.filter_by(file_path=source_path).first()
    text_hash = hashlib.sha256(text.encode()).hexdigest()

    if existing and existing.file_hash == text_hash and existing.status == "ready":
        logger.info(f"Document already processed: {source_path}")
        return existing

    # Create or update document index
    if existing:
        doc_index = existing
        # Delete old chunks
        FileChunk.query.filter_by(document_id=doc_index.id).delete()
    else:
        doc_index = DocumentIndex(
            file_path=source_path,
            file_name=file_name,
            file_type=file_type,
        )
        db.session.add(doc_index)

    doc_index.status = "processing"
    doc_index.file_hash = text_hash
    db.session.flush()  # Get the ID

    # Chunk the text
    chunks = chunk_text(text, chunk_size=500, overlap=100)

    if not chunks:
        doc_index.status = "ready"
        doc_index.chunk_count = 0
        db.session.commit()
        return doc_index

    # Generate embeddings if requested
    embeddings = []
    if generate_vectors:
        try:
            embeddings = generate_embeddings_batch(
                [c.content for c in chunks]
            )
        except Exception as e:
            logger.error(f"Embedding generation failed for {source_path}: {e}")
            embeddings = []

    # Store chunks
    for i, chunk in enumerate(chunks):
        file_chunk = FileChunk(
            document_id=doc_index.id,
            source_path=source_path,
            content=chunk.content,
            chunk_index=i,
            chunk_type=chunk.chunk_type,
            text_hash=hashlib.sha256(chunk.content.encode()).hexdigest()[:16],
        )
        if embeddings and i < len(embeddings):
            file_chunk.embedding = embeddings[i].embedding
            file_chunk.embedding_model = embeddings[i].model

        db.session.add(file_chunk)

    doc_index.chunk_count = len(chunks)
    doc_index.status = "ready"
    db.session.commit()

    logger.info(f"Processed {source_path}: {len(chunks)} chunks")
    return doc_index


def process_file(file_path: str, generate_vectors: bool = False) -> Optional[DocumentIndex]:
    """Process a file from the filesystem into chunks."""
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return None

    file_name = os.path.basename(file_path)
    file_type = file_name.rsplit(".", 1)[-1] if "." in file_name else "txt"

    if file_type in ("txt", "md"):
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
    else:
        text = parse_document_content(file_path, file_name, file_type)

    if not text.strip():
        logger.warning(f"No text extracted from {file_path}")
        return None

    return process_document_text(
        text=text,
        source_path=file_path,
        file_name=file_name,
        file_type=file_type,
        generate_vectors=generate_vectors,
    )


# ── Vector Search ──

def search_chunks(
    query: str,
    limit: int = 5,
    similarity_threshold: float = 0.3,
) -> List[Dict[str, Any]]:
    """Search for relevant document chunks using vector similarity.

    Uses pgvector's cosine distance operator for O(log n) search.
    """
    try:
        query_embedding_result = generate_embedding(query)
        query_vector = query_embedding_result.embedding
    except Exception as e:
        logger.error(f"Failed to generate query embedding: {e}")
        return _fallback_keyword_search(query, limit)

    # pgvector cosine distance search (requires PostgreSQL + pgvector)
    try:
        results = db.session.query(
            FileChunk,
            FileChunk.embedding.cosine_distance(query_vector).label("distance")
        ).filter(
            FileChunk.embedding.isnot(None)
        ).order_by(
            "distance"
        ).limit(limit * 2).all()
    except Exception as e:
        logger.warning(f"Vector search unavailable (SQLite?): {e}")
        db.session.rollback()
        return _fallback_keyword_search(query, limit)

    chunks = []
    for chunk, distance in results:
        similarity = 1 - distance  # cosine_distance → similarity
        if similarity >= similarity_threshold:
            chunks.append({
                "content": chunk.content,
                "source_path": chunk.source_path,
                "chunk_type": chunk.chunk_type,
                "similarity": round(similarity, 4),
                "document_id": chunk.document_id,
            })

    return chunks[:limit]


def _fallback_keyword_search(query: str, limit: int) -> List[Dict[str, Any]]:
    """Keyword search fallback using SQL LIKE (no full-table scan in Python)."""
    keywords = [kw for kw in query.lower().split() if len(kw) >= 2]
    if not keywords:
        return []

    # Build OR filter: match any keyword via SQL LIKE
    from sqlalchemy import or_, func
    filters = [func.lower(FileChunk.content).contains(kw) for kw in keywords]
    results = FileChunk.query.filter(or_(*filters)).limit(limit * 3).all()

    # Score and sort by number of keywords matched
    scored = []
    for chunk in results:
        content_lower = chunk.content.lower()
        score = sum(1 for kw in keywords if kw in content_lower)
        scored.append({
            "content": chunk.content,
            "source_path": chunk.source_path,
            "chunk_type": chunk.chunk_type,
            "similarity": score / len(keywords),
            "document_id": chunk.document_id,
        })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:limit]
