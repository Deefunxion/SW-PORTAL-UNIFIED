#!/usr/bin/env python
"""
Ingest documents from content/ directory into the knowledge base.
Parses files, chunks text, and generates embeddings via OpenAI API.

Usage:
    python scripts/ingest_documents.py                  # Chunk only (no embeddings)
    python scripts/ingest_documents.py --embed           # Chunk + generate embeddings
    python scripts/ingest_documents.py --embed --dir content/ΝΟΜΟΘΕΣΙΑ  # Specific dir
    python scripts/ingest_documents.py --embed --reset   # Clear + re-ingest everything
"""
import os
import sys
import argparse
import time

# Fix Unicode output on Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from my_project import create_app
from my_project.extensions import db
from my_project.ai.knowledge import process_file
from my_project.models import DocumentIndex, FileChunk

SUPPORTED_EXTENSIONS = {'.txt', '.md'}


def find_documents(base_dir: str) -> list:
    """Recursively find all supported documents."""
    documents = []
    for root, dirs, files in os.walk(base_dir):
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                documents.append(os.path.join(root, fname))
    return sorted(documents)


def main():
    parser = argparse.ArgumentParser(description="Ingest documents into knowledge base")
    parser.add_argument("--embed", action="store_true", help="Generate embeddings (requires OPENAI_API_KEY)")
    parser.add_argument("--dir", default=None, help="Specific directory to ingest (default: content/)")
    parser.add_argument("--reset", action="store_true", help="Clear all existing chunks before ingesting")
    args = parser.parse_args()

    app = create_app()

    with app.app_context():
        if args.reset:
            print("Clearing existing knowledge base...")
            FileChunk.query.delete()
            DocumentIndex.query.delete()
            db.session.commit()
            print("Done.")

        # Find content directory
        content_dir = args.dir or os.path.join(
            os.path.dirname(__file__), '..', '..', 'content'
        )
        content_dir = os.path.abspath(content_dir)

        if not os.path.exists(content_dir):
            print(f"Content directory not found: {content_dir}")
            print("Make sure the content/ directory exists with documents.")
            sys.exit(1)

        documents = find_documents(content_dir)
        print(f"Found {len(documents)} documents in {content_dir}")

        if not documents:
            print("No supported documents found.")
            return

        success = 0
        errors = 0
        start_time = time.time()

        for i, doc_path in enumerate(documents, 1):
            rel_path = os.path.relpath(doc_path, content_dir)
            print(f"[{i}/{len(documents)}] Processing: {rel_path}...", end=" ", flush=True)

            try:
                result = process_file(doc_path, generate_vectors=args.embed)
                if result:
                    print(f"OK ({result.chunk_count} chunks)")
                    success += 1
                else:
                    print("SKIP (no content)")
            except Exception as e:
                print(f"ERROR: {e}")
                errors += 1

        elapsed = time.time() - start_time
        total_chunks = FileChunk.query.count()
        embedded = FileChunk.query.filter(FileChunk.embedding.isnot(None)).count()

        print(f"\n{'='*50}")
        print(f"Ingestion complete in {elapsed:.1f}s")
        print(f"Documents: {success} OK, {errors} errors")
        print(f"Total chunks: {total_chunks}")
        print(f"Embedded chunks: {embedded}")
        print(f"{'='*50}")


if __name__ == "__main__":
    main()
