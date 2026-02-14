# Context-Aware File Upload & Folder Creation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make upload and folder creation in ApothecaryPage context-aware — users choose WHERE files go and WHERE folders are created, with inline actions inside category dropdowns.

**Architecture:** Single-file frontend change to `ApothecaryPage.jsx`. Add folder-selector dropdowns (shadcn Select) to both modals, fix a critical form-field-name bug, and add contextual action buttons inside category dropdowns. Backend already supports all needed params — no backend changes.

**Tech Stack:** React, shadcn/ui Select, Axios, existing Flask API

---

### Task 1: Fix Critical Upload Bug — Wrong FormData Field Name

The backend reads `request.form.get('category', 'uploads')` but the frontend sends `targetFolder`. Every upload currently silently goes to `uploads/` regardless of user intent.

**Files:**
- Modify: `frontend/src/pages/ApothecaryPage.jsx:119`

**Step 1: Fix the field name**

In `handleFileUpload` (line 119), change:

```javascript
// OLD (line 119):
formData.append('targetFolder', target);

// NEW:
formData.append('category', target);
```

**Step 2: Verify the fix compiles**

Run: `cd frontend && npx pnpm dev`
Expected: No compilation errors. Dev server starts on :5173.

**Step 3: Commit**

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "fix(files): send 'category' field name matching backend API"
```

---

### Task 2: Add Imports, State, and Helper Functions

**Files:**
- Modify: `frontend/src/pages/ApothecaryPage.jsx:1-14,27,145-148`

**Step 1: Add Select and Label imports**

After line 13 (`import api from '@/lib/api';`), add:

```javascript
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select.jsx';
import { Label } from '@/components/ui/label.jsx';
```

**Step 2: Add `folderParent` state**

After line 27 (`const [uploadTargetFolder, setUploadTargetFolder] = useState('');`), add:

```javascript
const [folderParent, setFolderParent] = useState('');
```

**Step 3: Add `getFolderOptions` helper**

After `openUploadModal` (after line 148), add:

```javascript
const getFolderOptions = useCallback(() => {
  const options = [];
  files.forEach(folder => {
    const name = folder.category || folder.name;
    const path = folder.path || name;
    options.push({ label: name, value: path });
    if (folder.subfolders) {
      folder.subfolders.forEach(sub => {
        const subName = sub.category || sub.name;
        const subPath = sub.path || `${path}/${subName}`;
        options.push({ label: `  ${name} / ${subName}`, value: subPath });
      });
    }
  });
  return options;
}, [files]);
```

**Step 4: Add `openFolderModal` helper**

Right after `getFolderOptions`, add:

```javascript
const openFolderModal = (parentFolder = '') => {
  setFolderParent(parentFolder);
  setNewFolderName('');
  setShowFolderModal(true);
};
```

**Step 5: Verify the fix compiles**

Run: `cd frontend && npx pnpm dev`
Expected: No compilation errors. Dev server starts.

**Step 6: Commit**

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "feat(files): add folder selection helpers and state"
```

---

### Task 3: Update Upload Handler and Folder Creation Handler

**Files:**
- Modify: `frontend/src/pages/ApothecaryPage.jsx:115-143`

**Step 1: Rewrite `handleFileUpload` (lines 115-132)**

Replace the entire `handleFileUpload` function:

```javascript
const handleFileUpload = async (uploadedFiles) => {
  const formData = new FormData();
  const target = (uploadTargetFolder && uploadTargetFolder !== '__root__')
    ? uploadTargetFolder
    : 'uploads';
  const displayTarget = (uploadTargetFolder && uploadTargetFolder !== '__root__')
    ? uploadTargetFolder
    : 'Γενικά Αρχεία';
  Array.from(uploadedFiles).forEach(file => formData.append('file', file));
  formData.append('category', target);

  try {
    setUploadProgress(0);
    await api.post('/api/files/upload', formData);
    setUploadProgress(100);
    toast.success(`Το αρχείο ανέβηκε στον φάκελο "${displayTarget}"!`);
    setTimeout(() => {
      setShowUploadModal(false); setUploadProgress(0); setUploadTargetFolder(''); fetchFiles();
    }, 1000);
  } catch {
    toast.error('Σφάλμα ανεβάσματος');
  }
};
```

**Step 2: Rewrite `handleCreateFolder` (lines 134-143)**

Replace the entire `handleCreateFolder` function:

```javascript
const handleCreateFolder = async () => {
  if (!newFolderName.trim()) return;
  try {
    const parent = (folderParent && folderParent !== '__root__') ? folderParent : '';
    await api.post('/api/folders/create', { name: newFolderName, parent });
    const parentLabel = parent || 'Αρχειοθήκη';
    toast.success(`Ο φάκελος "${newFolderName}" δημιουργήθηκε στο "${parentLabel}"!`);
    setShowFolderModal(false); setNewFolderName(''); setFolderParent(''); fetchFiles();
  } catch {
    toast.error('Σφάλμα δημιουργίας φακέλου');
  }
};
```

**Step 3: Verify compiles**

Run: `cd frontend && npx pnpm dev`
Expected: No compilation errors.

**Step 4: Commit**

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "feat(files): context-aware upload and folder creation handlers"
```

---

### Task 4: Redesign Upload Modal with Folder Selector

**Files:**
- Modify: `frontend/src/pages/ApothecaryPage.jsx:526-554`

**Step 1: Replace upload modal (lines 526-554)**

Replace the entire `{showUploadModal && (...)}` block with:

```jsx
{showUploadModal && (
  <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-4">
    <Card className="w-full max-w-lg sm:max-w-xl rounded-2xl shadow-2xl">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-xl sm:text-2xl font-bold text-[#1a3aa3]">Ανέβασμα Αρχείων</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Folder selector */}
        <div className="mb-6">
          <Label className="text-base font-bold text-[#2a2520] mb-2 block">
            Ανέβασμα σε:
          </Label>
          <Select
            value={uploadTargetFolder || '__root__'}
            onValueChange={(val) => setUploadTargetFolder(val)}
          >
            <SelectTrigger className="w-full py-3 px-4 text-base border-2 border-[#d0d8ee] rounded-xl bg-white focus:border-[#1a3aa3]">
              <SelectValue placeholder="Επιλέξτε φάκελο..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">Γενικά Αρχεία (uploads)</SelectItem>
              {getFolderOptions().map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {uploadTargetFolder && uploadTargetFolder !== '__root__' && (
            <div className="mt-2 px-3 py-2 bg-[#eef5ee] border border-[#c8dec8] rounded-lg">
              <p className="text-sm font-medium text-[#2d6b2d] flex items-center">
                <Folder className="w-4 h-4 mr-2 flex-shrink-0" />
                Προορισμός: {uploadTargetFolder}
              </p>
            </div>
          )}
        </div>

        <DropZone onDrop={handleFileUpload} />
        {uploadProgress > 0 && (
          <div className="mt-8">
            <div className="flex justify-between text-lg font-medium mb-3">
              <span>Πρόοδος Ανεβάσματος</span><span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-[#e8e2d8] rounded-full h-4 mt-2">
              <div className="bg-[#1a3aa3] h-4 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          onClick={() => { setShowUploadModal(false); setUploadTargetFolder(''); }}
          className="mt-8 w-full py-4 text-lg font-bold hover:bg-[#f0ede6] rounded-2xl transition-all"
        >
          <X className="w-6 h-6 mr-3" /> Κλείσιμο
        </Button>
      </CardContent>
    </Card>
  </div>
)}
```

**Step 2: Verify compiles and visually inspect**

Run: `cd frontend && npx pnpm dev`
Expected: Upload modal now shows a folder dropdown above the DropZone.

**Step 3: Commit**

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "feat(files): upload modal with folder selector dropdown"
```

---

### Task 5: Redesign Folder Creation Modal with Parent Selector

**Files:**
- Modify: `frontend/src/pages/ApothecaryPage.jsx:556-589`

**Step 1: Replace folder modal (lines 556-589)**

Replace the entire `{showFolderModal && (...)}` block with:

```jsx
{showFolderModal && (
  <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-4">
    <Card className="w-full max-w-lg sm:max-w-xl rounded-2xl shadow-2xl">
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="text-xl sm:text-2xl font-bold text-[#1a3aa3]">Δημιουργία Νέου Φακέλου</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Parent folder selector */}
        <div className="mb-6">
          <Label className="text-base font-bold text-[#2a2520] mb-2 block">
            Δημιουργία μέσα σε:
          </Label>
          <Select
            value={folderParent || '__root__'}
            onValueChange={(val) => setFolderParent(val === '__root__' ? '' : val)}
          >
            <SelectTrigger className="w-full py-3 px-4 text-base border-2 border-[#d0d8ee] rounded-xl bg-white focus:border-[#1a3aa3]">
              <SelectValue placeholder="Επιλέξτε γονικό φάκελο..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__root__">Αρχειοθήκη (Ρίζα)</SelectItem>
              {getFolderOptions().map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {folderParent && (
            <div className="mt-2 px-3 py-2 bg-[#eef5ee] border border-[#c8dec8] rounded-lg">
              <p className="text-sm font-medium text-[#2d6b2d] flex items-center">
                <Folder className="w-4 h-4 mr-2 flex-shrink-0" />
                Γονικός φάκελος: {folderParent}
              </p>
            </div>
          )}
        </div>

        <Input
          placeholder="Εισάγετε το όνομα του φακέλου..."
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
          className="mb-8 py-4 px-6 text-xl border-2 rounded-2xl"
        />
        <div className="flex gap-4">
          <Button
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim()}
            className="flex-1 bg-gradient-to-r from-[#1a3aa3] to-[#152e82] hover:from-[#152e82] hover:to-[#0f2260] text-white rounded-2xl py-4 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
          >
            Δημιουργία Φακέλου
          </Button>
          <Button
            variant="outline"
            onClick={() => { setShowFolderModal(false); setFolderParent(''); }}
            className="flex-1 rounded-2xl py-4 text-lg font-bold border-2 hover:bg-[#faf8f4] transition-all"
          >
            Ακύρωση
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
)}
```

**Step 2: Update the toolbar "Νέος Φάκελος" button (line 495)**

Change:
```jsx
onClick={() => setShowFolderModal(true)}
```
To:
```jsx
onClick={() => openFolderModal('')}
```

**Step 3: Verify compiles and visually inspect**

Run: `cd frontend && npx pnpm dev`
Expected: Folder creation modal shows parent folder dropdown above the name input.

**Step 4: Commit**

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "feat(files): folder creation modal with parent folder selector"
```

---

### Task 6: Add Inline Action Buttons in Category Dropdowns

**Files:**
- Modify: `frontend/src/pages/ApothecaryPage.jsx:239-246,261,284-289`

**Step 1: Add contextual buttons after folder name banner (after line 246)**

Inside `renderDropdownContent`, after the green folder-name banner `</div>` (line 246), add:

```jsx
{/* Contextual actions for this category */}
<div className="flex flex-wrap gap-3 mt-4">
  <Button
    onClick={(e) => { e.stopPropagation(); openUploadModal(content.folderName); }}
    className="bg-gradient-to-r from-[#1a3aa3] to-[#152e82] hover:from-[#152e82] hover:to-[#0f2260] text-white font-bold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-sm flex items-center gap-2"
  >
    <Upload className="w-4 h-4" />
    Ανέβασμα εδώ
  </Button>
  <Button
    variant="outline"
    onClick={(e) => { e.stopPropagation(); openFolderModal(content.folderName); }}
    className="border-2 border-[#1a3aa3] text-[#1a3aa3] hover:bg-[#1a3aa3] hover:text-white font-bold px-4 py-2 rounded-xl transition-all duration-300 text-sm flex items-center gap-2 bg-white shadow-md hover:shadow-lg"
  >
    <FolderPlus className="w-4 h-4" />
    Νέος υποφάκελος
  </Button>
</div>
```

This goes inside the `{content.folderName && (...)}` conditional, right after the green banner div. The full block becomes:

```jsx
{content.folderName && (
  <div className="bg-[#eef5ee] border-2 border-[#c8dec8] rounded-xl p-4 overflow-hidden">
    <h4 className="text-lg font-bold text-[#2d6b2d] flex items-start gap-2" style={{fontFamily: "'Literata', serif"}}>
      <Folder className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <span className="break-words min-w-0">Περιεχόμενα φακέλου: {content.folderName}</span>
    </h4>
    {/* Contextual actions for this category */}
    <div className="flex flex-wrap gap-3 mt-4">
      <Button
        onClick={(e) => { e.stopPropagation(); openUploadModal(content.folderName); }}
        className="bg-gradient-to-r from-[#1a3aa3] to-[#152e82] hover:from-[#152e82] hover:to-[#0f2260] text-white font-bold px-4 py-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-sm flex items-center gap-2"
      >
        <Upload className="w-4 h-4" />
        Ανέβασμα εδώ
      </Button>
      <Button
        variant="outline"
        onClick={(e) => { e.stopPropagation(); openFolderModal(content.folderName); }}
        className="border-2 border-[#1a3aa3] text-[#1a3aa3] hover:bg-[#1a3aa3] hover:text-white font-bold px-4 py-2 rounded-xl transition-all duration-300 text-sm flex items-center gap-2 bg-white shadow-md hover:shadow-lg"
      >
        <FolderPlus className="w-4 h-4" />
        Νέος υποφάκελος
      </Button>
    </div>
  </div>
)}
```

**Step 2: Add upload button to subfolder rows (line 261, 284-289)**

Add `group/subfolder` class to the subfolder container div (line 261):

```jsx
// OLD:
<div key={idx} className="border-2 border-[#d0d8ee] rounded-xl overflow-hidden">

// NEW:
<div key={idx} className="group/subfolder border-2 border-[#d0d8ee] rounded-xl overflow-hidden">
```

Replace the chevron section (lines 284-289) with chevron + upload button:

```jsx
<div className="flex items-center space-x-1 flex-shrink-0">
  <Button
    variant="ghost"
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      openUploadModal(subfolder.path || `${content.folderName}/${subfolder.name || subfolder.category}`);
    }}
    className="opacity-0 group-hover/subfolder:opacity-100 transition-opacity p-1 h-8 w-8 hover:bg-[#dde4f5] rounded-lg"
    title="Ανέβασμα σε αυτόν τον φάκελο"
  >
    <Upload className="w-4 h-4 text-[#1a3aa3]" />
  </Button>
  {isExpanded ?
    <ChevronUp className="w-6 h-6 text-[#1a3aa3]" /> :
    <ChevronDown className="w-6 h-6 text-[#1a3aa3]" />
  }
</div>
```

**Step 3: Verify compiles and visually inspect**

Run: `cd frontend && npx pnpm dev`
Expected:
- Open a category dropdown → green banner shows "Ανέβασμα εδώ" and "Νέος υποφάκελος" buttons
- Hover a subfolder row → small upload icon appears on the right
- Clicking "Ανέβασμα εδώ" opens upload modal pre-set to that category
- Clicking "Νέος υποφάκελος" opens folder modal pre-set to that category as parent

**Step 4: Commit**

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "feat(files): add inline upload/folder buttons in category dropdowns"
```

---

### Task 7: Final Verification

**Step 1: Run backend tests**

```bash
cd D:/LAPTOP_BACKUP/Development/SW-PORTAL-UNIFIED && python -m pytest tests/ -v
```

Expected: All tests pass (55 passed).

**Step 2: Run frontend dev server and manual test**

```bash
cd frontend && npx pnpm dev
```

Test checklist:
1. Open "Αρχεία" page
2. Click main "Ανέβασμα" button → modal has folder dropdown, default "Γενικά Αρχεία"
3. Select a category from dropdown → green indicator shows selected path
4. Click main "Νέος Φάκελος" button → modal has parent dropdown, default "Αρχειοθήκη (Ρίζα)"
5. Select a parent → green indicator shows parent path
6. Open a category dropdown (e.g., "Νομοθεσία") → "Ανέβασμα εδώ" and "Νέος υποφάκελος" buttons visible
7. Click "Ανέβασμα εδώ" → upload modal opens with that category pre-selected
8. Click "Νέος υποφάκελος" → folder modal opens with that category as parent
9. Hover a subfolder → small upload icon appears
10. Upload a test file to a specific category → verify it appears in the correct folder after refresh

**Step 3: Commit all remaining changes if any**

```bash
git add frontend/src/pages/ApothecaryPage.jsx
git commit -m "feat(files): context-aware file management — upload and folder creation target specific folders"
```
