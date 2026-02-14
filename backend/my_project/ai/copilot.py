"""
Copilot service for ΠΥΛΗ ΚΟΙΝΩΝΙΚΗΣ ΜΕΡΙΜΝΑΣ AI Assistant.
Context-aware chat using RAG over Greek social welfare documents.
Adapted from Academicon's copilot_service.py.

DATA RESIDENCY NOTE:
Document chunks are sent to OpenAI's API (US-based servers) for embedding
and chat completion. Only public legislation and official guidelines should
be stored in the knowledge base. Do NOT ingest documents containing citizen
PII or case-specific data. For on-premises deployment, the LLM client can
be swapped to a local Ollama instance by setting LLM_BASE_URL env var.
"""
import os
import logging
from typing import List, Dict, Any, Optional

import openai

from my_project.ai.knowledge import search_chunks, load_full_documents

logger = logging.getLogger(__name__)

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


DISCLAIMER_TEXT = (
    "\n\n---\n"
    "*Οι απαντήσεις του AI Βοηθού είναι ενδεικτικές και συμβουλευτικού χαρακτήρα. "
    "Ελέγξτε πάντα με την ισχύουσα νομοθεσία και τις Υπουργικές Αποφάσεις.*"
)


def build_system_prompt() -> str:
    """Return the system prompt for the copilot."""
    return SYSTEM_PROMPT


def build_messages(
    user_message: str,
    context_chunks: List[Dict[str, Any]],
    chat_history: List[Dict[str, str]],
    user_context: Optional[Dict[str, str]] = None,
    full_documents: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, str]]:
    """Build the message array for the LLM call.

    Includes system prompt, document context, chat history, and user message.
    Prefers full_documents over chunks when available.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add document context — prefer full documents, fall back to chunks
    if full_documents:
        separator = "\n\n" + "═" * 60 + "\n\n"
        context_text = separator.join(
            f"ΕΓΓΡΑΦΟ: {os.path.basename(d.get('source_path', 'Άγνωστο'))}\n"
            f"{d['content']}"
            for d in full_documents
        )
        messages.append({
            "role": "system",
            "content": (
                "ΠΛΗΡΗ ΕΓΓΡΑΦΑ από τη βάση γνώσης, σχετικά με την ερώτηση "
                "του χρήστη. Χρησιμοποίησέ τα ΑΠΟΚΛΕΙΣΤΙΚΑ για να απαντήσεις. "
                "Αν κανένα δεν απαντά στην ερώτηση, πες το ξεκάθαρα.\n\n"
                f"{context_text}"
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
                "Αποσπάσματα από τη βάση γνώσης, σχετικά με την ερώτηση "
                "του χρήστη. Χρησιμοποίησέ τα ΑΠΟΚΛΕΙΣΤΙΚΑ για να "
                "απαντήσεις. Αν κανένα δεν απαντά στην ερώτηση, πες το ξεκάθαρα.\n\n"
                f"{context_text}"
            ),
        })

    # Add user context if available
    if user_context:
        user_info = (
            f"Ο χρήστης που ρωτάει: {user_context.get('username', 'Άγνωστος')}, "
            f"ρόλος: {user_context.get('role', 'guest')}. "
            f"Προσάρμοσε το επίπεδο λεπτομέρειας ανάλογα με τον ρόλο."
        )
        messages.append({"role": "system", "content": user_info})

    # Add chat history (last 20 messages)
    for msg in chat_history[-20:]:
        messages.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", ""),
        })

    # Add current user message
    messages.append({"role": "user", "content": user_message})

    return messages


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
