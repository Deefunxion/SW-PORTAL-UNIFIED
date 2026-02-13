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
