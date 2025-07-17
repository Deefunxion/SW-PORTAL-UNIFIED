import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Search,
  Upload,
  FolderPlus,
  Grid3X3,
  List,
  File as FileIcon,
  X,
} from 'lucide-react';
import { toast } from "sonner";
import FolderTree from '@/components/FolderTree.jsx';
import ApothecaryPageSkeleton from '@/components/skeletons/ApothecaryPageSkeleton.jsx';
import DropZone from '@/components/DropZone.jsx';
import api from '@/lib/api';

function ApothecaryPage() {
  const [files, setFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [draggedItem, setDraggedItem] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadTargetFolder, setUploadTargetFolder] = useState('');

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/files/structure');
      console.log("DEBUG files response:", response.data);
      setFiles(response.data.categories || []);
    } catch (error) {
      console.error('Error fetching files:', error);
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleDragStart = (e, file, category) => {
    setDraggedItem({ file, category });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e, targetCategory) => {
    e.preventDefault();
    setDropTarget(targetCategory);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDropTarget(null);
  };

  const handleDrop = (e, targetCategory) => {
    e.preventDefault();
    setDropTarget(null);

    if (draggedItem && draggedItem.category !== targetCategory) {
      console.log(`Moving ${draggedItem.file.name} from ${draggedItem.category} to ${targetCategory}`);
      toast.info(`Μετακίνηση αρχείου "${draggedItem.file.name}" στον φάκελο "${targetCategory}" (Not implemented)`);
    }

    setDraggedItem(null);
  };

  const handleFileUpload = async (uploadedFiles) => {
    const formData = new FormData();
    const target = uploadTargetFolder || 'General Documents'; // Default to 'General Documents'

    Array.from(uploadedFiles).forEach(file => {
      formData.append('file', file);
    });
    formData.append('targetFolder', target);

    try {
      setUploadProgress(0);
      await api.post('/api/files/upload', formData);
      setUploadProgress(100);
      toast.success(`Το αρχείο ανέβηκε με επιτυχία στον φάκελο "${target}"!`);
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadProgress(0);
        fetchFiles();
      }, 1000);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Σφάλμα κατά το ανέβασμα του αρχείου');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await api.post('/api/folders/create', {
        name: newFolderName,
        parentFolder: '',
      });
      toast.success("Ο φάκελος δημιουργήθηκε με επιτυχία!");
      setShowFolderModal(false);
      setNewFolderName('');
      fetchFiles();
    } catch (error) {
      console.error('Create folder error:', error);
      toast.error('Σφάλμα κατά τη δημιουργία του φακέλου');
    }
  };

  const filterCategories = (categories, term) => {
    if (!term) return categories;

    return categories.reduce((acc, category) => {
      const filteredFiles = category.files.filter(file =>
        file.name.toLowerCase().includes(term.toLowerCase())
      );

      const filteredSubfolders = filterCategories(category.subfolders || [], term);

      if (filteredFiles.length > 0 || filteredSubfolders.length > 0) {
        acc.push({
          ...category,
          files: filteredFiles,
          subfolders: filteredSubfolders,
        });
      }
      return acc;
    }, []);
  };

  const filteredFiles = filterCategories(files, searchTerm);

  const openUploadModal = (targetFolder = '') => {
    setUploadTargetFolder(targetFolder);
    setShowUploadModal(true);
  };

  if (isLoading) {
    return <ApothecaryPageSkeleton />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📚 Apothecary - Αρχεία Portal
        </h1>
        <p className="text-gray-600">
          Διαχείριση και κατέβασμα αρχείων με προηγμένες λειτουργίες
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Αναζήτηση αρχείων..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => openUploadModal('')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                Ανέβασμα Αρχείων
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowFolderModal(true)}
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Νέος Φάκελος
              </Button>
              <Button
                variant="outline"
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              >
                {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <FolderTree
          categories={filteredFiles}
          viewMode={viewMode}
          handleDragStart={handleDragStart}
          handleDrop={handleDrop}
          dropTarget={dropTarget}
          handleDragEnter={handleDragEnter}
          handleDragLeave={handleDragLeave}
        />
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Ανέβασμα Αρχείων</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploadModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <DropZone onDrop={handleFileUpload} />
                {uploadProgress > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Πρόοδος ανεβάσματος</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Δημιουργία Νέου Φακέλου</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFolderModal(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Όνομα φακέλου
                  </label>
                  <Input
                    placeholder="Όνομα φακέλου..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreateFolder}
                    className="flex-1"
                    disabled={!newFolderName.trim()}
                  >
                    Δημιουργία
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowFolderModal(false)}
                    className="flex-1"
                  >
                    Ακύρωση
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {filteredFiles.length === 0 && !isLoading && (
        <Card className="text-center py-12">
          <CardContent>
            <FileIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">
              Δεν βρέθηκαν αρχεία
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm ? 'Δοκιμάστε διαφορετικούς όρους αναζήτησης' : 'Ανεβάστε αρχεία για να ξεκινήσετε'}
            </p>
            {!searchTerm && (
              <Button onClick={() => openUploadModal('')}>
                <Upload className="w-4 h-4 mr-2" />
                Ανέβασμα Πρώτου Αρχείου
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default ApothecaryPage;
