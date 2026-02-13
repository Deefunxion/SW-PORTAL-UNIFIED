"""
Embedding engine for SW Portal.
Ported from Academicon — API-based embeddings via OpenAI.
No GPU/torch required.
"""
import os
import hashlib
import logging
from dataclasses import dataclass, field
from typing import List, Optional

import openai
import tiktoken

logger = logging.getLogger(__name__)

# ── Data classes ──

@dataclass
class TextChunk:
    content: str
    chunk_index: int = 0
    chunk_type: str = "text"
    metadata: dict = field(default_factory=dict)

@dataclass
class EmbeddingResult:
    embedding: List[float]
    model: str
    text_hash: str
    token_count: int

# ── Text Chunking ──

def chunk_text(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 200,
) -> List[TextChunk]:
    """Split text into overlapping chunks using semantic boundaries.

    Hierarchy of split points: paragraphs > sentences > clauses > words.
    """
    if not text or not text.strip():
        return []

    # Normalize whitespace
    text = text.strip()

    # Try paragraph splits first
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: List[TextChunk] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 <= chunk_size:
            current = f"{current}\n\n{para}".strip() if current else para
        else:
            if current:
                chunks.append(TextChunk(
                    content=current,
                    chunk_index=len(chunks),
                ))
            # If paragraph itself exceeds chunk_size, split by sentences
            if len(para) > chunk_size:
                sentence_chunks = _split_by_sentences(para, chunk_size, overlap)
                for sc in sentence_chunks:
                    sc.chunk_index = len(chunks)
                    chunks.append(sc)
            else:
                current = para
                continue
            current = ""

    if current:
        chunks.append(TextChunk(content=current, chunk_index=len(chunks)))

    # Apply overlap
    if overlap > 0 and len(chunks) > 1:
        chunks = _apply_overlap(chunks, overlap)

    return chunks


def _split_by_sentences(text: str, chunk_size: int, overlap: int) -> List[TextChunk]:
    """Split text by sentence boundaries."""
    import re
    sentences = re.split(r'(?<=[.!?;])\s+', text)
    chunks = []
    current = ""

    for sent in sentences:
        if len(current) + len(sent) + 1 <= chunk_size:
            current = f"{current} {sent}".strip() if current else sent
        else:
            if current:
                chunks.append(TextChunk(content=current))
            current = sent

    if current:
        chunks.append(TextChunk(content=current))

    return chunks


def _apply_overlap(chunks: List[TextChunk], overlap: int) -> List[TextChunk]:
    """Add overlapping context between consecutive chunks."""
    result = [chunks[0]]
    for i in range(1, len(chunks)):
        prev_text = chunks[i - 1].content
        overlap_text = prev_text[-overlap:] if len(prev_text) > overlap else prev_text
        new_content = f"{overlap_text} {chunks[i].content}".strip()
        result.append(TextChunk(
            content=new_content,
            chunk_index=i,
            chunk_type=chunks[i].chunk_type,
            metadata=chunks[i].metadata,
        ))
    return result


# ── Embedding Generation ──

def _get_client() -> openai.OpenAI:
    """Get OpenAI client."""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY environment variable not set")
    return openai.OpenAI(api_key=api_key)


def _text_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


def generate_embedding(
    text: str,
    model: str = "text-embedding-3-small",
) -> EmbeddingResult:
    """Generate embedding vector for text via OpenAI API."""
    client = _get_client()
    enc = tiktoken.encoding_for_model(model)
    token_count = len(enc.encode(text))

    response = client.embeddings.create(model=model, input=text)
    embedding = response.data[0].embedding

    return EmbeddingResult(
        embedding=embedding,
        model=model,
        text_hash=_text_hash(text),
        token_count=token_count,
    )


def generate_embeddings_batch(
    texts: List[str],
    model: str = "text-embedding-3-small",
) -> List[EmbeddingResult]:
    """Generate embeddings for multiple texts in one API call."""
    if not texts:
        return []

    client = _get_client()
    enc = tiktoken.encoding_for_model(model)

    response = client.embeddings.create(model=model, input=texts)

    results = []
    for i, data in enumerate(response.data):
        results.append(EmbeddingResult(
            embedding=data.embedding,
            model=model,
            text_hash=_text_hash(texts[i]),
            token_count=len(enc.encode(texts[i])),
        ))
    return results
