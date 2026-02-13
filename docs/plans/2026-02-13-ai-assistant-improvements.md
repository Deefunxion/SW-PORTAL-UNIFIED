# AI Assistant Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 identified weaknesses in the AI assistant: expand conversation memory, add chat persistence, inject user context, improve keyword search fallback, increase chunk size for legislative texts, and make rate limits environment-aware.

**Architecture:** Server-side chat session storage in PostgreSQL (new `ChatSession`/`ChatMessage` models). Frontend loads/saves via REST endpoints. Backend injects user identity into system prompt. Chunking and rate limits become configurable. All changes are backward-compatible — no migrations needed (Flask-SQLAlchemy `create_all` handles new tables).

**Tech Stack:** Flask, SQLAlchemy, Flask-JWT-Extended, React (useState/useEffect), OpenAI API, pgvector, pytest

---

## Task 1: Expand Conversation Memory (6 → 20 messages)

**Problem:** Both frontend and backend hard-cap at 6 messages (3 Q&A rounds). Complex legislative conversations lose context fast.

**Files:**
- Modify: `frontend/src/pages/AssistantPage.jsx:61` — change `.slice(-6)` to `.slice(-20)`
- Modify: `backend/my_project/ai/copilot.py:70` — change `chat_history[-6:]` to `chat_history[-20:]`
- Test: `tests/test_ai/test_copilot.py`

**Step 1: Write the failing test**

Add to `tests/test_ai/test_copilot.py`:

```python
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
```

**Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_ai/test_copilot.py::test_build_messages_preserves_20_messages -v`
Expected: FAIL — currently only 6 history messages retained.

**Step 3: Apply the backend fix**

In `backend/my_project/ai/copilot.py`, line 70, change:
```python
    for msg in chat_history[-6:]:
```
to:
```python
    for msg in chat_history[-20:]:
```

**Step 4: Apply the frontend fix**

In `frontend/src/pages/AssistantPage.jsx`, line 61, change:
```javascript
        .slice(-6);
```
to:
```javascript
        .slice(-20);
```

**Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_ai/test_copilot.py -v`
Expected: ALL PASS

**Step 6: Commit**

```bash
git add backend/my_project/ai/copilot.py frontend/src/pages/AssistantPage.jsx tests/test_ai/test_copilot.py
git commit -m "feat(ai): expand conversation memory from 6 to 20 messages"
```

---

## Task 2: Add Chat Persistence — Backend Models + API

**Problem:** Page refresh loses the entire conversation. We need server-side storage.

**Files:**
- Modify: `backend/my_project/models.py` — add `ChatSession` and `ChatMessage` models
- Modify: `backend/my_project/routes.py` — add 4 new endpoints
- Modify: `backend/my_project/__init__.py:98` — import new models so `create_all` creates tables
- Create: `tests/test_api/test_chat_sessions.py`

### Step 1: Write the failing tests

Create `tests/test_api/test_chat_sessions.py`:

```python
"""Tests for chat session persistence API."""
import pytest


def test_create_chat_session(client, auth_headers):
    """POST /api/chat/sessions should create a new session."""
    resp = client.post('/api/chat/sessions', json={
        'title': 'Ερώτηση αδειοδότησης'
    }, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.get_json()
    assert 'id' in data
    assert data['title'] == 'Ερώτηση αδειοδότησης'


def test_list_chat_sessions(client, auth_headers):
    """GET /api/chat/sessions should return user's sessions."""
    # Create two sessions
    client.post('/api/chat/sessions', json={'title': 'Session 1'}, headers=auth_headers)
    client.post('/api/chat/sessions', json={'title': 'Session 2'}, headers=auth_headers)

    resp = client.get('/api/chat/sessions', headers=auth_headers)
    assert resp.status_code == 200
    sessions = resp.get_json()
    # Should have at least the 2 we just created (may have more from other tests)
    titles = [s['title'] for s in sessions]
    assert 'Session 1' in titles
    assert 'Session 2' in titles


def test_get_session_messages(client, auth_headers):
    """GET /api/chat/sessions/<id>/messages should return messages."""
    # Create session
    resp = client.post('/api/chat/sessions', json={'title': 'Test'}, headers=auth_headers)
    session_id = resp.get_json()['id']

    # Get messages (empty initially)
    resp = client.get(f'/api/chat/sessions/{session_id}/messages', headers=auth_headers)
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_delete_chat_session(client, auth_headers):
    """DELETE /api/chat/sessions/<id> should delete session."""
    resp = client.post('/api/chat/sessions', json={'title': 'To Delete'}, headers=auth_headers)
    session_id = resp.get_json()['id']

    resp = client.delete(f'/api/chat/sessions/{session_id}', headers=auth_headers)
    assert resp.status_code == 200

    # Should be gone
    resp = client.get(f'/api/chat/sessions/{session_id}/messages', headers=auth_headers)
    assert resp.status_code == 404


def test_chat_stores_messages_in_session(client, auth_headers):
    """POST /api/chat with session_id should persist messages."""
    # Create session
    resp = client.post('/api/chat/sessions', json={'title': 'Persistence Test'}, headers=auth_headers)
    session_id = resp.get_json()['id']

    # Send a chat message with session_id (will fail without OPENAI_API_KEY,
    # but messages should still be stored before the LLM call)
    resp = client.post('/api/chat', json={
        'message': 'Τι είναι ΚΔΑΠ;',
        'session_id': session_id,
        'chat_history': []
    }, headers=auth_headers)
    # Even if LLM fails, we get 200 with an error reply
    assert resp.status_code == 200

    # Verify messages were stored
    resp = client.get(f'/api/chat/sessions/{session_id}/messages', headers=auth_headers)
    messages = resp.get_json()
    assert len(messages) >= 1  # At least the user message
    assert any(m['content'] == 'Τι είναι ΚΔΑΠ;' for m in messages)


def test_session_belongs_to_user(client, auth_headers, app):
    """Users should not access other users' sessions."""
    # Create session as testuser
    resp = client.post('/api/chat/sessions', json={'title': 'Private'}, headers=auth_headers)
    session_id = resp.get_json()['id']

    # Create a second user
    from my_project.models import User
    from my_project.extensions import db
    with app.app_context():
        user2 = User.query.filter_by(username='otheruser').first()
        if not user2:
            user2 = User(username='otheruser', email='other@example.com', role='guest')
            user2.set_password('otherpass123')
            db.session.add(user2)
            db.session.commit()

    # Login as second user
    resp = client.post('/api/auth/login', json={
        'username': 'otheruser', 'password': 'otherpass123'
    })
    other_headers = {'Authorization': f'Bearer {resp.get_json()["access_token"]}'}

    # Try to access first user's session
    resp = client.get(f'/api/chat/sessions/{session_id}/messages', headers=other_headers)
    assert resp.status_code == 404  # Not found (not 403 — don't leak existence)
```

### Step 2: Run tests to verify they fail

Run: `python -m pytest tests/test_api/test_chat_sessions.py -v`
Expected: FAIL — no routes or models exist yet.

### Step 3: Add models

Add to `backend/my_project/models.py`, **before** the `AuditLog` class:

```python
# ============================================================================
# AI CHAT SESSION MODELS
# ============================================================================

class ChatSession(db.Model):
    """A conversation session with the AI assistant."""
    __tablename__ = 'chat_sessions'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    title = db.Column(db.String(200), default='Νέα Συζήτηση')
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, default=db.func.now(), onupdate=db.func.now())

    messages = db.relationship('ChatMessage', backref='session', lazy='dynamic',
                               cascade='all, delete-orphan',
                               order_by='ChatMessage.created_at')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'message_count': self.messages.count(),
        }


class ChatMessage(db.Model):
    """A single message in a chat session."""
    __tablename__ = 'chat_messages'

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey('chat_sessions.id'), nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False)  # 'user' or 'assistant'
    content = db.Column(db.Text, nullable=False)
    sources = db.Column(db.Text, default='')  # JSON list of source paths
    created_at = db.Column(db.DateTime, default=db.func.now())

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'role': self.role,
            'content': self.content,
            'sources': json.loads(self.sources) if self.sources else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
```

### Step 4: Register models for table creation

In `backend/my_project/__init__.py`, line 98, change:

```python
from .models import User, Category, Discussion, Post, FileItem, AuditLog
```
to:
```python
from .models import User, Category, Discussion, Post, FileItem, AuditLog, ChatSession, ChatMessage
```

### Step 5: Add API routes

In `backend/my_project/routes.py`, add after the existing AI chat routes (after line 774):

```python
# ============================================================================
# CHAT SESSION ROUTES
# ============================================================================

@main_bp.route('/api/chat/sessions', methods=['POST'])
@jwt_required()
def create_chat_session():
    """Create a new chat session."""
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    session = ChatSession(
        user_id=user_id,
        title=data.get('title', 'Νέα Συζήτηση')[:200],
    )
    db.session.add(session)
    db.session.commit()
    return jsonify(session.to_dict()), 201


@main_bp.route('/api/chat/sessions', methods=['GET'])
@jwt_required()
def list_chat_sessions():
    """List current user's chat sessions (newest first)."""
    user_id = int(get_jwt_identity())
    sessions = ChatSession.query.filter_by(user_id=user_id)\
        .order_by(ChatSession.updated_at.desc()).all()
    return jsonify([s.to_dict() for s in sessions]), 200


@main_bp.route('/api/chat/sessions/<int:session_id>/messages', methods=['GET'])
@jwt_required()
def get_session_messages(session_id):
    """Get all messages in a chat session."""
    user_id = int(get_jwt_identity())
    session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    messages = session.messages.all()
    return jsonify([m.to_dict() for m in messages]), 200


@main_bp.route('/api/chat/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_chat_session(session_id):
    """Delete a chat session and all its messages."""
    user_id = int(get_jwt_identity())
    session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
    if not session:
        return jsonify({'error': 'Session not found'}), 404
    db.session.delete(session)
    db.session.commit()
    return jsonify({'message': 'Session deleted'}), 200
```

### Step 6: Modify `/api/chat` to persist messages when `session_id` is provided

In `backend/my_project/routes.py`, update the `ai_chat()` function to accept an optional `session_id` and store messages:

Replace the existing `ai_chat` function (lines 757-774) with:

```python
def ai_chat():
    """AI Assistant — chat with RAG context from social welfare documents."""
    data = request.get_json()
    message = data.get('message', '').strip()

    if not message:
        return jsonify({'error': 'Παρακαλώ εισάγετε μήνυμα'}), 400

    chat_history = data.get('chat_history', [])
    session_id = data.get('session_id')

    # If session_id provided, verify ownership and store user message
    user_id = int(get_jwt_identity())
    session = None
    if session_id:
        session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
        if session:
            import json
            db.session.add(ChatMessage(
                session_id=session.id, role='user', content=message, sources='[]'
            ))
            db.session.flush()

    from my_project.ai.copilot import get_chat_reply
    result = get_chat_reply(
        user_message=message,
        chat_history=chat_history,
        use_rag=True,
    )

    # Store assistant reply in session
    if session:
        import json
        db.session.add(ChatMessage(
            session_id=session.id,
            role='assistant',
            content=result['reply'],
            sources=json.dumps(result.get('sources', [])),
        ))
        db.session.commit()

    return jsonify(result), 200
```

Add `ChatSession, ChatMessage` to the models import at the top of `routes.py` (wherever other models are imported).

### Step 7: Run tests to verify they pass

Run: `python -m pytest tests/test_api/test_chat_sessions.py -v`
Expected: ALL PASS

### Step 8: Commit

```bash
git add backend/my_project/models.py backend/my_project/routes.py backend/my_project/__init__.py tests/test_api/test_chat_sessions.py
git commit -m "feat(ai): add chat session persistence with CRUD API"
```

---

## Task 3: Add Chat Persistence — Frontend Integration

**Problem:** Frontend needs UI to load/save/switch between sessions.

**Files:**
- Modify: `frontend/src/pages/AssistantPage.jsx` — add session sidebar, load/save logic

### Step 1: Add session state and API calls to AssistantPage

In `frontend/src/pages/AssistantPage.jsx`, add session management. The key changes:

1. **New state variables** (add after existing state declarations, ~line 26):
```javascript
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showSessions, setShowSessions] = useState(false);
```

2. **Load sessions on mount** (add a new `useEffect` after the welcome message one, ~line 39):
```javascript
  useEffect(() => {
    api.get('/api/chat/sessions')
      .then(({ data }) => setSessions(data))
      .catch(() => {});
  }, []);
```

3. **Helper functions** (add after `clearChat`, ~line 92):
```javascript
  const createSession = async () => {
    try {
      const { data } = await api.post('/api/chat/sessions', {
        title: `Συζήτηση ${new Date().toLocaleDateString('el-GR')}`
      });
      setSessions(prev => [data, ...prev]);
      setActiveSessionId(data.id);
      setMessages([{
        id: 'welcome', type: 'assistant',
        content: 'Γεια σας! Πώς μπορώ να σας βοηθήσω;',
        sources: [], timestamp: new Date().toISOString()
      }]);
    } catch { /* ignore */ }
  };

  const loadSession = async (sessionId) => {
    try {
      const { data } = await api.get(`/api/chat/sessions/${sessionId}/messages`);
      setActiveSessionId(sessionId);
      const loaded = data.map((m, i) => ({
        id: m.id?.toString() || `loaded-${i}`,
        type: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
        sources: m.sources || [],
        timestamp: m.created_at || new Date().toISOString()
      }));
      setMessages([
        {
          id: 'welcome', type: 'assistant',
          content: 'Γεια σας! Πώς μπορώ να σας βοηθήσω;',
          sources: [], timestamp: new Date().toISOString()
        },
        ...loaded
      ]);
      setShowSessions(false);
    } catch { /* ignore */ }
  };

  const deleteSession = async (sessionId) => {
    try {
      await api.delete(`/api/chat/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        clearChat();
      }
    } catch { /* ignore */ }
  };
```

4. **Modify `handleSendMessage`**: When sending a message, if no active session exists, auto-create one. Pass `session_id` to the API. In the `api.post('/api/chat', ...)` call body, add:
```javascript
      const { data } = await api.post('/api/chat', {
        message: text,
        chat_history: chatHistory,
        session_id: activeSessionId,
      });
```

Before the `api.post` call, auto-create a session if none exists:
```javascript
      let currentSessionId = activeSessionId;
      if (!currentSessionId) {
        try {
          const { data: newSession } = await api.post('/api/chat/sessions', {
            title: text.slice(0, 60) + (text.length > 60 ? '...' : '')
          });
          currentSessionId = newSession.id;
          setActiveSessionId(newSession.id);
          setSessions(prev => [newSession, ...prev]);
        } catch { /* continue without persistence */ }
      }
```

5. **Add session sidebar UI**: Add a collapsible panel in the chat card header showing recent sessions. Add a `History` icon import from lucide-react and a toggle button next to the existing clear button. The sidebar should list sessions with title, date, message count, and a delete button.

### Step 2: Verify manually

Run frontend with `npx pnpm dev` and backend with `python app.py`. Create a session, send messages, refresh the page — messages should persist.

### Step 3: Commit

```bash
git add frontend/src/pages/AssistantPage.jsx
git commit -m "feat(ai): add chat session sidebar with persistence in AssistantPage"
```

---

## Task 4: Inject User Context into System Prompt

**Problem:** The AI doesn't know who's asking — a staff member and an admin get the same generic response.

**Files:**
- Modify: `backend/my_project/ai/copilot.py` — add `user_context` parameter to `build_messages` and `get_chat_reply`
- Modify: `backend/my_project/routes.py` — pass user info from JWT to `get_chat_reply`
- Test: `tests/test_ai/test_copilot.py`

### Step 1: Write the failing test

Add to `tests/test_ai/test_copilot.py`:

```python
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
```

### Step 2: Run test to verify it fails

Run: `python -m pytest tests/test_ai/test_copilot.py::test_build_messages_includes_user_context -v`
Expected: FAIL — `build_messages` doesn't accept `user_context`.

### Step 3: Implement user context injection

In `backend/my_project/ai/copilot.py`:

**Modify `build_messages` signature** (line 47) to accept optional `user_context`:

```python
def build_messages(
    user_message: str,
    context_chunks: List[Dict[str, Any]],
    chat_history: List[Dict[str, str]],
    user_context: Optional[Dict[str, str]] = None,
) -> List[Dict[str, str]]:
```

Add `Optional` to the imports on line 8 if not present (it's already there).

**After the document context block** (after line 67), add:

```python
    # Add user context if available
    if user_context:
        user_info = (
            f"Ο χρήστης που ρωτάει: {user_context.get('username', 'Άγνωστος')}, "
            f"ρόλος: {user_context.get('role', 'guest')}. "
            f"Προσάρμοσε το επίπεδο λεπτομέρειας ανάλογα με τον ρόλο."
        )
        messages.append({"role": "system", "content": user_info})
```

**Modify `get_chat_reply` signature** (line 82) to accept `user_context`:

```python
def get_chat_reply(
    user_message: str,
    chat_history: Optional[List[Dict[str, str]]] = None,
    use_rag: bool = True,
    user_context: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
```

**Pass it through** in the `build_messages` call (line 109):

```python
    messages = build_messages(user_message, context_chunks, chat_history, user_context)
```

### Step 4: Pass user context from route

In `backend/my_project/routes.py`, inside the `ai_chat()` function, after getting `user_id`, look up the user and pass context:

```python
    user = User.query.get(user_id)
    user_context = {
        'username': user.username,
        'role': user.role,
    } if user else None
```

And pass to `get_chat_reply`:

```python
    result = get_chat_reply(
        user_message=message,
        chat_history=chat_history,
        use_rag=True,
        user_context=user_context,
    )
```

Make sure `User` is imported at the top of routes.py (it likely already is).

### Step 5: Run tests

Run: `python -m pytest tests/test_ai/test_copilot.py -v`
Expected: ALL PASS

### Step 6: Commit

```bash
git add backend/my_project/ai/copilot.py backend/my_project/routes.py tests/test_ai/test_copilot.py
git commit -m "feat(ai): inject user identity and role into AI system prompt"
```

---

## Task 5: Improve Keyword Fallback Search

**Problem:** `_fallback_keyword_search` loads 500 chunks into Python memory and brute-forces keyword matching. Won't scale.

**Files:**
- Modify: `backend/my_project/ai/knowledge.py:230-249` — replace with SQL `LIKE` query
- Test: `tests/test_ai/test_knowledge.py`

### Step 1: Write the failing test

Add to `tests/test_ai/test_knowledge.py`:

```python
def test_fallback_keyword_search(app):
    """Fallback search should find chunks by keyword without loading all into memory."""
    with app.app_context():
        from my_project.ai.knowledge import process_document_text, _fallback_keyword_search
        from my_project.extensions import db

        # Ingest a document with known content
        process_document_text(
            text="Η αδειοδότηση ΚΔΑΠ απαιτεί συγκεκριμένα δικαιολογητικά.\n\nΟι μονάδες φροντίδας ηλικιωμένων λειτουργούν βάσει νόμου.",
            source_path="test/fallback_search.txt",
            file_name="fallback_search.txt",
            file_type="txt",
        )

        results = _fallback_keyword_search("αδειοδότηση ΚΔΑΠ", limit=5)
        assert len(results) >= 1
        assert any("ΚΔΑΠ" in r["content"] for r in results)
```

### Step 2: Run test to verify it passes (baseline)

Run: `python -m pytest tests/test_ai/test_knowledge.py::test_fallback_keyword_search -v`
Expected: PASS (existing brute-force works). This confirms the test is valid before we refactor.

### Step 3: Replace brute-force with SQL LIKE

In `backend/my_project/ai/knowledge.py`, replace `_fallback_keyword_search` (lines 230-249):

```python
def _fallback_keyword_search(query: str, limit: int) -> List[Dict[str, Any]]:
    """Keyword search fallback using SQL LIKE (no full-table scan in Python)."""
    keywords = [kw for kw in query.lower().split() if len(kw) >= 2]
    if not keywords:
        return []

    # Build OR filter: match any keyword via SQL LIKE
    from sqlalchemy import or_, func
    filters = [func.lower(FileChunk.content).contains(kw) for kw in keywords]
    results = FileChunk.query.filter(or_(*filters)).limit(limit * 3).all()

    # Score and sort by number of keywords matched
    scored = []
    for chunk in results:
        content_lower = chunk.content.lower()
        score = sum(1 for kw in keywords if kw in content_lower)
        scored.append({
            "content": chunk.content,
            "source_path": chunk.source_path,
            "chunk_type": chunk.chunk_type,
            "similarity": score / len(keywords),
            "document_id": chunk.document_id,
        })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:limit]
```

### Step 4: Run test to verify it still passes

Run: `python -m pytest tests/test_ai/test_knowledge.py -v`
Expected: ALL PASS

### Step 5: Commit

```bash
git add backend/my_project/ai/knowledge.py tests/test_ai/test_knowledge.py
git commit -m "fix(ai): replace brute-force keyword search with SQL LIKE query"
```

---

## Task 6: Increase Chunk Size for Legislative Texts

**Problem:** 500-char chunks split legislative articles into incoherent fragments. Greek legislation articles can easily be 2000+ characters.

**Files:**
- Modify: `backend/my_project/ai/knowledge.py:111` — increase defaults
- Modify: `backend/my_project/ai/embeddings.py:37` — increase defaults
- Test: `tests/test_ai/test_embeddings.py`

### Step 1: Write the failing test

Add to `tests/test_ai/test_embeddings.py`:

```python
def test_chunk_size_handles_legislative_text():
    """Chunks should be ~1200 chars to keep legislative articles intact."""
    from my_project.ai.embeddings import chunk_text
    # Simulate a legislative article (single paragraph, ~1000 chars)
    article = "Άρθρο 1. " + ("Σύμφωνα με τις διατάξεις του παρόντος νόμου, " * 25)  # ~1100 chars
    chunks = chunk_text(article)
    # With 1200-char chunks, this should fit in 1 chunk (not split into 3 like with 500-char)
    assert len(chunks) <= 2
    # The first chunk should contain the full article opening
    assert chunks[0].content.startswith("Άρθρο 1.")
```

### Step 2: Run test to verify it fails

Run: `python -m pytest tests/test_ai/test_embeddings.py::test_chunk_size_handles_legislative_text -v`
Expected: FAIL — with 500-char default, this creates 3+ chunks.

### Step 3: Update default chunk size

In `backend/my_project/ai/embeddings.py`, line 37, change defaults:
```python
def chunk_text(
    text: str,
    chunk_size: int = 1200,
    overlap: int = 200,
) -> List[TextChunk]:
```

In `backend/my_project/ai/knowledge.py`, line 111, change the call:
```python
    chunks = chunk_text(text, chunk_size=1200, overlap=200)
```

### Step 4: Run tests

Run: `python -m pytest tests/test_ai/ -v`
Expected: ALL PASS

### Step 5: Commit

```bash
git add backend/my_project/ai/embeddings.py backend/my_project/ai/knowledge.py tests/test_ai/test_embeddings.py
git commit -m "feat(ai): increase chunk size from 500 to 1200 chars for legislative texts"
```

> **Note:** After this change, existing documents should be re-ingested to benefit from better chunking:
> `python scripts/ingest_documents.py --embed --reset`

---

## Task 7: Environment-Aware Rate Limits

**Problem:** 20 req/min is ok for demo but too low for multi-user production.

**Files:**
- Modify: `backend/my_project/routes.py:756` — make rate limit configurable
- Modify: `backend/config/__init__.py` — add rate limit config per environment
- Test: `tests/test_api/test_chat_sessions.py` (add rate limit test)

### Step 1: Write the failing test

Add to `tests/test_api/test_chat_sessions.py`:

```python
def test_chat_rate_limit_from_config(app):
    """Rate limit should be configurable via app config."""
    with app.app_context():
        # Testing config should have a rate limit value
        assert 'AI_CHAT_RATE_LIMIT' in app.config
```

### Step 2: Run test to verify it fails

Run: `python -m pytest tests/test_api/test_chat_sessions.py::test_chat_rate_limit_from_config -v`
Expected: FAIL — config key doesn't exist.

### Step 3: Add config values

In `backend/config/__init__.py`, add to each config class:

```python
# In Config (base):
AI_CHAT_RATE_LIMIT = "20 per minute"

# In DevelopmentConfig:
AI_CHAT_RATE_LIMIT = "20 per minute"

# In TestingConfig:
AI_CHAT_RATE_LIMIT = "100 per minute"

# In ProductionConfig:
AI_CHAT_RATE_LIMIT = os.getenv('AI_CHAT_RATE_LIMIT', "60 per minute")
```

### Step 4: Use config in route

In `backend/my_project/routes.py`, replace the hardcoded rate limit on the `ai_chat` route.

Change:
```python
@limiter.limit("20 per minute")
```
to:
```python
@limiter.limit(lambda: current_app.config.get('AI_CHAT_RATE_LIMIT', '20 per minute'))
```

Add `current_app` to the Flask imports at the top of routes.py if not already imported.

### Step 5: Run tests

Run: `python -m pytest tests/test_api/test_chat_sessions.py::test_chat_rate_limit_from_config -v`
Expected: PASS

Run: `python -m pytest tests/ -v`
Expected: ALL PASS (full regression)

### Step 6: Commit

```bash
git add backend/config/__init__.py backend/my_project/routes.py tests/test_api/test_chat_sessions.py
git commit -m "feat(ai): make chat rate limit configurable per environment"
```

---

## Summary of Changes

| Task | Issue | Fix | Impact |
|------|-------|-----|--------|
| 1 | 6-message memory | Expand to 20 | 10 rounds of Q&A context |
| 2 | No persistence (backend) | ChatSession + ChatMessage models, CRUD API | Server-side storage |
| 3 | No persistence (frontend) | Session sidebar, auto-save, load on refresh | Seamless UX |
| 4 | No user context | Inject username + role into system prompt | Role-aware responses |
| 5 | Brute-force fallback | SQL LIKE query | O(index) vs O(n) |
| 6 | 500-char chunks | 1200-char chunks | Intact legislative articles |
| 7 | Hardcoded rate limit | Config per environment | 20/min dev, 60/min prod |

**Post-deployment:** Run `python scripts/ingest_documents.py --embed --reset` to re-chunk documents at 1200 chars.
