import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button.jsx';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { 
  Upload, 
  X, 
  File, 
  Image as ImageIcon, 
  FileText, 
  Archive,
  AlertCircle,
  Check,
  Loader2
} from 'lucide-react';
import api from '@/lib/api';

/**
 * File Attachment Uploader Component
 * Supports multiple file types with drag & drop
 */
function AttachmentUploader({ 
  postId, 
  onUploadComplete, 
  onUploadError,
  maxFiles = 5,
  maxFileSize = 16 * 1024 * 1024, // 16MB
  disabled = false 
}) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const allowedTypes = {
    'image/png': { icon: ImageIcon, color: 'text-green-500', label: 'PNG Image' },
    'image/jpeg': { icon: ImageIcon, color: 'text-green-500', label: 'JPEG Image' },
    'image/jpg': { icon: ImageIcon, color: 'text-green-500', label: 'JPG Image' },
    'image/gif': { icon: ImageIcon, color: 'text-green-500', label: 'GIF Image' },
    'image/webp': { icon: ImageIcon, color: 'text-green-500', label: 'WebP Image' },
    'application/pdf': { icon: FileText, color: 'text-red-500', label: 'PDF Document' },
    'application/msword': { icon: FileText, color: 'text-blue-500', label: 'Word Document' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
      icon: FileText, color: 'text-blue-500', label: 'Word Document' 
    },
    'text/plain': { icon: FileText, color: 'text-gray-500', label: 'Text File' },
    'application/zip': { icon: Archive, color: 'text-purple-500', label: 'ZIP Archive' },
    'application/x-rar-compressed': { icon: Archive, color: 'text-purple-500', label: 'RAR Archive' },
    'application/vnd.ms-excel': { icon: FileText, color: 'text-green-600', label: 'Excel File' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { 
      icon: FileText, color: 'text-green-600', label: 'Excel File' 
    }
  };

  const isFileAllowed = (file) => {
    return Object.keys(allowedTypes).includes(file.type) || 
           allowedTypes[`image/${file.name.split('.').pop().toLowerCase()}`];
  };

  const getFileIcon = (file) => {
    const typeInfo = allowedTypes[file.type] || allowedTypes[`image/${file.name.split('.').pop().toLowerCase()}`];
    return typeInfo || { icon: File, color: 'text-gray-400', label: 'Unknown File' };
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles);
    const validFiles = [];
    const errors = [];

    fileArray.forEach(file => {
      if (!isFileAllowed(file)) {
        errors.push(`${file.name}: Μη επιτρεπτός τύπος αρχείου`);
        return;
      }

      if (file.size > maxFileSize) {
        errors.push(`${file.name}: Το αρχείο είναι πολύ μεγάλο (μέγιστο ${formatFileSize(maxFileSize)})`);
        return;
      }

      if (files.length + validFiles.length >= maxFiles) {
        errors.push(`Μέγιστος αριθμός αρχείων: ${maxFiles}`);
        return;
      }

      validFiles.push({
        file,
        id: Date.now() + Math.random(),
        status: 'pending', // pending, uploading, success, error
        progress: 0,
        error: null
      });
    });

    if (errors.length > 0 && onUploadError) {
      onUploadError(errors.join('\n'));
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    
    if (disabled) return;

    const droppedFiles = e.dataTransfer.files;
    handleFileSelect(droppedFiles);
  };

  const removeFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFile = async (fileItem) => {
    const formData = new FormData();
    formData.append('file', fileItem.file);

    try {
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      const response = await api.post(`/api/posts/${postId}/attachments`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setFiles(prev => prev.map(f => 
            f.id === fileItem.id 
              ? { ...f, progress }
              : f
          ));
        }
      });

      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'success', progress: 100, uploadedData: response.data.attachment }
          : f
      ));

      if (onUploadComplete) {
        onUploadComplete(response.data.attachment);
      }

    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Σφάλμα κατά το ανέβασμα';
      
      setFiles(prev => prev.map(f => 
        f.id === fileItem.id 
          ? { ...f, status: 'error', error: errorMessage }
          : f
      ));

      if (onUploadError) {
        onUploadError(`${fileItem.file.name}: ${errorMessage}`);
      }
    }
  };

  const uploadAllFiles = async () => {
    if (uploading || files.length === 0) return;

    setUploading(true);
    const pendingFiles = files.filter(f => f.status === 'pending');

    for (const fileItem of pendingFiles) {
      await uploadFile(fileItem);
    }

    setUploading(false);
  };

  const clearAllFiles = () => {
    setFiles([]);
  };

  const pendingFiles = files.filter(f => f.status === 'pending');
  const uploadingFiles = files.filter(f => f.status === 'uploading');
  const successFiles = files.filter(f => f.status === 'success');
  const errorFiles = files.filter(f => f.status === 'error');

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-400'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 mb-1">
          Σύρετε αρχεία εδώ ή κάντε κλικ για επιλογή
        </p>
        <p className="text-xs text-gray-500">
          Μέγιστο {maxFiles} αρχεία, {formatFileSize(maxFileSize)} το καθένα
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Υποστηρίζονται: Εικόνες, PDF, Word, Excel, ZIP
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
        disabled={disabled}
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Επιλεγμένα αρχεία ({files.length})
            </h4>
            <div className="flex items-center space-x-2">
              {pendingFiles.length > 0 && (
                <Button
                  onClick={uploadAllFiles}
                  disabled={uploading || disabled}
                  size="sm"
                  className="h-8"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Ανέβασμα...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-1" />
                      Ανέβασμα όλων
                    </>
                  )}
                </Button>
              )}
              <Button
                onClick={clearAllFiles}
                variant="outline"
                size="sm"
                className="h-8"
                disabled={uploading}
              >
                Καθαρισμός
              </Button>
            </div>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((fileItem) => {
              const fileInfo = getFileIcon(fileItem.file);
              const Icon = fileInfo.icon;

              return (
                <Card key={fileItem.id} className="p-3">
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-5 w-5 ${fileInfo.color}`} />
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {fileItem.file.name}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500">
                        <span>{formatFileSize(fileItem.file.size)}</span>
                        <span>•</span>
                        <span>{fileInfo.label}</span>
                      </div>
                      
                      {/* Progress Bar */}
                      {fileItem.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${fileItem.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            {fileItem.progress}% ολοκληρώθηκε
                          </p>
                        </div>
                      )}

                      {/* Error Message */}
                      {fileItem.status === 'error' && (
                        <p className="text-xs text-red-600 mt-1">
                          {fileItem.error}
                        </p>
                      )}
                    </div>

                    {/* Status Icon */}
                    <div className="flex items-center space-x-2">
                      {fileItem.status === 'success' && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      {fileItem.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      {fileItem.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                      )}
                      
                      {(fileItem.status === 'pending' || fileItem.status === 'error') && (
                        <Button
                          onClick={() => removeFile(fileItem.id)}
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Summary */}
          {(successFiles.length > 0 || errorFiles.length > 0) && (
            <div className="text-xs text-gray-500 pt-2 border-t">
              {successFiles.length > 0 && (
                <span className="text-green-600">
                  {successFiles.length} αρχεία ανέβηκαν επιτυχώς
                </span>
              )}
              {successFiles.length > 0 && errorFiles.length > 0 && <span> • </span>}
              {errorFiles.length > 0 && (
                <span className="text-red-600">
                  {errorFiles.length} αρχεία απέτυχαν
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AttachmentUploader;

