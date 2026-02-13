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
