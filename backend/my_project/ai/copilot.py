"""
Copilot service for SW Portal AI Assistant.
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

from my_project.ai.knowledge import search_chunks

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Είσαι ο ψηφιακός βοηθός της Πύλης Κοινωνικής Μέριμνας (SW Portal), \
ένα εργαλείο για κοινωνικούς λειτουργούς στην Ελλάδα.

Ο ρόλος σου:
- Απαντάς σε ερωτήσεις σχετικά με τη νομοθεσία κοινωνικής μέριμνας
- Βοηθάς με θέματα αδειοδότησης δομών (ΚΑΑ, ΚΔΑΠ, ΚΕΦΙ, ΜΦΗ, ΣΥΔ)
- Εξηγείς διαδικασίες ελέγχων και εκθέσεων
- Καθοδηγείς στη συμπλήρωση εντύπων αιτήσεων
- Παρέχεις πληροφορίες για αποφάσεις επιτροπών

Κανόνες:
- Απαντάς ΠΑΝΤΑ στα ελληνικά
- Βασίζεσαι στα έγγραφα που σου παρέχονται ως context
- Αν δεν βρεις σχετική πληροφορία στα έγγραφα, το δηλώνεις ειλικρινά
- Αναφέρεις τις πηγές σου (ονόματα εγγράφων)
- Είσαι σαφής, ακριβής, και χρησιμοποιείς επαγγελματικό ύφος
"""


DISCLAIMER_TEXT = (
    "\n\n---\n"
    "*Οι απαντήσεις του AI Βοηθού είναι ενδεικτικές και συμβουλευτικού χαρακτήρα. "
    "Ελέγξτε πάντα με την ισχύουσα νομοθεσία και τις επίσημες εγκυκλίους.*"
)


def build_system_prompt() -> str:
    """Return the system prompt for the copilot."""
    return SYSTEM_PROMPT


def build_messages(
    user_message: str,
    context_chunks: List[Dict[str, Any]],
    chat_history: List[Dict[str, str]],
) -> List[Dict[str, str]]:
    """Build the message array for the LLM call.

    Includes system prompt, document context, chat history, and user message.
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    # Add document context if available
    if context_chunks:
        context_text = "\n\n---\n\n".join(
            f"[Πηγή: {c.get('source_path', 'Άγνωστο')}]\n{c['content']}"
            for c in context_chunks
        )
        messages.append({
            "role": "system",
            "content": f"Σχετικά έγγραφα για την ερώτηση:\n\n{context_text}",
        })

    # Add chat history (last 6 messages)
    for msg in chat_history[-6:]:
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
) -> Dict[str, Any]:
    """Generate an AI reply using RAG context from document chunks.

    Args:
        user_message: The user's question.
        chat_history: Previous messages in the conversation.
        use_rag: Whether to search documents for context.

    Returns:
        Dict with 'reply', 'sources', and 'context_used'.
    """
    if chat_history is None:
        chat_history = []

    # RAG: search for relevant document chunks
    context_chunks = []
    if use_rag:
        try:
            context_chunks = search_chunks(user_message, limit=5)
        except Exception as e:
            logger.error(f"RAG search failed: {e}")

    # Build messages
    messages = build_messages(user_message, context_chunks, chat_history)

    # Call LLM
    try:
        client = openai.OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        model = os.environ.get("LLM_MODEL", "gpt-4o-mini")

        # Reasoning models (gpt-5*, o1*, o3*) don't support temperature
        is_reasoning = any(model.startswith(p) for p in ("gpt-5", "o1", "o3"))
        params = dict(
            model=model,
            messages=messages,
            max_completion_tokens=16000,
        )
        if not is_reasoning:
            params["temperature"] = 0.3

        response = client.chat.completions.create(**params)
        reply = response.choices[0].message.content or ""
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        reply = ("Λυπάμαι, αντιμετώπισα τεχνικό πρόβλημα. "
                "Παρακαλώ δοκιμάστε ξανά σε λίγο.")

    # Extract sources
    sources = list(set(
        c.get("source_path", "") for c in context_chunks if c.get("source_path")
    ))

    return {
        "reply": reply + DISCLAIMER_TEXT,
        "sources": sources,
        "context_used": len(context_chunks) > 0,
        "chunks_found": len(context_chunks),
    }
