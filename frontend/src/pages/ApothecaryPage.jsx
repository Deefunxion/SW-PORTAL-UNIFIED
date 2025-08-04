import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Search, Upload, FolderPlus, Grid3X3, List, File as FileIcon, X, ChevronDown, ChevronUp, Folder
} from 'lucide-react';
import { toast } from 'sonner';
import ApothecaryPageSkeleton from '@/components/skeletons/ApothecaryPageSkeleton.jsx';
import DropZone from '@/components/DropZone.jsx';
import api from '@/lib/api';

function ApothecaryPage() {
  /* --- existing state & logic --- */
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
  
  // NEW STATE: Track which category dropdown is open and its content
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dropdownContent, setDropdownContent] = useState({});
  const [expandedSubfolder, setExpandedSubfolder] = useState(null); // For 3rd level navigation

  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data } = await api.get('/api/files/structure');
      setFiles(data.categories || []);
    } catch {
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // NEW FUNCTION: Handle category click and load its content
  const handleCategoryClick = async (categoryTitle, index) => {
    if (activeDropdown === index) {
      // Close if already open
      setActiveDropdown(null);
      setExpandedSubfolder(null); // Close any expanded subfolders
      return;
    }

    try {
      // Set active dropdown immediately for UI feedback
      setActiveDropdown(index);
      setExpandedSubfolder(null); // Reset expanded subfolders when opening new category
      
      console.log('Looking for category:', categoryTitle);
      console.log('Available files:', files);
      
      // Create mapping for category titles to folder names
      const categoryMappings = {
        'Αποφάσεις Αδειοδότησης': ['ΑΠΟΦΑΣΕΙΣ_ΑΔΕΙΟΔΟΤΗΣΗΣ', 'αδειοδότησης', 'αποφάσεις'],
        'Νομοθεσία Κοινωνικής Μέριμνας': ['ΝΟΜΟΘΕΣΙΑ_ΚΟΙΝΩΝΙΚΗΣ_ΜΕΡΙΜΝΑΣ', 'νομοθεσία', 'κοινωνικής'],
        'Εκθέσεις Ελέγχων': ['ΕΚΘΕΣΕΙΣ_ΕΛΕΓΧΩΝ', 'ελέγχων', 'εκθέσεις'],
        'Έντυπα Αιτήσεων': ['ΕΝΤΥΠΑ_ΑΙΤΗΣΕΩΝ', 'αιτήσεων', 'έντυπα'],
        'Συγκρότηση Επιτροπών': ['ΑΠΟΦΑΣΕΙΣ_ΣΥΓΚΡΟΤΗΣΗΣ_ΕΠΙΤΡΟΠΩΝ_ΚΑΙ_ΚΟΙΝΩΝΙΚΟΥ_ΣΥΜΒΟΥΛΟΥ', 'επιτροπών', 'συγκρότηση'],
        'Εκπαιδευτικό Υλικό': ['ΕΚΠΑΙΔΕΥΤΙΚΟ_ΥΛΙΚΟ', 'εκπαιδευτικό', 'υλικό']
      };

      // Try to find matching folder
      const searchTerms = categoryMappings[categoryTitle] || [categoryTitle.toLowerCase()];
      
      const matchingFolder = files.find(folder => {
        const folderName = (folder.category || folder.name || '').toLowerCase();
        return searchTerms.some(term => 
          folderName.includes(term.toLowerCase()) || 
          term.toLowerCase().includes(folderName)
        );
      });

      console.log('Found matching folder:', matchingFolder);

      if (matchingFolder) {
        setDropdownContent({
          [index]: {
            files: matchingFolder.files || [],
            subfolders: matchingFolder.subfolders || [],
            folderName: matchingFolder.category || matchingFolder.name
          }
        });
      } else {
        // Show available folders to help user understand structure
        setDropdownContent({
          [index]: {
            files: [],
            subfolders: files.slice(0, 8), // Show available folders
            isEmpty: true,
            availableFolders: files.map(f => f.category || f.name).join(', ')
          }
        });
      }
    } catch (error) {
      console.error('Error in handleCategoryClick:', error);
      toast.error('Σφάλμα φόρτωσης περιεχομένου');
      setActiveDropdown(null);
    }
  };

  // Existing functions unchanged...
  const handleFileUpload = async (uploadedFiles) => {
    const formData = new FormData();
    const target = uploadTargetFolder || 'General Documents';
    Array.from(uploadedFiles).forEach(file => formData.append('file', file));
    formData.append('targetFolder', target);

    try {
      setUploadProgress(0);
      await api.post('/api/files/upload', formData);
      setUploadProgress(100);
      toast.success(`Το αρχείο ανέβηκε στον φάκελο "${target}"!`);
      setTimeout(() => {
        setShowUploadModal(false); setUploadProgress(0); fetchFiles();
      }, 1000);
    } catch {
      toast.error('Σφάλμα ανεβάσματος');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/api/folders/create', { name: newFolderName, parentFolder: '' });
      toast.success('Ο φάκελος δημιουργήθηκε!');
      setShowFolderModal(false); setNewFolderName(''); fetchFiles();
    } catch {
      toast.error('Σφάλμα δημιουργίας φακέλου');
    }
  };

  const openUploadModal = (targetFolder = '') => {
    setUploadTargetFolder(targetFolder);
    setShowUploadModal(true);
  };

  // NEW FUNCTION: Handle subfolder click (3rd level navigation)
  const handleSubfolderClick = async (subfolder, categoryIndex) => {
    const subfolderKey = `${categoryIndex}_${subfolder.category || subfolder.name}`;
    
    if (expandedSubfolder === subfolderKey) {
      // Close if already open
      setExpandedSubfolder(null);
      return;
    }

    setExpandedSubfolder(subfolderKey);
    
    // Update dropdown content to include expanded subfolder files
    const currentContent = dropdownContent[categoryIndex];
    if (currentContent) {
      setDropdownContent({
        ...dropdownContent,
        [categoryIndex]: {
          ...currentContent,
          expandedSubfolder: subfolderKey,
          expandedFiles: subfolder.files || []
        }
      });
    }
  };

  // NEW FUNCTION: Handle file download
  const handleFileDownload = async (file, folderPath = '') => {
    try {
      // Use the file's existing path if available, otherwise construct it
      let filePath = file.path || file.name;
      
      // If we have a folderPath, use it to construct the full path
      if (folderPath && !file.path) {
        filePath = `${folderPath}/${file.name}`;
      }
      
      console.log('Downloading file:', file);
      console.log('Constructed file path:', filePath);
      
      const downloadUrl = `/api/files/download/${encodeURIComponent(filePath)}`;
      
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = `http://127.0.0.1:5000${downloadUrl}`;
      link.download = file.name;
      link.target = '_blank';
      
      // Add to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Έναρξη λήψης: ${file.name}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Σφάλμα κατά τη λήψη του αρχείου');
    }
  };

  // NEW FUNCTION: Render dropdown content
  const renderDropdownContent = (content, categoryIndex) => {
    if (!content) return null;

    if (content.isEmpty) {
      return (
        <div className="text-center py-12">
          <Folder className="w-16 h-16 mx-auto mb-6 text-gray-400" />
          <h4 className="text-2xl font-semibold text-gray-700 mb-4">
            Δεν βρέθηκε αντίστοιχος φάκελος
          </h4>
          <p className="text-lg text-gray-600 mb-6">
            Διαθέσιμοι φάκελοι στο σύστημα:
          </p>
          {content.availableFolders && (
            <div className="bg-blue-50 p-4 rounded-xl border-2 border-blue-200">
              <p className="text-lg text-blue-900 font-medium">
                {content.availableFolders}
              </p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Show matched folder name */}
        {content.folderName && (
          <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
            <h4 className="text-xl font-bold text-green-800 flex items-center">
              <Folder className="w-6 h-6 mr-3" />
              Περιεχόμενα φακέλου: {content.folderName}
            </h4>
          </div>
        )}

        {/* Subfolders */}
        {content.subfolders && content.subfolders.length > 0 && (
          <div>
            <h4 className="text-2xl font-bold text-blue-900 mb-6 flex items-center">
              <Folder className="w-8 h-8 mr-4" />
              Υποφάκελοι ({content.subfolders.length})
            </h4>
            <div className="space-y-4">
              {content.subfolders.map((subfolder, idx) => {
                const subfolderKey = `${categoryIndex}_${subfolder.category || subfolder.name}`;
                const isExpanded = expandedSubfolder === subfolderKey;
                
                return (
                  <div key={idx} className="border-2 border-blue-200 rounded-xl overflow-hidden">
                    {/* Subfolder Header */}
                    <div
                      className="flex items-center justify-between p-6 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-150 cursor-pointer transition-all duration-300 hover:shadow-md"
                      onClick={() => handleSubfolderClick(subfolder, categoryIndex)}
                    >
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                          <Folder className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h5 className="text-xl font-bold text-blue-900 mb-1">
                            {subfolder.category || subfolder.name || `Φάκελος ${idx + 1}`}
                          </h5>
                          {(subfolder.files || []).length > 0 && (
                            <div className="flex items-center">
                              <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-bold shadow-sm">
                                {(subfolder.files || []).length} αρχεία
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-bold text-blue-700">
                          {isExpanded ? 'Κλείσιμο' : 'Άνοιγμα'}
                        </span>
                        {isExpanded ? 
                          <ChevronUp className="w-7 h-7 text-blue-600" /> : 
                          <ChevronDown className="w-7 h-7 text-blue-600" />
                        }
                      </div>
                    </div>
                    
                    {/* Subfolder Files (3rd level) */}
                    {isExpanded && (subfolder.files || []).length > 0 && (
                      <div className="p-6 bg-white border-t-2 border-blue-200">
                        <div className="space-y-3">
                          {(subfolder.files || []).map((file, fileIdx) => (
                            <div
                              key={fileIdx}
                              className="flex items-center justify-between p-5 bg-green-50 rounded-2xl hover:bg-green-100 transition-all duration-300 border-2 border-green-200 hover:border-green-300 hover:shadow-lg"
                            >
                              <div className="flex items-center min-w-0 flex-1 mr-4">
                                <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                                  <FileIcon className="w-6 h-6 text-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h6 className="text-lg font-bold text-green-900 truncate mb-1">
                                    {file.name}
                                  </h6>
                                  {file.size && (
                                    <p className="text-sm font-medium text-gray-600">
                                      {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button
                                onClick={() => handleFileDownload(file, subfolder.path)}
                                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 min-w-[120px]"
                              >
                                <span className="text-lg">📥</span>
                                <span>Λήψη</span>
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Empty subfolder message */}
                    {isExpanded && (!subfolder.files || subfolder.files.length === 0) && (
                      <div className="p-6 bg-gray-50 border-t-2 border-blue-200 text-center">
                        <p className="text-lg text-gray-600">Ο φάκελος είναι άδειος</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Files */}
        {content.files && content.files.length > 0 && (
          <div>
            <div className="flex items-center justify-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-r from-green-600 to-green-700 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <FileIcon className="w-7 h-7 text-white" />
              </div>
              <h4 className="text-2xl font-bold text-green-900">
                Αρχεία ({content.files.length})
              </h4>
            </div>
            <div className="space-y-4">
              {content.files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-6 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl hover:from-green-100 hover:to-green-150 transition-all duration-300 border-2 border-green-200 hover:border-green-300 shadow-lg hover:shadow-xl"
                >
                  <div className="flex items-center min-w-0 flex-1 mr-4">
                    <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-lg">
                      <FileIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h6 className="text-lg font-bold text-green-900 truncate mb-1">
                        {file.name}
                      </h6>
                      {file.size && (
                        <p className="text-sm font-medium text-gray-600">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleFileDownload(file, content.folderName)}
                    className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 min-w-[120px]"
                  >
                    <span className="text-lg">📥</span>
                    <span>Λήψη</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no files and no subfolders */}
        {(!content.files || content.files.length === 0) && 
         (!content.subfolders || content.subfolders.length === 0) && 
         !content.isEmpty && (
          <div className="text-center py-12">
            <FileIcon className="w-16 h-16 mx-auto mb-6 text-gray-400" />
            <h4 className="text-2xl font-semibold text-gray-700 mb-4">
              Ο φάκελος είναι άδειος
            </h4>
            <p className="text-lg text-gray-600">
              Δεν υπάρχουν αρχεία ή υποφάκελοι σε αυτή την κατηγορία
            </p>
          </div>
        )}
      </div>
    );
  };

  /* --- rendering starts here --- */
  if (isLoading) return <ApothecaryPageSkeleton />;

  return (
    <div className="container mx-auto px-12 py-16 max-w-7xl">
      {/* Header */}
      <header className="mb-20">
        <h1 className="text-7xl font-bold text-[#1e3a8a] mb-6 leading-tight">
          📚 Αρχειοθήκη
        </h1>
        <p className="text-2xl text-[#6b7280] max-w-4xl leading-relaxed">
          Διαχείριση και πρόσβαση στα επίσημα έγγραφα και φάκελα της Περιφέρειας Αττικής
        </p>
      </header>

      {/* Main Categories Navigation - ENHANCED */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 mb-20">
        {[
          { title: 'Αποφάσεις Αδειοδότησης', icon: '⚖️', desc: 'ΚΑΑ, ΚΔΑΠ, ΚΗΦΗ, ΜΦΗ, ΣΥΔ', color: 'from-blue-600 to-blue-700', hoverColor: 'hover:from-blue-700 hover:to-blue-800' },
          { title: 'Νομοθεσία Κοινωνικής Μέριμνας', icon: '📋', desc: 'Νόμοι και Κανονισμοί', color: 'from-green-600 to-green-700', hoverColor: 'hover:from-green-700 hover:to-green-800' },
          { title: 'Εκθέσεις Ελέγχων', icon: '🔍', desc: 'Αξιολογήσεις και Επιθεωρήσεις', color: 'from-purple-600 to-purple-700', hoverColor: 'hover:from-purple-700 hover:to-purple-800' },
          { title: 'Έντυπα Αιτήσεων', icon: '📄', desc: 'Φόρμες και Αιτήσεις', color: 'from-orange-600 to-orange-700', hoverColor: 'hover:from-orange-700 hover:to-orange-800' },
          { title: 'Συγκρότηση Επιτροπών', icon: '👥', desc: 'Οργανωτικές Αποφάσεις', color: 'from-teal-600 to-teal-700', hoverColor: 'hover:from-teal-700 hover:to-teal-800' },
          { title: 'Εκπαιδευτικό Υλικό', icon: '📚', desc: 'Οδηγίες και Μάθημα', color: 'from-indigo-600 to-indigo-700', hoverColor: 'hover:from-indigo-700 hover:to-indigo-800' }
        ].map((category, index) => (
          <div key={index} className="space-y-6">
            {/* Category Card */}
            <Card 
              className="group hover:shadow-2xl transition-all duration-300 cursor-pointer border-0 shadow-xl hover:scale-105 rounded-3xl overflow-hidden bg-gradient-to-br from-white to-gray-50"
              onClick={() => handleCategoryClick(category.title, index)}
            >
              <CardContent className="p-8">
                <div className={`w-20 h-20 bg-gradient-to-br ${category.color} ${category.hoverColor} rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl group-hover:scale-110 transition-all duration-300`}>
                  <span className="text-3xl filter drop-shadow-lg">{category.icon}</span>
                </div>
                <h3 className="text-2xl font-bold text-[#1e3a8a] mb-4 text-center group-hover:text-blue-700 transition-colors leading-tight">
                  {category.title}
                </h3>
                <p className="text-lg font-medium text-gray-600 text-center leading-relaxed mb-6">
                  {category.desc}
                </p>
                {/* Dropdown indicator */}
                <div className="flex justify-center">
                  {activeDropdown === index ? 
                    <div className="flex items-center text-blue-600 font-bold bg-blue-100 px-4 py-2 rounded-full">
                      <ChevronUp className="w-6 h-6 mr-2" />
                      <span className="text-base">Κλείσιμο</span>
                    </div> :
                    <div className="flex items-center text-gray-500 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all px-4 py-2 rounded-full font-bold">
                      <ChevronDown className="w-6 h-6 mr-2" />
                      <span className="text-base">Άνοιγμα</span>
                    </div>
                  }
                </div>
              </CardContent>
            </Card>

            {/* Dropdown Content */}
            {activeDropdown === index && (
              <Card className="border-3 border-blue-300 shadow-2xl rounded-3xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
                <CardContent className="p-10">{renderDropdownContent(dropdownContent[index], index)}
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>

      {/* Search & Controls - ENHANCED */}
      <Card className="p-8 mb-12 shadow-2xl rounded-3xl border-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          <div className="relative flex-1 max-w-2xl">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
            <Input
              placeholder="Αναζήτηση στα αρχεία και φάκελα..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-16 pr-6 py-6 text-lg font-medium border-3 border-gray-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all shadow-lg bg-white"
            />
          </div>
          <div className="flex gap-4">
            <Button
              onClick={() => openUploadModal('')}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-8 py-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 text-base min-h-[64px] flex items-center space-x-3"
            >
              <Upload className="w-6 h-6" />
              <span>Ανέβασμα Αρχείου</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFolderModal(true)}
              className="border-3 border-cyan-600 text-cyan-700 hover:bg-cyan-600 hover:text-white font-bold px-8 py-6 rounded-2xl transition-all duration-300 transform hover:scale-105 text-base min-h-[64px] flex items-center space-x-3 bg-white shadow-lg hover:shadow-xl"
            >
              <FolderPlus className="w-6 h-6" />
              <span>Νέος Φάκελος</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* REMOVED: FolderTree component - no longer needed */}

      {/* Empty State - ENHANCED */}
      {!files.length && (
        <Card className="py-24 text-center shadow-2xl rounded-3xl border-0 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
          <FileIcon className="w-28 h-28 mx-auto text-gray-300 mb-8" />
          <h3 className="text-4xl font-bold text-gray-800 mb-6">Δεν βρέθηκαν αρχεία</h3>
          <p className="text-xl font-medium text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Ανεβάστε τα πρώτα έγγραφα για να ξεκινήσετε τη διαχείριση της αρχειοθήκης σας
          </p>
          <Button
            onClick={() => openUploadModal('')}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold px-12 py-6 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 text-xl min-h-[72px] flex items-center space-x-4 mx-auto"
          >
            <Upload className="w-7 h-7" />
            <span>Ανέβασμα Πρώτου Αρχείου</span>
          </Button>
        </Card>
      )}

      {/* Modals - Unchanged */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-6">
          <Card className="w-full max-w-2xl rounded-3xl shadow-2xl">
            <CardHeader className="p-8">
              <CardTitle className="text-3xl font-bold text-[#1e3a8a]">Ανέβασμα Αρχείων</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <DropZone onDrop={handleFileUpload} />
              {uploadProgress > 0 && (
                <div className="mt-8">
                  <div className="flex justify-between text-lg font-medium mb-3">
                    <span>Πρόοδος Ανεβάσματος</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 mt-2">
                    <div className="bg-[#2563eb] h-4 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
              <Button
                variant="ghost"
                onClick={() => setShowUploadModal(false)}
                className="mt-8 w-full py-4 text-lg font-bold hover:bg-gray-100 rounded-2xl transition-all"
              >
                <X className="w-6 h-6 mr-3" /> Κλείσιμο
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {showFolderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-6">
          <Card className="w-full max-w-2xl rounded-3xl shadow-2xl">
            <CardHeader className="p-8">
              <CardTitle className="text-3xl font-bold text-[#1e3a8a]">Δημιουργία Νέου Φακέλου</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
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
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl py-4 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  Δημιουργία Φακέλου
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowFolderModal(false)}
                  className="flex-1 rounded-2xl py-4 text-lg font-bold border-2 hover:bg-gray-50 transition-all"
                >
                  Ακύρωση
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default ApothecaryPage;