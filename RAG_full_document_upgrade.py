"""
===============================================================================
ΑΝΑΒΑΘΜΙΣΗ RAG: ΑΠΟ CHUNKS ΣΕ ΟΛΟΚΛΗΡΑ ΕΓΓΡΑΦΑ
===============================================================================

ΣΤΡΑΤΗΓΙΚΗ:
  1. Τα embeddings/chunks μένουν ως έχουν — χρησιμεύουν για ΑΝΑΖΗΤΗΣΗ
  2. Αφού βρεθούν τα σχετικά chunks, φορτώνουμε ΟΛΟΚΛΗΡΑ τα αρχεία
     από τα οποία προέρχονται
  3. Στέλνουμε τα πλήρη αρχεία στο LLM αντί για κομμένα chunks

ΑΡΧΕΙΑ ΠΟΥ ΑΛΛΑΖΟΥΝ:
  1. backend/my_project/ai/knowledge.py  — νέα function: load_full_documents()
  2. backend/my_project/ai/copilot.py    — νέο SYSTEM_PROMPT + full-doc logic

ΑΡΧΕΙΑ ΠΟΥ ΔΕΝ ΑΛΛΑΖΟΥΝ:
  - embeddings.py (chunking μένει ίδιο)
  - models.py (δεν αλλάζει schema)
  - routes.py (δεν αλλάζει API)
  - ingest_documents.py (δεν αλλάζει ingestion)
===============================================================================
"""


# ═════════════════════════════════════════════════════════════════
# ΑΡΧΕΙΟ 1: backend/my_project/ai/knowledge.py
# ═════════════════════════════════════════════════════════════════
#
# ΠΡΟΣΘΗΚΗ: Βάλε αυτή τη function ΜΕΤΑ τη search_chunks()
# και ΠΡΙΝ τη _fallback_keyword_search()
#
# ΜΗΝ ΑΛΛΑΞΕΙΣ τίποτα άλλο στο αρχείο — η search_chunks μένει ως έχει.
# ─────────────────────────────────────────────────────────────────

def load_full_documents(
    chunks: list,
    max_total_chars: int = 80000,
) -> list:
    """Από μια λίστα chunks, φόρτωσε ολόκληρα τα αρχεία-πηγές.

    Πώς δουλεύει:
    1. Παίρνει τα chunks που επέστρεψε η search_chunks()
    2. Βρίσκει τα μοναδικά source_path (δηλ. από ποια αρχεία ήρθαν)
    3. Τα ταξινομεί κατά σχετικότητα (πόσα chunks βρέθηκαν + similarity)
    4. Φορτώνει ολόκληρο το κείμενο κάθε αρχείου από τον δίσκο
    5. Σταματάει αν ξεπεράσει το max_total_chars (δεν θέλουμε υπέρβαση context)

    Args:
        chunks: Η λίστα dicts που επιστρέφει η search_chunks()
        max_total_chars: Μέγιστο σύνολο χαρακτήρων (80K ≈ 25K tokens ≈ ασφαλές)

    Returns:
        Λίστα dicts: [{"source_path": "...", "content": "ολόκληρο κείμενο", "relevance_score": ...}]
    """
    import os
    from collections import defaultdict

    if not chunks:
        return []

    # ── Βήμα 1: Ομαδοποίηση chunks ανά αρχείο ──
    # Μετράμε: πόσα chunks βρέθηκαν + μέσο similarity ανά αρχείο
    file_scores = defaultdict(lambda: {"count": 0, "total_sim": 0.0})
    for chunk in chunks:
        path = chunk.get("source_path", "")
        if path:
            file_scores[path]["count"] += 1
            file_scores[path]["total_sim"] += chunk.get("similarity", 0.0)

    # ── Βήμα 2: Ταξινόμηση κατά σχετικότητα ──
    # Πρώτα τα αρχεία με περισσότερα hits, μετά κατά μέσο similarity
    ranked_files = sorted(
        file_scores.items(),
        key=lambda x: (x[1]["count"], x[1]["total_sim"] / max(x[1]["count"], 1)),
        reverse=True,
    )

    # ── Βήμα 3: Φόρτωση ολόκληρων αρχείων ──
    full_documents = []
    total_chars = 0

    for source_path, scores in ranked_files:
        # Διάβασε το αρχείο από τον δίσκο
        file_text = _read_source_file(source_path)
        if not file_text:
            continue

        # Έλεγξε αν χωράει
        if total_chars + len(file_text) > max_total_chars:
            # Αν είναι το πρώτο αρχείο, βάλτο κομμένο (καλύτερα κάτι παρά τίποτα)
            if not full_documents:
                file_text = file_text[:max_total_chars]
            else:
                # Πάρε μόνο τα chunks αυτού του αρχείου αντί ολόκληρο
                # (fallback σε chunk-mode για τα υπόλοιπα)
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
    """Διαβάζει ένα αρχείο-πηγή από τον δίσκο.

    Το source_path μπορεί να είναι:
    - Απόλυτο path (π.χ. /app/knowledge/ΝΟΜΟΘΕΣΙΑ/xxx.md)
    - Σχετικό path (π.χ. knowledge/ΝΟΜΟΘΕΣΙΑ/xxx.md)

    Δοκιμάζει διαδοχικά μέχρι να βρει το αρχείο.
    """
    import os
    from flask import current_app

    # Δοκίμασε 1: Αυτούσιο path (αν είναι απόλυτο)
    if os.path.isfile(source_path):
        try:
            with open(source_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception:
            pass

    # Δοκίμασε 2: Σχετικό ως προς KNOWLEDGE_FOLDER
    try:
        knowledge_dir = current_app.config.get("KNOWLEDGE_FOLDER", "")
        if knowledge_dir:
            # Αφαίρεσε τυχόν prefix "knowledge/" από το source_path
            relative = source_path
            for prefix in ("knowledge/", "knowledge\\"):
                if relative.startswith(prefix):
                    relative = relative[len(prefix):]
                    break

            candidate = os.path.join(knowledge_dir, relative)
            if os.path.isfile(candidate):
                with open(candidate, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read()

            # Δοκίμασε και με το basename μόνο
            basename = os.path.basename(source_path)
            for root, dirs, files in os.walk(knowledge_dir):
                if basename in files:
                    full = os.path.join(root, basename)
                    with open(full, "r", encoding="utf-8", errors="ignore") as f:
                        return f.read()
    except RuntimeError:
        # Αν δεν υπάρχει app context (π.χ. tests)
        pass

    # Δοκίμασε 3: Σχετικό ως προς working directory
    if os.path.isfile(source_path):
        with open(source_path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()

    logger.warning(f"Could not read source file: {source_path}")
    return ""


# ═════════════════════════════════════════════════════════════════
# ΑΡΧΕΙΟ 2: backend/my_project/ai/copilot.py
# ═════════════════════════════════════════════════════════════════
#
# ΑΛΛΑΓΕΣ:
# 1. Νέο SYSTEM_PROMPT (αντικατάσταση)
# 2. Νέο import: load_full_documents
# 3. Αλλαγή στη get_chat_reply(): full-doc logic
# 4. Αλλαγή στη build_messages(): νέο context format
# ─────────────────────────────────────────────────────────────────


# ── ΑΛΛΑΓΗ 2.1: IMPORTS ──
# Στην αρχή του αρχείου, άλλαξε το import:
#
# ΠΡΙΝ:
#   from my_project.ai.knowledge import search_chunks
#
# ΜΕΤΑ:
from my_project.ai.knowledge import search_chunks, load_full_documents


# ── ΑΛΛΑΓΗ 2.2: ΝΕΟ SYSTEM_PROMPT ──
# Αντικατέστησε ΟΛΟΚΛΗΡΟ το SYSTEM_PROMPT με αυτό:

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


# ── ΑΛΛΑΓΗ 2.3: ΝΕΑ build_messages() ──
# Αντικατέστησε ΟΛΟΚΛΗΡΗ τη build_messages() με αυτή:

def build_messages(
    user_message: str,
    context_chunks: list,
    chat_history: list,
    user_context: dict = None,
    full_documents: list = None,
) -> list:
    """Build the message array for the LLM call.

    Αν full_documents παρέχεται, χρησιμοποιεί ολόκληρα τα αρχεία.
    Αλλιώς fallback σε chunks (παλιά συμπεριφορά).
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # ── Νέο: Ολόκληρα έγγραφα (προτιμώμενο) ──
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

    # ── Fallback: Chunks (αν δεν υπάρχουν full_documents) ──
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

    # User context
    if user_context:
        user_info = (
            f"Χρήστης: {user_context.get('username', 'Άγνωστος')}, "
            f"ρόλος: {user_context.get('role', 'guest')}. "
            f"Προσάρμοσε το επίπεδο λεπτομέρειας ανάλογα."
        )
        messages.append({"role": "system", "content": user_info})

    # Chat history (last 20)
    for msg in chat_history[-20:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", ""),
        })

    # Current user message
    messages.append({"role": "user", "content": user_message})

    return messages


# ── ΑΛΛΑΓΗ 2.4: ΝΕΑ get_chat_reply() ──
# Αντικατέστησε ΟΛΟΚΛΗΡΗ τη get_chat_reply() με αυτή:

def get_chat_reply(
    user_message: str,
    chat_history: list = None,
    use_rag: bool = True,
    user_context: dict = None,
    model_override: str = None,
) -> dict:
    """Generate AI reply — τώρα με full-document retrieval.

    Βήματα:
    1. search_chunks() → βρες τα 8 πιο σχετικά chunks (αναζήτηση)
    2. load_full_documents() → φόρτωσε ΟΛΟΚΛΗΡΑ τα αρχεία-πηγές
    3. build_messages() → στείλε τα πλήρη έγγραφα στο LLM
    """
    if chat_history is None:
        chat_history = []

    # ── Βήμα 1: Vector search (για εύρεση σχετικών αρχείων) ──
    context_chunks = []
    full_documents = []

    if use_rag:
        try:
            # Αύξησε σε 8 chunks για καλύτερη κάλυψη αρχείων
            context_chunks = search_chunks(user_message, limit=8)
        except Exception as e:
            logger.error(f"RAG search failed: {e}")

        # ── Βήμα 2: Full document loading ──
        if context_chunks:
            try:
                full_documents = load_full_documents(
                    context_chunks,
                    max_total_chars=80000,  # ~25K tokens, ασφαλές για 128K context
                )
                logger.info(
                    f"Full-doc RAG: {len(full_documents)} docs loaded "
                    f"from {len(context_chunks)} chunks"
                )
            except Exception as e:
                logger.error(f"Full document loading failed, falling back to chunks: {e}")
                full_documents = []

    # ── Βήμα 3: Build messages ──
    messages = build_messages(
        user_message,
        context_chunks,
        chat_history,
        user_context,
        full_documents=full_documents,  # ← νέα παράμετρος
    )

    # ── Βήμα 4: Call LLM ──
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

    # ── Sources: από full_documents αν υπάρχουν, αλλιώς από chunks ──
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
