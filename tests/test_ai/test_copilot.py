# tests/test_ai/test_copilot.py
import pytest

def test_build_system_prompt():
    """System prompt should include Greek social welfare context."""
    from my_project.ai.copilot import build_system_prompt
    prompt = build_system_prompt()
    assert "κοινωνικ" in prompt.lower() or "social" in prompt.lower()

def test_build_messages_with_context():
    """Messages should include document context when provided."""
    from my_project.ai.copilot import build_messages
    context_chunks = [
        {"content": "Νόμος 4455/2017 περί αδειοδότησης", "source_path": "test.pdf"}
    ]
    messages = build_messages(
        user_message="Τι λέει ο νόμος για αδειοδότηση;",
        context_chunks=context_chunks,
        chat_history=[],
    )
    # Should have system + user messages
    assert messages[0]["role"] == "system"
    assert any("4455" in m.get("content", "") for m in messages)

def test_build_messages_preserves_20_messages():
    """Chat history should retain up to 20 messages, not just 6."""
    from my_project.ai.copilot import build_messages
    # Create 24 messages (12 rounds of Q&A)
    history = [
        {"role": "user" if i % 2 == 0 else "assistant", "content": f"Message {i}"}
        for i in range(24)
    ]
    messages = build_messages(
        user_message="Latest question",
        context_chunks=[],
        chat_history=history,
    )
    # system prompt + 20 history messages + current user message = 22
    history_messages = [m for m in messages if m["content"].startswith("Message")]
    assert len(history_messages) == 20
    # Should keep the LAST 20 (messages 4-23), not the first 20
    assert history_messages[0]["content"] == "Message 4"
    assert history_messages[-1]["content"] == "Message 23"

def test_build_messages_includes_user_context():
    """Messages should include user context when provided."""
    from my_project.ai.copilot import build_messages
    messages = build_messages(
        user_message="Πώς αδειοδοτώ ΚΔΑΠ;",
        context_chunks=[],
        chat_history=[],
        user_context={"username": "maria", "role": "staff"},
    )
    # Should have a system message mentioning the user's role
    system_msgs = [m for m in messages if m["role"] == "system"]
    combined = " ".join(m["content"] for m in system_msgs)
    assert "maria" in combined
    assert "staff" in combined


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
