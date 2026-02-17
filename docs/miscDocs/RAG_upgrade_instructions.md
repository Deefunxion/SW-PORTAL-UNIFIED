# RAG Full-Document Upgrade — Οδηγίες για Claude Code

## Τι κάνει αυτή η αλλαγή

Μέχρι τώρα ο AI βοηθός λάμβανε 5 μικρά κομμάτια (chunks) νομοθεσίας, που συχνά
ήταν κομμένα στη μέση. Τώρα:
1. Ψάχνει κανονικά τα chunks (για να βρει ΠΟΙΑ αρχεία σχετίζονται)
2. Φορτώνει ΟΛΟΚΛΗΡΑ τα αρχεία-πηγές από τον δίσκο
3. Στέλνει τα πλήρη έγγραφα στο LLM

## Αρχεία που αλλάζουν

1. `backend/my_project/ai/knowledge.py` — ΠΡΟΣΘΗΚΗ 2 functions
2. `backend/my_project/ai/copilot.py` — ΑΛΛΑΓΗ prompt + logic

## Βήμα 1: knowledge.py — Πρόσθεσε 2 functions

Πρόσθεσε τις παρακάτω functions στο `backend/my_project/ai/knowledge.py`,
ΜΕΤΑ τη `search_chunks()` και ΠΡΙΝ τη `_fallback_keyword_search()`.
ΜΗΝ αλλάξεις τίποτα άλλο στο αρχείο.

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

## Βήμα 2: copilot.py — Αντικατάσταση

### 2a. Άλλαξε το import (γραμμή ~9)

ΠΡΙΝ:
```python
from my_project.ai.knowledge import search_chunks
```

ΜΕΤΑ:
```python
from my_project.ai.knowledge import search_chunks, load_full_documents
```

### 2b. Αντικατέστησε ολόκληρο το SYSTEM_PROMPT

ΠΡΙΝ: Το παλιό prompt (~15 γραμμές) που ξεκινά "Είσαι ο ψηφιακός βοηθός..."

ΜΕΤΑ:
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

### 2c. Πρόσθεσε `full_documents` παράμετρο στη build_messages()

Στο function signature, πρόσθεσε:
```python
def build_messages(
    user_message: str,
    context_chunks: List[Dict[str, Any]],
    chat_history: List[Dict[str, str]],
    user_context: Optional[Dict[str, str]] = None,
    full_documents: Optional[List[Dict[str, Any]]] = None,  # ← ΝΕΟ
) -> List[Dict[str, str]]:
```

Στο σώμα της function, αντικατέστησε το block "Add document context" με:
```python
    # Add document context — prefer full documents over chunks
    if full_documents:
        doc_texts = []
        for doc in full_documents:
            source = os.path.basename(doc.get("source_path", "Άγνωστο"))
            doc_texts.append(
                f"══════════════════════════════════════\n"
                f"ΕΓΓΡΑΦΟ: {source}\n"
                f"══════════════════════════════════════\n"
                f"{doc['content']}"
            )
        all_docs = "\n\n".join(doc_texts)
        messages.append({
            "role": "system",
            "content": (
                "Παρακάτω είναι τα ΠΛΗΡΗ ΕΓΓΡΑΦΑ από τη βάση γνώσης που σχετίζονται "
                "με την ερώτηση. Χρησιμοποίησέ τα ΑΠΟΚΛΕΙΣΤΙΚΑ. "
                "Αν κανένα δεν απαντά στην ερώτηση, πες το ξεκάθαρα.\n\n"
                f"{all_docs}"
            ),
        })
    elif context_chunks:
        context_text = "\n\n---\n\n".join(
            f"[ΕΓΓΡΑΦΟ: {c.get('source_path', 'Άγνωστο')}]\n{c['content']}"
            for c in context_chunks
        )
        messages.append({
            "role": "system",
            "content": (
                "Αποσπάσματα από τη βάση γνώσης (ΟΧΙ πλήρη κείμενα). "
                "Χρησιμοποίησέ τα. Αν δεν απαντούν, πες το.\n\n"
                f"{context_text}"
            ),
        })
```

### 2d. Αντικατέστησε τη get_chat_reply()

Η κρίσιμη αλλαγή — μετά τα chunks, φόρτωσε full documents:

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

## Βήμα 3: Τρέξε tests

```bash
cd backend && python -m pytest ../tests/test_ai/ -v
```

Τα tests πρέπει να περάσουν. Αν κάποιο χτυπήσει λόγω νέας παραμέτρου
`full_documents`, πρόσθεσε `full_documents=None` στα test calls.

## Βήμα 4: Commit

```bash
git add backend/my_project/ai/knowledge.py backend/my_project/ai/copilot.py
git commit -m "feat: full-document RAG retrieval

Instead of sending 5 truncated chunks to the LLM, the system now:
1. Uses vector search to identify relevant source files
2. Loads complete source documents from disk
3. Sends full documents to the LLM for comprehensive answers

Also includes new optimized system prompt with:
- Correct facility type codes (ΜΦΗ, ΚΔΑΠ, ΚΔΑΠ-ΜΕΑ, ΣΥΔ, ΚΔΗΦ-ΚΑΑ)
- Source hierarchy rules (law > decree > ministerial decision)
- Anti-hallucination instructions
- Structured answer format guidance"
```

## Σημείωση: Default model

Ο τρέχων κώδικας αναφέρει `gpt-5-mini` ως default model. Αν αυτό δεν υπάρχει
στο API σου, αλλάζει σε `gpt-4o-mini` στη νέα get_chat_reply().
Ελέγξτε τι ισχύει στο OpenAI account σας.
