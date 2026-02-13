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
