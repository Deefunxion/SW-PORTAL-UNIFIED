import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import {
  Search, Upload, FolderPlus, Grid3X3, List, File as FileIcon, X, ChevronDown, ChevronUp, Folder
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookOpen, faScaleBalanced, faClipboard, faSearch, faFile, faUsers } from '@fortawesome/free-solid-svg-icons';
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
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      link.href = `${baseUrl}${downloadUrl}`;
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
          <Folder className="w-16 h-16 mx-auto mb-6 text-[#8a8580]" />
          <h4 className="text-2xl font-semibold text-[#2a2520] mb-4">
            Δεν βρέθηκε αντίστοιχος φάκελος
          </h4>
          <p className="text-lg text-[#6b6560] mb-6">
            Διαθέσιμοι φάκελοι στο σύστημα:
          </p>
          {content.availableFolders && (
            <div className="bg-[#eef1f8] p-4 rounded-xl border-2 border-[#d0d8ee]">
              <p className="text-lg text-[#1a3aa3] font-medium">
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
          <div className="bg-[#eef5ee] border-2 border-[#c8dec8] rounded-xl p-4">
            <h4 className="text-xl font-bold text-[#2d6b2d] flex items-center" style={{fontFamily: "'Literata', serif"}}>
              <Folder className="w-6 h-6 mr-3" />
              Περιεχόμενα φακέλου: {content.folderName}
            </h4>
          </div>
        )}

        {/* Subfolders */}
        {content.subfolders && content.subfolders.length > 0 && (
          <div>
            <h4 className="text-2xl font-bold text-[#1a3aa3] mb-6 flex items-center" style={{fontFamily: "'Literata', serif"}}>
              <Folder className="w-8 h-8 mr-4" />
              Υποφάκελοι ({content.subfolders.length})
            </h4>
            <div className="space-y-4">
              {content.subfolders.map((subfolder, idx) => {
                const subfolderKey = `${categoryIndex}_${subfolder.category || subfolder.name}`;
                const isExpanded = expandedSubfolder === subfolderKey;
                
                return (
                  <div key={idx} className="border-2 border-[#d0d8ee] rounded-xl overflow-hidden">
                    {/* Subfolder Header */}
                    <div
                      className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-[#eef1f8] to-[#dde4f5] hover:from-[#dde4f5] hover:to-[#d0d8ee] cursor-pointer transition-all duration-300 hover:shadow-md"
                      onClick={() => handleSubfolderClick(subfolder, categoryIndex)}
                    >
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                          <Folder className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h5 className="text-xl font-bold text-[#1a3aa3] mb-1">
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
                        <span className="text-sm font-bold text-[#152e82]">
                          {isExpanded ? 'Κλείσιμο' : 'Άνοιγμα'}
                        </span>
                        {isExpanded ? 
                          <ChevronUp className="w-7 h-7 text-[#1a3aa3]" /> : 
                          <ChevronDown className="w-7 h-7 text-[#1a3aa3]" />
                        }
                      </div>
                    </div>
                    
                    {/* Subfolder Files (3rd level) */}
                    {isExpanded && (subfolder.files || []).length > 0 && (
                      <div className="p-6 bg-white border-t-2 border-[#d0d8ee]">
                        <div className="space-y-3">
                          {(subfolder.files || []).map((file, fileIdx) => (
                            <div
                              key={fileIdx}
                              className="flex items-center justify-between p-5 bg-[#eef5ee] rounded-2xl hover:bg-[#dde8dd] transition-all duration-300 border-2 border-[#c8dec8] hover:border-[#a8cca8] hover:shadow-lg hover:pl-8"
                            >
                              <div className="flex items-center min-w-0 flex-1 mr-4">
                                <div className="w-12 h-12 bg-[#1a3aa3] rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                                  <FileIcon className="w-6 h-6 text-white" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h6 className="text-lg font-bold text-[#2a2520] truncate mb-1">
                                    {file.name}
                                  </h6>
                                  {file.size && (
                                    <p className="text-sm font-medium text-[#6b6560]">
                                      {(file.size / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button
                                onClick={() => handleFileDownload(file, subfolder.path)}
                                className="bg-gradient-to-r from-[#2d6b2d] to-[#245a24] hover:from-[#245a24] hover:to-[#1a481a] text-white font-bold px-3 sm:px-5 py-2 sm:py-3 rounded-xl text-sm sm:text-base shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-1.5 shrink-0"
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
                      <div className="p-6 bg-[#faf8f4] border-t-2 border-[#d0d8ee] text-center">
                        <p className="text-lg text-[#6b6560]">Ο φάκελος είναι άδειος</p>
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
              <div className="w-14 h-14 bg-gradient-to-r from-[#2d6b2d] to-[#245a24] rounded-xl flex items-center justify-center mr-4 shadow-lg">
                <FileIcon className="w-7 h-7 text-white" />
              </div>
              <h4 className="text-2xl font-bold text-[#2a2520]" style={{fontFamily: "'Literata', serif"}}>
                Αρχεία ({content.files.length})
              </h4>
            </div>
            <div className="space-y-4">
              {content.files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-6 bg-gradient-to-r from-[#eef5ee] to-[#dde8dd] rounded-2xl hover:from-[#dde8dd] hover:to-[#c8dec8] transition-all duration-300 border-2 border-[#c8dec8] hover:border-[#a8cca8] shadow-lg hover:shadow-xl hover:pl-8"
                >
                  <div className="flex items-center min-w-0 flex-1 mr-4">
                    <div className="w-12 h-12 bg-[#1a3aa3] rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-lg">
                      <FileIcon className="w-6 h-6 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h6 className="text-lg font-bold text-[#2a2520] truncate mb-1">
                        {file.name}
                      </h6>
                      {file.size && (
                        <p className="text-sm font-medium text-[#6b6560]">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleFileDownload(file, content.folderName)}
                    className="bg-gradient-to-r from-[#2d6b2d] to-[#245a24] hover:from-[#245a24] hover:to-[#1a481a] text-white font-bold px-8 py-4 rounded-xl text-base shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center space-x-2 min-w-[120px]"
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
            <FileIcon className="w-16 h-16 mx-auto mb-6 text-[#8a8580]" />
            <h4 className="text-2xl font-semibold text-[#2a2520] mb-4">
              Ο φάκελος είναι άδειος
            </h4>
            <p className="text-lg text-[#6b6560]">
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
    <div className="mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-12 max-w-7xl">
      {/* Header */}
      <header className="mb-8 sm:mb-12">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1a3aa3] mb-4 leading-tight" style={{fontFamily: "'Literata', serif"}}>
          <FontAwesomeIcon icon={faBookOpen} className="mr-3" /> Αρχειοθήκη
        </h1>
        <p className="text-base sm:text-lg lg:text-xl text-[#8a8580] max-w-4xl leading-relaxed">
          Διαχείριση και πρόσβαση στα επίσημα έγγραφα και φάκελα της Περιφέρειας Αττικής
        </p>
      </header>

      {/* Main Categories Navigation - ENHANCED */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 mb-8 sm:mb-12">
        {[
          { title: 'Αποφάσεις Αδειοδότησης', icon: faScaleBalanced, desc: 'ΚΑΑ, ΚΔΑΠ, ΚΗΦΗ, ΜΦΗ, ΣΥΔ', color: 'from-[#1a3aa3] to-[#152e82]', hoverColor: 'hover:from-[#152e82] hover:to-[#0f2260]' },
          { title: 'Νομοθεσία Κοινωνικής Μέριμνας', icon: faClipboard, desc: 'Νόμοι και Κανονισμοί', color: 'from-[#2d6b2d] to-[#245a24]', hoverColor: 'hover:from-[#245a24] hover:to-[#1a481a]' },
          { title: 'Εκθέσεις Ελέγχων', icon: faSearch, desc: 'Αξιολογήσεις και Επιθεωρήσεις', color: 'from-[#3d5cc9] to-[#1a3aa3]', hoverColor: 'hover:from-[#152e82] hover:to-[#0f2260]' },
          { title: 'Έντυπα Αιτήσεων', icon: faFile, desc: 'Φόρμες και Αιτήσεις', color: 'from-[#b8942e] to-[#9a7a24]', hoverColor: 'hover:from-[#152e82] hover:to-[#0f2260]' },
          { title: 'Συγκρότηση Επιτροπών', icon: faUsers, desc: 'Οργανωτικές Αποφάσεις', color: 'from-[#1a3aa3] to-[#152e82]', hoverColor: 'hover:from-[#152e82] hover:to-[#0f2260]' },
          { title: 'Εκπαιδευτικό Υλικό', icon: faBookOpen, desc: 'Οδηγίες και Μάθημα', color: 'from-[#3d5cc9] to-[#1a3aa3]', hoverColor: 'hover:from-[#152e82] hover:to-[#0f2260]' }
        ].map((category, index) => (
          <div key={index} className="space-y-6">
            {/* Category Card */}
            <Card 
              className="group hover:shadow-2xl transition-all duration-300 cursor-pointer border-0 shadow-xl hover:scale-[1.02] hover:-translate-y-2 hover:shadow-[0_16px_40px_rgba(26,58,163,0.14)] rounded-3xl overflow-hidden bg-gradient-to-br from-white to-[#faf8f4]"
              onClick={() => handleCategoryClick(category.title, index)}
            >
              <CardContent className="p-5 sm:p-6">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br ${category.color} ${category.hoverColor} rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:scale-110 transition-all duration-300`}>
                  <span className="text-xl sm:text-2xl filter drop-shadow-lg text-white">
                    <FontAwesomeIcon icon={category.icon} />
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#1a3aa3] mb-2 text-center group-hover:text-[#1a3aa3] transition-colors leading-tight" style={{fontFamily: "'Literata', serif"}}>
                  {category.title}
                </h3>
                <p className="text-sm sm:text-base font-medium text-[#6b6560] text-center leading-relaxed mb-4">
                  {category.desc}
                </p>
                {/* Dropdown indicator */}
                <div className="flex justify-center">
                  {activeDropdown === index ? 
                    <div className="flex items-center text-[#1a3aa3] font-bold bg-[#dde4f5] px-4 py-2 rounded-full">
                      <ChevronUp className="w-6 h-6 mr-2" />
                      <span className="text-base">Κλείσιμο</span>
                    </div> :
                    <div className="flex items-center text-[#8a8580] group-hover:text-[#1a3aa3] group-hover:bg-[#eef1f8] transition-all px-4 py-2 rounded-full font-bold">
                      <ChevronDown className="w-6 h-6 mr-2" />
                      <span className="text-base">Άνοιγμα</span>
                    </div>
                  }
                </div>
              </CardContent>
            </Card>

            {/* Dropdown Content */}
            {activeDropdown === index && (
              <Card className="border-2 border-[#b0c0e0] shadow-xl rounded-2xl overflow-hidden animate-in slide-in-from-top-4 duration-500">
                <CardContent className="p-4 sm:p-6">{renderDropdownContent(dropdownContent[index], index)}
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>

      {/* Search & Controls - ENHANCED */}
      <Card className="p-4 sm:p-6 mb-8 sm:mb-10 shadow-xl rounded-2xl border-0 bg-gradient-to-br from-[#eef1f8] via-[#f0ede6] to-[#eef1f8]">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5 items-stretch lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8a8580]" />
            <Input
              placeholder="Αναζήτηση στα αρχεία και φάκελα..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-3 sm:py-4 text-base font-medium border-2 border-gray-200 rounded-xl focus:border-[#1a3aa3] focus:ring-4 focus:ring-[#1a3aa3]/20 transition-all shadow-md bg-white"
            />
          </div>
          <div className="flex gap-3 sm:gap-4">
            <Button
              onClick={() => openUploadModal('')}
              className="flex-1 lg:flex-none bg-gradient-to-r from-[#1a3aa3] to-[#152e82] hover:from-[#152e82] hover:to-[#0f2260] text-white font-bold px-4 sm:px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-sm sm:text-base min-h-[48px] flex items-center justify-center gap-2"
            >
              <Upload className="w-5 h-5" />
              <span>Ανέβασμα</span>
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowFolderModal(true)}
              className="flex-1 lg:flex-none border-2 border-[#1a3aa3] text-[#1a3aa3] hover:bg-[#1a3aa3] hover:text-white font-bold px-4 sm:px-6 py-3 rounded-xl transition-all duration-300 text-sm sm:text-base min-h-[48px] flex items-center justify-center gap-2 bg-white shadow-md hover:shadow-lg"
            >
              <FolderPlus className="w-5 h-5" />
              <span>Νέος Φάκελος</span>
            </Button>
          </div>
        </div>
      </Card>

      {/* REMOVED: FolderTree component - no longer needed */}

      {/* Empty State - ENHANCED */}
      {!files.length && (
        <Card className="py-12 sm:py-16 text-center shadow-xl rounded-2xl border-0 bg-gradient-to-br from-[#faf8f4] via-[#eef1f8] to-[#f0ede6]">
          <FileIcon className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-[#c0b89e] mb-6" />
          <h3 className="text-2xl sm:text-3xl font-bold text-[#2a2520] mb-4">Δεν βρέθηκαν αρχεία</h3>
          <p className="text-base sm:text-lg font-medium text-[#6b6560] mb-8 max-w-xl mx-auto px-4 leading-relaxed">
            Ανεβάστε τα πρώτα έγγραφα για να ξεκινήσετε τη διαχείριση της αρχειοθήκης σας
          </p>
          <Button
            onClick={() => openUploadModal('')}
            className="bg-gradient-to-r from-[#1a3aa3] to-[#152e82] hover:from-[#152e82] hover:to-[#0f2260] text-white font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 text-base sm:text-lg min-h-[48px] sm:min-h-[56px] flex items-center gap-3 mx-auto"
          >
            <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
            <span>Ανέβασμα Πρώτου Αρχείου</span>
          </Button>
        </Card>
      )}

      {/* Modals - Unchanged */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg sm:max-w-xl rounded-2xl shadow-2xl">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-xl sm:text-2xl font-bold text-[#1a3aa3]">Ανέβασμα Αρχείων</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
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
                onClick={() => setShowUploadModal(false)}
                className="mt-8 w-full py-4 text-lg font-bold hover:bg-[#f0ede6] rounded-2xl transition-all"
              >
                <X className="w-6 h-6 mr-3" /> Κλείσιμο
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {showFolderModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg sm:max-w-xl rounded-2xl shadow-2xl">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-xl sm:text-2xl font-bold text-[#1a3aa3]">Δημιουργία Νέου Φακέλου</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
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
                  onClick={() => setShowFolderModal(false)}
                  className="flex-1 rounded-2xl py-4 text-lg font-bold border-2 hover:bg-[#faf8f4] transition-all"
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