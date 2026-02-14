# RAG Full-Document Retrieval Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the AI copilot's RAG pipeline from sending truncated chunks to the LLM, to using chunks only for *search* and then loading full source documents for *context* — dramatically improving answer quality for Greek social welfare legislation.

**Architecture:** The existing chunk-based vector search (`search_chunks()`) stays untouched and continues to identify relevant documents. A new `load_full_documents()` function reads the complete source files from disk, ranked by chunk hit count and similarity. The copilot's `build_messages()` and `get_chat_reply()` are updated to prefer full documents over chunks, with a graceful fallback to chunk mode if file loading fails.

**Tech Stack:** Python/Flask, SQLAlchemy, pgvector, OpenAI API, pytest

---

## Summary of Changes

| File | Action | What Changes |
|------|--------|-------------|
| `backend/my_project/ai/knowledge.py` | ADD 2 functions | `load_full_documents()` + `_read_source_file()` |
| `backend/my_project/ai/copilot.py` | MODIFY 3 things | import, `build_messages()`, `get_chat_reply()` |
| `backend/my_project/ai/copilot.py` | REPLACE | `SYSTEM_PROMPT` constant |
| `tests/test_ai/test_knowledge.py` | ADD tests | Tests for `load_full_documents()` and `_read_source_file()` |
| `tests/test_ai/test_copilot.py` | ADD + UPDATE tests | Tests for new full-doc path in `build_messages()` and `get_chat_reply()` |

**Files that do NOT change:** `embeddings.py`, `models.py`, `routes.py`, `ingest_documents.py`

---

## Task 1: Add `_read_source_file()` to knowledge.py

**Files:**
- Modify: `backend/my_project/ai/knowledge.py` (insert after `search_chunks()`, before `_fallback_keyword_search()`)
- Test: `tests/test_ai/test_knowledge.py`

**Step 1: Write the failing test**

Add to `tests/test_ai/test_knowledge.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_ai/test_knowledge.py::test_read_source_file_absolute_path tests/test_ai/test_knowledge.py::test_read_source_file_missing_returns_empty -v`
Expected: FAIL — `ImportError: cannot import name '_read_source_file'`

**Step 3: Write the implementation**

Insert into `backend/my_project/ai/knowledge.py` AFTER the `search_chunks()` function (line ~230) and BEFORE `_fallback_keyword_search()` (line ~232):

```python
def _read_source_file(source_path: str) -> str:
    """Read a source file from disk, trying multiple path strategies.

    source_path from DB may be absolute or relative. Tries:
    1. As-is (absolute path)
    2. Relative to KNOWLEDGE_FOLDER config
    3. Walk KNOWLEDGE_FOLDER looking for matching basename
    """
    from flask import current_app

    # Strategy 1: Absolute path
    if os.path.isfile(source_path):
        try:
            with open(source_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            pass

    # Strategy 2: Relative to KNOWLEDGE_FOLDER
    try:
        knowledge_dir = current_app.config.get("KNOWLEDGE_FOLDER", "")
        if knowledge_dir:
            relative = source_path
            for prefix in ("knowledge/", "knowledge\\"):
                if relative.startswith(prefix):
                    relative = relative[len(prefix):]
                    break

            candidate = os.path.join(knowledge_dir, relative)
            if os.path.isfile(candidate):
                with open(candidate, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()

            # Strategy 3: Walk and find by basename
            basename = os.path.basename(source_path)
            for root, dirs, files in os.walk(knowledge_dir):
                if basename in files:
                    full = os.path.join(root, basename)
                    with open(full, "r", encoding="utf-8", errors="ignore") as f:
                        return f.read()
    except RuntimeError:
        pass  # No app context (tests)

    logger.warning(f"Could not read source file: {source_path}")
    return ""
```

**Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_ai/test_knowledge.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/my_project/ai/knowledge.py tests/test_ai/test_knowledge.py
git commit -m "feat(knowledge): add _read_source_file with multi-strategy path resolution"
```

---

## Task 2: Add `load_full_documents()` to knowledge.py

**Files:**
- Modify: `backend/my_project/ai/knowledge.py` (insert after `_read_source_file()`, before `_fallback_keyword_search()`)
- Test: `tests/test_ai/test_knowledge.py`

**Step 1: Write the failing tests**

Add to `tests/test_ai/test_knowledge.py`:

```python
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
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_ai/test_knowledge.py::test_load_full_documents_groups_by_file tests/test_ai/test_knowledge.py::test_load_full_documents_empty_chunks -v`
Expected: FAIL — `ImportError: cannot import name 'load_full_documents'`

**Step 3: Write the implementation**

Insert into `backend/my_project/ai/knowledge.py` AFTER `_read_source_file()` and BEFORE `_fallback_keyword_search()`:

```python
def load_full_documents(
    chunks: List[Dict[str, Any]],
    max_total_chars: int = 80000,
) -> List[Dict[str, Any]]:
    """From search result chunks, load full source files.

    Uses chunks only to identify WHICH files are relevant,
    then loads the complete file content from disk.
    Stops when max_total_chars is reached.
    """
    from collections import defaultdict

    if not chunks:
        return []

    # Group chunks by source file, tracking hit count and similarity
    file_scores = defaultdict(lambda: {"count": 0, "total_sim": 0.0})
    for chunk in chunks:
        path = chunk.get("source_path", "")
        if path:
            file_scores[path]["count"] += 1
            file_scores[path]["total_sim"] += chunk.get("similarity", 0.0)

    # Rank files: most chunk hits first, then by average similarity
    ranked_files = sorted(
        file_scores.items(),
        key=lambda x: (x[1]["count"], x[1]["total_sim"] / max(x[1]["count"], 1)),
        reverse=True,
    )

    # Load full files until budget exhausted
    full_documents = []
    total_chars = 0

    for source_path, scores in ranked_files:
        file_text = _read_source_file(source_path)
        if not file_text:
            continue

        if total_chars + len(file_text) > max_total_chars:
            if not full_documents:
                # First doc — include truncated rather than nothing
                file_text = file_text[:max_total_chars]
            else:
                break

        avg_sim = scores["total_sim"] / max(scores["count"], 1)
        full_documents.append({
            "source_path": source_path,
            "content": file_text,
            "relevance_score": round(avg_sim, 4),
            "chunk_hits": scores["count"],
        })
        total_chars += len(file_text)

    return full_documents
```

**Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_ai/test_knowledge.py -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/my_project/ai/knowledge.py tests/test_ai/test_knowledge.py
git commit -m "feat(knowledge): add load_full_documents for full-file RAG retrieval"
```

---

## Task 3: Update copilot.py — import, SYSTEM_PROMPT, and `build_messages()`

**Files:**
- Modify: `backend/my_project/ai/copilot.py` (3 changes: import line, SYSTEM_PROMPT, build_messages)
- Test: `tests/test_ai/test_copilot.py`

**Step 1: Write the failing tests**

Add to `tests/test_ai/test_copilot.py`:

```python
def test_build_messages_with_full_documents():
    """build_messages should use full documents when provided, not chunks."""
    from my_project.ai.copilot import build_messages

    full_docs = [
        {"source_path": "/docs/law_a.txt", "content": "Full law text A about ΚΔΑΠ."},
        {"source_path": "/docs/law_b.txt", "content": "Full law text B about ΜΦΗ."},
    ]
    chunks = [
        {"content": "chunk content", "source_path": "/docs/law_a.txt"},
    ]

    messages = build_messages(
        user_message="Τι λέει ο νόμος;",
        context_chunks=chunks,
        chat_history=[],
        full_documents=full_docs,
    )

    # Should include full doc content, NOT chunk content
    all_content = " ".join(m["content"] for m in messages)
    assert "Full law text A" in all_content
    assert "Full law text B" in all_content
    assert "ΠΛΗΡΗ ΕΓΓΡΑΦΑ" in all_content


def test_build_messages_falls_back_to_chunks_when_no_full_docs():
    """build_messages should use chunks when full_documents is empty."""
    from my_project.ai.copilot import build_messages

    chunks = [
        {"content": "Chunk about licensing", "source_path": "doc.txt"},
    ]

    messages = build_messages(
        user_message="Τι λέει ο νόμος;",
        context_chunks=chunks,
        chat_history=[],
        full_documents=[],
    )

    all_content = " ".join(m["content"] for m in messages)
    assert "Chunk about licensing" in all_content
    # Should NOT say "ΠΛΗΡΗ ΕΓΓΡΑΦΑ"
    assert "ΠΛΗΡΗ ΕΓΓΡΑΦΑ" not in all_content


def test_system_prompt_includes_document_hierarchy():
    """New system prompt should include source hierarchy rules."""
    from my_project.ai.copilot import SYSTEM_PROMPT
    assert "ΙΕΡΑΡΧΙΑ" in SYSTEM_PROMPT
    assert "ΜΗΝ ΕΠΙΝΟΕΙΣ" in SYSTEM_PROMPT or "ΜΗ ΣΥΓΧΕΕΙΣ" in SYSTEM_PROMPT
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_ai/test_copilot.py::test_build_messages_with_full_documents tests/test_ai/test_copilot.py::test_build_messages_falls_back_to_chunks_when_no_full_docs -v`
Expected: FAIL — `build_messages() got an unexpected keyword argument 'full_documents'`

**Step 3: Apply the 3 changes to copilot.py**

**3a. Update import** (line 19):

```python
# BEFORE:
from my_project.ai.knowledge import search_chunks

# AFTER:
from my_project.ai.knowledge import search_chunks, load_full_documents
```

**3b. Replace SYSTEM_PROMPT** (lines 23-79):

Replace the entire `SYSTEM_PROMPT = """..."""` block with the new version from the upgrade spec. Key differences:
- More concise: "εξειδικευμένο εργαλείο" instead of "ένα εξειδικευμένο εργαλείο που υποστηρίζει"
- Rules reference "πλήρη νομοθετικά κείμενα" (full documents) instead of "αποσπάσματα" (excerpts)
- Rule 1 uses "ΜΗΝ ΕΠΙΝΟΕΙΣ" (all-caps imperative)
- Rule 3 shorter: "Δεν βρήκα σχετική πληροφορία στα έγγραφα."
- Rule 6 uses formula: "ΚΔΑΠ ≠ ΜΦΗ ≠ ΣΥΔ — κάθε τύπος = ξεχωριστό πλαίσιο"

Full new `SYSTEM_PROMPT`:

```python
SYSTEM_PROMPT = """Είσαι ο νομικός σύμβουλος της Πύλης Κοινωνικής Μέριμνας — εξειδικευμένο \
εργαλείο για κοινωνικούς λειτουργούς, κοινωνικούς συμβούλους, μέλη επιτροπών \
ελέγχου και στελέχη Διευθύνσεων Κοινωνικής Μέριμνας στις Περιφέρειες.

ΠΕΔΙΟ ΕΞΕΙΔΙΚΕΥΣΗΣ:
Η βάση γνώσης σου περιέχει πλήρη νομοθετικά κείμενα και εσωτερικά έγγραφα:
- Αδειοδότηση/εποπτεία δομών: ΜΦΗ, ΚΔΑΠ, ΚΔΑΠ-ΜΕΑ, ΣΥΔ, ΚΔΗΦ-ΚΑΑ, ΜΦΠΑΔ, ΒΣΟΦ
- Έλεγχοι: τακτικοί, έκτακτοι, ρόλος Κοινωνικού Συμβούλου, εκθέσεις
- Κυρώσεις: πρόστιμα, αναστολή, ανάκληση αδειών, κλιμάκωση υποτροπής
- Κτιριολογικές προδιαγραφές, αρμοδιότητες Περιφερειών, αναδοχή/υιοθεσία

ΚΑΝΟΝΕΣ ΧΡΗΣΗΣ ΕΓΓΡΑΦΩΝ:
1. ΒΑΣΙΣΟΥ ΑΠΟΚΛΕΙΣΤΙΚΑ στα έγγραφα που λαμβάνεις. ΜΗΝ ΕΠΙΝΟΕΙΣ διατάξεις, \
άρθρα ή ΦΕΚ που δεν υπάρχουν στα έγγραφα.
2. ΙΕΡΑΡΧΙΑ: Νόμος > ΠΔ > ΥΑ > ΚΥΑ > Εγκύκλιος > Εσωτερικό έγγραφο. \
Αν αντικρούονται, υπερισχύει η ανώτερη ή η νεότερη ίδιας βαθμίδας.
3. ΑΝ ΔΕΝ ΒΡΕΙΣ ΑΠΑΝΤΗΣΗ: "Δεν βρήκα σχετική πληροφορία στα έγγραφα. \
Προτείνω να συμβουλευτείτε τη νομική υπηρεσία ή το αρμόδιο τμήμα."
4. ΠΑΡΑΠΕΜΠΕ στην πηγή: νόμο/ΥΑ + άρθρο, ΜΟΝΟ αν αναγράφονται στο κείμενο.
5. ΑΚΡΙΒΕΙΑ: πρόστιμα, προθεσμίες, αριθμοί — μόνο αυτολεξεί από τα έγγραφα.
6. ΜΗ ΣΥΓΧΕΕΙΣ ΤΥΠΟΥΣ ΔΟΜΩΝ: ΚΔΑΠ ≠ ΜΦΗ ≠ ΣΥΔ — κάθε τύπος = ξεχωριστό πλαίσιο.

ΔΟΜΗ ΑΠΑΝΤΗΣΗΣ:
- Σύντομη άμεση απάντηση (1-2 προτάσεις)
- Ανάπτυξη με λεπτομέρειες
- Αν αφορά διαδικασία → βήματα
- Αν αφορά κυρώσεις → ακριβή ποσά και κλιμάκωση
- Πηγές στο τέλος

ΓΛΩΣΣΑ: Πάντα ελληνικά. Επαγγελματικό αλλά κατανοητό — σαν έμπειρος συνάδελφος.

ΣΗΜΑΝΤΙΚΟ: Δεν είσαι δικηγόρος. Πληροφόρηση βάσει εγγράφων, όχι γνωμοδότηση."""
```

**3c. Modify `build_messages()`** — add `full_documents` parameter and full-doc context logic:

- Add `full_documents: Optional[List[Dict[str, Any]]] = None` to the function signature
- Replace the `if context_chunks:` block with the new `if full_documents: ... elif context_chunks:` block that:
  - When `full_documents` is provided: formats each doc with `══════` separator and `ΕΓΓΡΑΦΟ: {basename}` header, wraps in "ΠΛΗΡΗ ΕΓΓΡΑΦΑ" system message
  - When only `context_chunks` available: uses the old chunk format with "Αποσπάσματα" header (fallback)

**Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_ai/test_copilot.py -v`
Expected: ALL PASS (including existing tests — they pass `full_documents=None` by default)

**Step 5: Commit**

```bash
git add backend/my_project/ai/copilot.py tests/test_ai/test_copilot.py
git commit -m "feat(copilot): update build_messages for full-document context with chunk fallback"
```

---

## Task 4: Update `get_chat_reply()` in copilot.py

**Files:**
- Modify: `backend/my_project/ai/copilot.py` (replace `get_chat_reply()`)
- Test: `tests/test_ai/test_copilot.py`

**Step 1: Write the failing test**

Add to `tests/test_ai/test_copilot.py`:

```python
from unittest.mock import patch, MagicMock

def test_get_chat_reply_loads_full_documents(app):
    """get_chat_reply should call load_full_documents when chunks are found."""
    with app.app_context():
        mock_chunks = [
            {"content": "chunk1", "source_path": "/docs/law.txt", "similarity": 0.9,
             "chunk_type": "text", "document_id": 1},
        ]
        mock_full_docs = [
            {"source_path": "/docs/law.txt", "content": "Full law content",
             "relevance_score": 0.9, "chunk_hits": 1},
        ]

        with patch("my_project.ai.copilot.search_chunks", return_value=mock_chunks), \
             patch("my_project.ai.copilot.load_full_documents", return_value=mock_full_docs), \
             patch("my_project.ai.copilot.openai") as mock_openai:

            # Mock the OpenAI response
            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Η απάντηση"
            mock_openai.OpenAI.return_value.chat.completions.create.return_value = mock_response

            from my_project.ai.copilot import get_chat_reply
            result = get_chat_reply("Ερώτηση")

            assert result["docs_loaded"] == 1
            assert result["chunks_found"] == 1
            assert result["context_used"] is True
            assert "Η απάντηση" in result["reply"]


def test_get_chat_reply_returns_docs_loaded_field(app):
    """get_chat_reply response should include docs_loaded count."""
    with app.app_context():
        with patch("my_project.ai.copilot.search_chunks", return_value=[]), \
             patch("my_project.ai.copilot.openai") as mock_openai:

            mock_response = MagicMock()
            mock_response.choices = [MagicMock()]
            mock_response.choices[0].message.content = "Δεν βρήκα πληροφορία."
            mock_openai.OpenAI.return_value.chat.completions.create.return_value = mock_response

            from my_project.ai.copilot import get_chat_reply
            result = get_chat_reply("Ερώτηση")

            assert "docs_loaded" in result
            assert result["docs_loaded"] == 0
```

**Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_ai/test_copilot.py::test_get_chat_reply_loads_full_documents -v`
Expected: FAIL — either missing `docs_loaded` key or `load_full_documents` not called

**Step 3: Replace `get_chat_reply()` in copilot.py**

Replace the entire function (lines 144-210) with:

```python
def get_chat_reply(
    user_message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
    use_rag: bool = True,
    user_context: Optional[Dict[str, str]] = None,
    model_override: Optional[str] = None,
) -> Dict[str, Any]:
    """Generate AI reply with full-document RAG retrieval."""
    if chat_history is None:
        chat_history = []

    context_chunks = []
    full_documents = []

    if use_rag:
        try:
            context_chunks = search_chunks(user_message, limit=8)
        except Exception as e:
            logger.error(f"RAG search failed: {e}")

        if context_chunks:
            try:
                full_documents = load_full_documents(
                    context_chunks, max_total_chars=80000
                )
                logger.info(
                    f"Full-doc RAG: {len(full_documents)} docs loaded "
                    f"from {len(context_chunks)} chunks"
                )
            except Exception as e:
                logger.error(f"Full doc loading failed, using chunks: {e}")
                full_documents = []

    messages = build_messages(
        user_message, context_chunks, chat_history,
        user_context, full_documents=full_documents,
    )

    model = model_override or os.environ.get("LLM_MODEL", "gpt-4o-mini")
    try:
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

        is_reasoning = any(model.startswith(p) for p in ("gpt-5", "o1", "o3", "o4"))
        params = dict(model=model, messages=messages)
        if not is_reasoning:
            params["temperature"] = 0.3

        logger.info(f"Calling LLM: model={model}, docs={len(full_documents)}, chunks={len(context_chunks)}")
        response = client.chat.completions.create(**params)
        reply = response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"LLM call failed (model={model}): {e}")
        reply = ("Λυπάμαι, αντιμετώπισα τεχνικό πρόβλημα. "
                "Παρακαλώ δοκιμάστε ξανά σε λίγο.")

    if full_documents:
        sources = [doc["source_path"] for doc in full_documents]
    else:
        sources = list(set(
            c.get("source_path", "") for c in context_chunks if c.get("source_path")
        ))

    return {
        "reply": reply + DISCLAIMER_TEXT,
        "sources": sources,
        "context_used": len(full_documents) > 0 or len(context_chunks) > 0,
        "chunks_found": len(context_chunks),
        "docs_loaded": len(full_documents),
        "model": model,
    }
```

Key changes from old version:
- Default model: `gpt-4o-mini` instead of `gpt-5-mini`
- After `search_chunks()`, calls `load_full_documents()` to get full files
- Passes `full_documents` to `build_messages()`
- Sources extracted from `full_documents` when available (preserves order)
- Response includes new `docs_loaded` field
- Enhanced logging with doc/chunk counts

**Step 4: Run ALL tests to verify they pass**

Run: `python -m pytest tests/test_ai/ -v`
Expected: ALL PASS

**Step 5: Commit**

```bash
git add backend/my_project/ai/copilot.py tests/test_ai/test_copilot.py
git commit -m "feat(copilot): full-document RAG retrieval in get_chat_reply

Instead of sending truncated chunks to the LLM, the system now:
1. Uses vector search to identify relevant source files
2. Loads complete source documents from disk (up to 80K chars)
3. Sends full documents for comprehensive answers
4. Falls back gracefully to chunks if file loading fails

Also updates default LLM model from gpt-5-mini to gpt-4o-mini."
```

---

## Task 5: Run full test suite and verify

**Files:**
- No file changes — verification only

**Step 1: Run all AI tests**

Run: `python -m pytest tests/test_ai/ -v`
Expected: ALL PASS

**Step 2: Run all backend tests**

Run: `python -m pytest tests/ -v`
Expected: ALL PASS — the changes should not affect any existing tests since:
- `build_messages()` new parameter has a default value (`None`)
- `get_chat_reply()` signature is unchanged
- `search_chunks()` is untouched
- No model/schema changes

**Step 3: If any tests fail due to the new `full_documents` parameter**

Check if any tests call `build_messages()` positionally with more than 4 args. If so, add `full_documents=None` explicitly. The existing tests in `test_copilot.py` all use keyword args so this should not be needed.

---

## Task 6: Diary entry

**Files:**
- Modify: `DIARY.md`

**Step 1: Write diary entry**

Append a diary entry at the top of `DIARY.md` documenting the RAG full-document upgrade completion.

---

## Notes

### What this does NOT change
- **Ingestion pipeline** — chunks and embeddings are still created the same way
- **Database schema** — no new models or columns
- **API routes** — `/api/chat` response shape gains `docs_loaded` but is backwards-compatible
- **Frontend** — no changes needed; the reply format is the same

### Default model change
The old code defaults to `gpt-5-mini`. The upgrade spec changes this to `gpt-4o-mini` (currently available). This is controlled by the `LLM_MODEL` environment variable so it can be overridden without code changes.

### Character budget
`max_total_chars=80000` ≈ 25K tokens, which is safe for models with 128K context windows. The system prompt + history + user message take ~2-3K tokens, leaving plenty of room.
