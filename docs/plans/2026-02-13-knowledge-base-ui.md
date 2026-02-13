# Knowledge Base UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a separate admin-only Knowledge Base page where the admin uploads curated `.md`/`.txt` files that auto-ingest into pgvector for the AI Assistant's RAG search.

**Architecture:** New `knowledge/` directory at project root stores curated documents (separate from `content/` which serves Apothecary downloads). Upload triggers synchronous chunk+embed via the existing `process_file()` pipeline. A new `KnowledgeBasePage` in the frontend provides folder management, upload dropzone, and ingestion stats. Only admin users can access it.

**Tech Stack:** Flask backend (existing routes.py pattern), React + shadcn/ui frontend (Dialog, Card, Button, Progress), existing `knowledge.py` + `embeddings.py` AI module, pgvector (DocumentIndex + FileChunk models).

---

## Task 1: Create `knowledge/` directory and backend config

**Files:**
- Create: `knowledge/.gitkeep`
- Modify: `backend/my_project/__init__.py:36` (add KNOWLEDGE_FOLDER config)

**Step 1: Create the knowledge directory**

```bash
mkdir knowledge
touch knowledge/.gitkeep
```

**Step 2: Add KNOWLEDGE_FOLDER to app config**

In `backend/my_project/__init__.py`, after the UPLOAD_FOLDER line (line 36):

```python
app.config['KNOWLEDGE_FOLDER'] = os.environ.get(
    'KNOWLEDGE_FOLDER',
    os.path.join(os.path.dirname(__file__), '..', '..', 'knowledge')
)
```

**Step 3: Verify config loads**

```bash
cd backend && python -c "
from my_project import create_app
app = create_app()
with app.app_context():
    print('KNOWLEDGE_FOLDER:', app.config['KNOWLEDGE_FOLDER'])
    import os
    print('Exists:', os.path.exists(app.config['KNOWLEDGE_FOLDER']))
"
```

Expected: prints path and `Exists: True`.

**Step 4: Commit**

```bash
git add knowledge/.gitkeep backend/my_project/__init__.py
git commit -m "feat(knowledge): add knowledge/ directory and KNOWLEDGE_FOLDER config"
```

---

## Task 2: Backend API — list files and folders

**Files:**
- Modify: `backend/my_project/routes.py` (add knowledge endpoints)

**Step 1: Add the list endpoint**

Add after the existing `/api/knowledge/stats` endpoint (around line 908) in `routes.py`:

```python
# ============================================================================
# KNOWLEDGE BASE MANAGEMENT ROUTES (admin only)
# ============================================================================

@main_bp.route('/api/knowledge/files', methods=['GET'])
@jwt_required()
def knowledge_list_files():
    """List all folders and files in the knowledge base directory."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    if not os.path.isabs(knowledge_dir):
        knowledge_dir = os.path.abspath(knowledge_dir)

    if not os.path.exists(knowledge_dir):
        os.makedirs(knowledge_dir)

    tree = _scan_knowledge_dir(knowledge_dir)
    return jsonify({'folders': tree}), 200


def _scan_knowledge_dir(base_dir):
    """Scan knowledge directory and return folder/file tree."""
    result = []
    try:
        for entry in sorted(os.listdir(base_dir)):
            if entry.startswith('.'):
                continue
            full_path = os.path.join(base_dir, entry)
            rel_path = os.path.relpath(full_path, base_dir)

            if os.path.isdir(full_path):
                files = []
                for fname in sorted(os.listdir(full_path)):
                    if fname.startswith('.'):
                        continue
                    fpath = os.path.join(full_path, fname)
                    if os.path.isfile(fpath):
                        # Look up chunk count from DocumentIndex
                        doc = DocumentIndex.query.filter_by(file_path=fpath).first()
                        files.append({
                            'name': fname,
                            'path': os.path.relpath(fpath, base_dir),
                            'size': os.path.getsize(fpath),
                            'chunks': doc.chunk_count if doc else 0,
                            'status': doc.status if doc else 'not_indexed',
                        })
                result.append({
                    'name': entry,
                    'path': rel_path,
                    'files': files,
                    'file_count': len(files),
                })
            elif os.path.isfile(full_path):
                # Root-level files
                doc = DocumentIndex.query.filter_by(file_path=full_path).first()
                result.append({
                    'name': entry,
                    'path': rel_path,
                    'size': os.path.getsize(full_path),
                    'chunks': doc.chunk_count if doc else 0,
                    'status': doc.status if doc else 'not_indexed',
                    'is_file': True,
                })
    except OSError as e:
        current_app.logger.error(f"Error scanning knowledge dir: {e}")

    return result
```

**Step 2: Verify endpoint works**

```bash
cd backend && python -c "
from my_project import create_app
app = create_app()
client = app.test_client()
# Login as admin
resp = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
token = resp.get_json()['access_token']
# List files
resp = client.get('/api/knowledge/files', headers={'Authorization': f'Bearer {token}'})
print(resp.status_code, resp.get_json())
"
```

Expected: `200 {'folders': []}` (empty knowledge dir).

**Step 3: Commit**

```bash
git add backend/my_project/routes.py
git commit -m "feat(knowledge): add GET /api/knowledge/files endpoint"
```

---

## Task 3: Backend API — create folder

**Files:**
- Modify: `backend/my_project/routes.py`

**Step 1: Add create-folder endpoint**

```python
@main_bp.route('/api/knowledge/folders', methods=['POST'])
@jwt_required()
def knowledge_create_folder():
    """Create a folder in the knowledge base."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    data = request.get_json()
    folder_name = data.get('name', '').strip()
    parent = data.get('parent', '').strip()

    if not folder_name:
        return jsonify({'error': 'Folder name required'}), 400

    # Sanitize: no path traversal
    if '..' in folder_name or '/' in folder_name or '\\' in folder_name:
        return jsonify({'error': 'Invalid folder name'}), 400

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    if parent:
        folder_path = os.path.join(knowledge_dir, parent, folder_name)
    else:
        folder_path = os.path.join(knowledge_dir, folder_name)

    if os.path.exists(folder_path):
        return jsonify({'error': 'Folder already exists'}), 409

    try:
        os.makedirs(folder_path)
        return jsonify({'message': 'Folder created', 'path': os.path.relpath(folder_path, knowledge_dir)}), 201
    except OSError as e:
        return jsonify({'error': str(e)}), 500
```

**Step 2: Test it**

```bash
cd backend && python -c "
from my_project import create_app
app = create_app()
client = app.test_client()
resp = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
token = resp.get_json()['access_token']
# Create folder
resp = client.post('/api/knowledge/folders',
    json={'name': 'ΝΟΜΟΘΕΣΙΑ'},
    headers={'Authorization': f'Bearer {token}'})
print(resp.status_code, resp.get_json())
# Verify it shows in listing
resp = client.get('/api/knowledge/files', headers={'Authorization': f'Bearer {token}'})
print(resp.get_json())
"
```

Expected: `201`, then listing shows the folder.

**Step 3: Commit**

```bash
git add backend/my_project/routes.py
git commit -m "feat(knowledge): add POST /api/knowledge/folders endpoint"
```

---

## Task 4: Backend API — upload file with auto-ingest

**Files:**
- Modify: `backend/my_project/routes.py`

**Step 1: Add upload endpoint**

```python
KNOWLEDGE_ALLOWED_EXTENSIONS = {'.md', '.txt'}

@main_bp.route('/api/knowledge/upload', methods=['POST'])
@jwt_required()
def knowledge_upload():
    """Upload .md/.txt file to knowledge base and auto-ingest for RAG."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    folder = request.form.get('folder', '').strip()

    if not file.filename:
        return jsonify({'error': 'No file selected'}), 400

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in KNOWLEDGE_ALLOWED_EXTENSIONS:
        return jsonify({'error': f'Only .md and .txt files are allowed (got {ext})'}), 400

    filename = secure_filename(file.filename)
    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']

    if folder:
        # Sanitize folder path
        if '..' in folder:
            return jsonify({'error': 'Invalid folder path'}), 400
        target_dir = os.path.join(knowledge_dir, folder)
    else:
        target_dir = knowledge_dir

    os.makedirs(target_dir, exist_ok=True)
    file_path = os.path.join(target_dir, filename)
    file.save(file_path)

    # Auto-ingest: chunk + embed
    from my_project.ai.knowledge import process_file
    try:
        result = process_file(file_path, generate_vectors=True)
        chunk_count = result.chunk_count if result else 0
        status = result.status if result else 'error'
    except Exception as e:
        current_app.logger.error(f"Knowledge ingest failed for {filename}: {e}")
        chunk_count = 0
        status = 'error'

    return jsonify({
        'message': 'File uploaded and indexed',
        'filename': filename,
        'path': os.path.relpath(file_path, knowledge_dir),
        'chunks': chunk_count,
        'status': status,
    }), 201
```

**Step 2: Test upload with a small .md file**

Create a test file `knowledge/test.md` with some content, then test the endpoint manually or with curl. Verify that the file gets saved and chunks appear in the database.

```bash
cd backend && python -c "
import io
from my_project import create_app
app = create_app()
client = app.test_client()
resp = client.post('/api/auth/login', json={'username': 'admin', 'password': 'admin123'})
token = resp.get_json()['access_token']
# Upload a .md file
data = {'file': (io.BytesIO(b'# Test Document\n\nThis is a test.'), 'test.md')}
resp = client.post('/api/knowledge/upload',
    data=data, content_type='multipart/form-data',
    headers={'Authorization': f'Bearer {token}'})
print(resp.status_code, resp.get_json())
"
```

Expected: `201` with chunk count > 0.

**Step 3: Commit**

```bash
git add backend/my_project/routes.py
git commit -m "feat(knowledge): add POST /api/knowledge/upload with auto-ingest"
```

---

## Task 5: Backend API — delete file and delete folder

**Files:**
- Modify: `backend/my_project/routes.py`

**Step 1: Add delete endpoints**

```python
@main_bp.route('/api/knowledge/files/<path:file_path>', methods=['DELETE'])
@jwt_required()
def knowledge_delete_file(file_path):
    """Delete a file from knowledge base and remove its chunks."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    full_path = os.path.abspath(os.path.join(knowledge_dir, file_path))

    # Security: ensure path is inside knowledge_dir
    if not full_path.startswith(os.path.abspath(knowledge_dir)):
        return jsonify({'error': 'Invalid path'}), 400

    if not os.path.isfile(full_path):
        return jsonify({'error': 'File not found'}), 404

    # Remove chunks from database
    doc = DocumentIndex.query.filter_by(file_path=full_path).first()
    if doc:
        db.session.delete(doc)  # cascade deletes FileChunks
        db.session.commit()

    # Remove physical file
    os.remove(full_path)

    return jsonify({'message': 'File deleted'}), 200


@main_bp.route('/api/knowledge/folders/<path:folder_path>', methods=['DELETE'])
@jwt_required()
def knowledge_delete_folder(folder_path):
    """Delete a folder and all its files/chunks from knowledge base."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    full_path = os.path.abspath(os.path.join(knowledge_dir, folder_path))

    if not full_path.startswith(os.path.abspath(knowledge_dir)):
        return jsonify({'error': 'Invalid path'}), 400

    if not os.path.isdir(full_path):
        return jsonify({'error': 'Folder not found'}), 404

    # Remove all indexed documents under this folder
    docs = DocumentIndex.query.filter(DocumentIndex.file_path.startswith(full_path)).all()
    for doc in docs:
        db.session.delete(doc)
    db.session.commit()

    # Remove physical folder
    import shutil
    shutil.rmtree(full_path)

    return jsonify({'message': 'Folder deleted'}), 200
```

**Step 2: Test delete**

Quick manual test: upload a file (Task 4), then delete it, verify chunks are gone.

**Step 3: Commit**

```bash
git add backend/my_project/routes.py
git commit -m "feat(knowledge): add DELETE endpoints for files and folders"
```

---

## Task 6: Backend API — reindex all

**Files:**
- Modify: `backend/my_project/routes.py`

**Step 1: Add reindex endpoint**

```python
@main_bp.route('/api/knowledge/reindex', methods=['POST'])
@jwt_required()
def knowledge_reindex():
    """Re-ingest all files in the knowledge directory."""
    admin_check = require_admin()
    if admin_check:
        return admin_check

    knowledge_dir = current_app.config['KNOWLEDGE_FOLDER']
    if not os.path.exists(knowledge_dir):
        return jsonify({'error': 'Knowledge directory not found'}), 404

    from my_project.ai.knowledge import process_file

    processed = 0
    errors = 0
    for root, dirs, files in os.walk(knowledge_dir):
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            if ext not in KNOWLEDGE_ALLOWED_EXTENSIONS:
                continue
            fpath = os.path.join(root, fname)
            try:
                process_file(fpath, generate_vectors=True)
                processed += 1
            except Exception as e:
                current_app.logger.error(f"Reindex error for {fname}: {e}")
                errors += 1

    return jsonify({
        'message': 'Reindex complete',
        'processed': processed,
        'errors': errors,
    }), 200
```

**Step 2: Commit**

```bash
git add backend/my_project/routes.py
git commit -m "feat(knowledge): add POST /api/knowledge/reindex endpoint"
```

---

## Task 7: Update knowledge stats endpoint

**Files:**
- Modify: `backend/my_project/routes.py` (existing `/api/knowledge/stats`)

**Step 1: Enhance stats to include knowledge dir info**

Replace the existing `knowledge_stats` function (around line 893):

```python
@main_bp.route('/api/knowledge/stats', methods=['GET'])
@jwt_required()
def knowledge_stats():
    """Get statistics about the knowledge base."""
    total_docs = DocumentIndex.query.filter_by(status='ready').count()
    total_chunks = FileChunk.query.count()
    embedded_chunks = FileChunk.query.filter(FileChunk.embedding.isnot(None)).count()

    # Count physical files in knowledge directory
    knowledge_dir = current_app.config.get('KNOWLEDGE_FOLDER', '')
    file_count = 0
    folder_count = 0
    if os.path.exists(knowledge_dir):
        for entry in os.listdir(knowledge_dir):
            full = os.path.join(knowledge_dir, entry)
            if entry.startswith('.'):
                continue
            if os.path.isdir(full):
                folder_count += 1
                file_count += len([f for f in os.listdir(full) if not f.startswith('.')])
            elif os.path.isfile(full):
                file_count += 1

    return jsonify({
        'total_documents': total_docs,
        'total_chunks': total_chunks,
        'embedded_chunks': embedded_chunks,
        'knowledge_files': file_count,
        'knowledge_folders': folder_count,
    }), 200
```

**Step 2: Commit**

```bash
git add backend/my_project/routes.py
git commit -m "feat(knowledge): enhance stats endpoint with file/folder counts"
```

---

## Task 8: Frontend — KnowledgeBasePage component

**Files:**
- Create: `frontend/src/pages/KnowledgeBasePage.jsx`

**Step 1: Create the page component**

Create `frontend/src/pages/KnowledgeBasePage.jsx` with the two-panel layout:

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import DropZone from '@/components/DropZone';
import api from '@/lib/api';
import { toast } from 'sonner';
import {
  FolderPlus, Upload, Trash2, RefreshCw, Database,
  FileText, FolderOpen, Folder, BookOpen, ChevronRight,
} from 'lucide-react';

export default function KnowledgeBasePage() {
  const [folders, setFolders] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  // Dialogs
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [filesRes, statsRes] = await Promise.all([
        api.get('/api/knowledge/files'),
        api.get('/api/knowledge/stats'),
      ]);
      setFolders(filesRes.data.folders || []);
      setStats(statsRes.data || {});
    } catch (err) {
      toast.error('Σφάλμα φόρτωσης βάσης γνώσεων');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/api/knowledge/folders', { name: newFolderName.trim() });
      toast.success(`Φάκελος "${newFolderName}" δημιουργήθηκε`);
      setNewFolderName('');
      setShowNewFolder(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Σφάλμα δημιουργίας φακέλου');
    }
  };

  const handleUpload = async (acceptedFiles) => {
    setUploading(true);
    let successCount = 0;
    for (const file of acceptedFiles) {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedFolder) {
        formData.append('folder', selectedFolder.path || selectedFolder.name);
      }
      try {
        const res = await api.post('/api/knowledge/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success(`${file.name}: ${res.data.chunks} chunks indexed`);
        successCount++;
      } catch (err) {
        toast.error(`${file.name}: ${err.response?.data?.error || 'Upload failed'}`);
      }
    }
    setUploading(false);
    if (successCount > 0) {
      setShowUpload(false);
      fetchData();
    }
  };

  const handleDeleteFile = async (filePath) => {
    if (!confirm('Διαγραφή αρχείου και όλων των chunks;')) return;
    try {
      await api.delete(`/api/knowledge/files/${encodeURIComponent(filePath)}`);
      toast.success('Αρχείο διαγράφηκε');
      fetchData();
    } catch (err) {
      toast.error('Σφάλμα διαγραφής');
    }
  };

  const handleDeleteFolder = async (folderPath) => {
    if (!confirm('Διαγραφή φακέλου και ΟΛΩΝ των αρχείων/chunks;')) return;
    try {
      await api.delete(`/api/knowledge/folders/${encodeURIComponent(folderPath)}`);
      toast.success('Φάκελος διαγράφηκε');
      setSelectedFolder(null);
      fetchData();
    } catch (err) {
      toast.error('Σφάλμα διαγραφής');
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const res = await api.post('/api/knowledge/reindex');
      toast.success(`Reindex: ${res.data.processed} αρχεία, ${res.data.errors} σφάλματα`);
      fetchData();
    } catch (err) {
      toast.error('Σφάλμα reindex');
    } finally {
      setReindexing(false);
    }
  };

  // Get files for selected folder
  const selectedFiles = selectedFolder?.files || [];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-[#1a3aa3] flex items-center gap-3">
            <Database className="w-8 h-8" />
            Βάση Γνώσεων AI
          </h1>
          <p className="text-[#6b6560] mt-1">
            Διαχείριση εγγράφων που τροφοδοτούν τον AI Βοηθό
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReindex} disabled={reindexing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${reindexing ? 'animate-spin' : ''}`} />
            {reindexing ? 'Reindexing...' : 'Reindex'}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-[#1a3aa3]" />
            <div>
              <p className="text-sm text-[#6b6560]">Φάκελοι</p>
              <p className="text-xl font-bold">{stats.knowledge_folders || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#2563eb]" />
            <div>
              <p className="text-sm text-[#6b6560]">Αρχεία</p>
              <p className="text-xl font-bold">{stats.knowledge_files || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-[#0891b2]" />
            <div>
              <p className="text-sm text-[#6b6560]">Chunks</p>
              <p className="text-xl font-bold">{stats.total_chunks || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Database className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm text-[#6b6560]">Embedded</p>
              <p className="text-xl font-bold">{stats.embedded_chunks || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left panel — Folder tree */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Φάκελοι</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowNewFolder(true)}>
                <FolderPlus className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {folders.filter(f => !f.is_file).length === 0 ? (
                <p className="text-sm text-[#8a8580] text-center py-8">
                  Δεν υπάρχουν φάκελοι. Δημιουργήστε έναν.
                </p>
              ) : (
                <div className="space-y-1">
                  {folders.filter(f => !f.is_file).map((folder) => (
                    <div
                      key={folder.path}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                        selectedFolder?.path === folder.path
                          ? 'bg-[#1a3aa3]/10 text-[#1a3aa3]'
                          : 'hover:bg-[#faf8f4]'
                      }`}
                      onClick={() => setSelectedFolder(folder)}
                    >
                      <div className="flex items-center gap-2">
                        {selectedFolder?.path === folder.path
                          ? <FolderOpen className="w-4 h-4" />
                          : <Folder className="w-4 h-4" />
                        }
                        <span className="text-sm font-medium truncate">{folder.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {folder.file_count}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right panel — File list */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {selectedFolder
                  ? `Περιεχόμενα: ${selectedFolder.name}`
                  : 'Επιλέξτε φάκελο'}
              </CardTitle>
              <div className="flex gap-2">
                {selectedFolder && (
                  <>
                    <Button size="sm" onClick={() => setShowUpload(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteFolder(selectedFolder.path)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {!selectedFolder ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#8a8580]">
                  <ChevronRight className="w-12 h-12 mb-2" />
                  <p>Επιλέξτε φάκελο από τα αριστερά</p>
                </div>
              ) : selectedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#8a8580]">
                  <FileText className="w-12 h-12 mb-2" />
                  <p>Κενός φάκελος — ανεβάστε αρχεία</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedFiles.map((file) => (
                    <div
                      key={file.path}
                      className="flex items-center justify-between px-4 py-3 rounded-lg bg-[#faf8f4] hover:bg-[#f0ece4] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-[#2563eb]" />
                        <div>
                          <p className="text-sm font-medium">{file.name}</p>
                          <p className="text-xs text-[#8a8580]">
                            {(file.size / 1024).toFixed(1)} KB
                            {' · '}
                            {file.chunks > 0
                              ? <span className="text-green-600">{file.chunks} chunks</span>
                              : <span className="text-orange-500">not indexed</span>
                            }
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteFile(file.path)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Νέος Φάκελος</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Όνομα φακέλου (π.χ. ΝΟΜΟΘΕΣΙΑ)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewFolder(false)}>Ακύρωση</Button>
            <Button onClick={handleCreateFolder}>Δημιουργία</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Upload στο: {selectedFolder?.name}
            </DialogTitle>
          </DialogHeader>
          <DropZone
            onDrop={handleUpload}
            maxFiles={20}
            maxSize={5 * 1024 * 1024}
          />
          {uploading && (
            <div className="mt-4">
              <p className="text-sm text-[#6b6560] mb-2">Indexing...</p>
              <Progress value={undefined} className="h-2" />
            </div>
          )}
          <p className="text-xs text-[#8a8580]">
            Μόνο .md και .txt αρχεία. Τα αρχεία θα γίνουν αυτόματα chunk + embed.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 2: Verify file created, no syntax errors**

```bash
cd frontend && npx pnpm exec eslint src/pages/KnowledgeBasePage.jsx
```

**Step 3: Commit**

```bash
git add frontend/src/pages/KnowledgeBasePage.jsx
git commit -m "feat(knowledge): add KnowledgeBasePage frontend component"
```

---

## Task 9: Add route and nav item for Knowledge Base

**Files:**
- Modify: `frontend/src/App.jsx`

**Step 1: Import and add route**

Add import near the top with other page imports:

```jsx
import KnowledgeBasePage from '@/pages/KnowledgeBasePage';
```

Add route alongside the existing `/admin` route (inside the Routes block, use the same PermissionGuard pattern):

```jsx
<Route path="/knowledge" element={
  <ProtectedRoute>
    <PermissionGuard permission="can_access_admin_dashboard" fallback={
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Δεν έχετε πρόσβαση</h1>
        <p className="text-[#6b6560]">Δεν έχετε τα απαραίτητα δικαιώματα.</p>
      </div>
    } showFallback={true}>
      <KnowledgeBasePage />
    </PermissionGuard>
  </ProtectedRoute>
} />
```

**Step 2: Add nav item**

In the `adminNavItems` array, add the Knowledge Base link (the Database icon is already available from lucide-react):

```jsx
const adminNavItems = permissions.canAccessAdminDashboard() ? [
  { path: '/admin', label: 'Διαχείριση', icon: Shield },
  { path: '/knowledge', label: 'Βάση Γνώσεων', icon: Database },
] : [];
```

Make sure `Database` is imported from lucide-react at the top.

**Step 3: Verify the app loads without errors**

```bash
cd frontend && npx pnpm dev
```

Open browser, login as admin, verify nav shows "Βάση Γνώσεων" link, click it, page loads.

**Step 4: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat(knowledge): add Knowledge Base route and nav item (admin only)"
```

---

## Task 10: End-to-end test

**No files to create — manual verification.**

**Step 1: Start infrastructure**

```bash
docker-compose up -d    # PostgreSQL + Redis
cd backend && python app.py &    # Flask on :5000
cd frontend && npx pnpm dev &    # Vite on :5173
```

**Step 2: Test the full flow**

1. Login as `admin/admin123`
2. Click "Βάση Γνώσεων" in nav
3. Create folder "ΝΟΜΟΘΕΣΙΑ"
4. Click on the folder
5. Upload a `.md` file
6. Verify chunk count appears next to file
7. Go to "AI Βοηθός"
8. Ask a question related to the uploaded document
9. Verify the AI uses the document content in its reply

**Step 3: Test edge cases**

- Try uploading a `.pdf` → should be rejected
- Try uploading without selecting folder → should upload to root
- Delete a file → verify chunks removed from stats
- Delete a folder → verify all files and chunks removed
- Click Reindex → verify counts update

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(knowledge): complete Knowledge Base UI with auto-ingest RAG"
```

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | `knowledge/` dir + config | `knowledge/.gitkeep`, `__init__.py` |
| 2 | GET `/api/knowledge/files` | `routes.py` |
| 3 | POST `/api/knowledge/folders` | `routes.py` |
| 4 | POST `/api/knowledge/upload` (auto-ingest) | `routes.py` |
| 5 | DELETE files + folders | `routes.py` |
| 6 | POST `/api/knowledge/reindex` | `routes.py` |
| 7 | Enhanced stats endpoint | `routes.py` |
| 8 | `KnowledgeBasePage.jsx` | New frontend page |
| 9 | Route + nav item | `App.jsx` |
| 10 | End-to-end manual test | — |
