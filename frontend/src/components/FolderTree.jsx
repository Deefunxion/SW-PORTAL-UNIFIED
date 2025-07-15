import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { 
  Download, 
  ChevronDown,
  ChevronRight,
  Folder,
} from 'lucide-react';
import api from '@/lib/api'; // Import the new api client

const getFileIcon = (fileType) => {
  const iconMap = {
    'pdf': '📄',
    'document': '📝',
    'text': '📃',
    'spreadsheet': '📊',
    'presentation': '📋',
    'image': '🖼️',
    'video': '🎥',
    'audio': '🎵',
    'archive': '🗜️',
    'file': '📄'
  };
  return iconMap[fileType] || '📄';
};

const FileItem = ({ file, viewMode, handleDragStart, category }) => {
  if (viewMode === 'grid') {
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, file, category)}
        className="border rounded-lg p-4 hover:shadow-md transition-shadow duration-200 cursor-move bg-white"
      >
        <div className="text-center">
          <div className="text-3xl mb-2">
            {getFileIcon(file.type)}
          </div>
          <h3 className="font-medium text-sm mb-2 line-clamp-2">
            {file.name}
          </h3>
          <div className="text-xs text-gray-500 mb-3">
            {file.extension?.toUpperCase()}
          </div>
          <Button
            size="sm"
            className="w-full"
            onClick={() => window.open(file.downloadUrl, '_blank')}
          >
            <Download className="w-3 h-3 mr-1" />
            Κατέβασμα
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, file, category)}
      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-move"
    >
      <div className="flex items-center space-x-3">
        <span className="text-xl">{getFileIcon(file.type)}</span>
        <div>
          <div className="font-medium">{file.name}</div>
          <div className="text-sm text-gray-500">
            {file.extension?.toUpperCase()} • {file.lastModified ? new Date(file.lastModified).toLocaleDateString('el-GR') : 'Άγνωστη ημερομηνία'}
          </div>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => window.open(file.downloadUrl, '_blank')}
      >
        <Download className="w-4 h-4 mr-1" />
        Κατέβασμα
      </Button>
    </div>
  );
};

const FolderTree = ({ viewMode, handleDragStart, handleDrop, dropTarget, handleDragEnter, handleDragLeave, level = 0 }) => {
  const [categories, setCategories] = useState([]);
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());

  useEffect(() => {
    api.get('/api/files/structure')
       .then(res => setCategories(res.data.categories))
       .catch(console.error);
  }, []);

  const toggleFolder = (folderId) => {
    const newCollapsed = new Set(collapsedFolders);
    if (newCollapsed.has(folderId)) {
      newCollapsed.delete(folderId);
    } else {
      newCollapsed.add(folderId);
    }
    setCollapsedFolders(newCollapsed);
  };
  
  const renderFolders = (folderData, currentLevel) => {
    return (
        <div className={`space-y-4 ${currentLevel > 0 ? 'ml-6' : ''}`}>
        {folderData.map((category) => (
            <Card key={category.id} className="overflow-hidden">
            <CardHeader
                className={`cursor-pointer transition-colors duration-200 ${
                dropTarget === category.path ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                }`}
                onClick={() => toggleFolder(category.id)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => handleDragEnter(e, category.path)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, category.path)}
            >
                <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    {collapsedFolders.has(category.id) ? (
                    <ChevronRight className="w-5 h-5 text-gray-500" />
                    ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                    <Folder className="w-6 h-6 text-yellow-600" />
                    <div>
                    <CardTitle className="text-lg">{category.category}</CardTitle>
                    <CardDescription>
                        {category.files.length} αρχεί{category.files.length === 1 ? 'ο' : 'α'}
                        {category.subfolders.length > 0 && `, ${category.subfolders.length} υποφάκελ${category.subfolders.length === 1 ? 'ος' : 'οι'}`}
                    </CardDescription>
                    </div>
                </div>
                <Badge variant="secondary">
                    {category.files.length}
                </Badge>
                </div>
            </CardHeader>

            {!collapsedFolders.has(category.id) && (
                <CardContent className="p-4">
                {/* Render subfolders */}
                {category.subfolders && category.subfolders.length > 0 && (
                    renderFolders(category.subfolders, currentLevel + 1)
                )}

                {/* Render files */}
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                    {category.files.map((file) => (
                        <FileItem key={file.id} file={file} viewMode={viewMode} handleDragStart={handleDragStart} category={category.path} />
                    ))}
                    </div>
                ) : (
                    <div className="space-y-2 mt-4">
                    {category.files.map((file) => (
                        <FileItem key={file.id} file={file} viewMode={viewMode} handleDragStart={handleDragStart} category={category.path} />
                    ))}
                    </div>
                )}
                </CardContent>
            )}
            </Card>
        ))}
        </div>
    );
  }

  return renderFolders(categories, level);
};

export default FolderTree;
