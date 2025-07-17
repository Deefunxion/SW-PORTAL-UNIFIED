import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card.jsx';
import { Button } from '@/components/ui/button.jsx';
import { 
  Image as ImageIcon, 
  Download, 
  Eye, 
  X, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  File,
  FileText,
  Archive
} from 'lucide-react';

/**
 * Image Gallery Modal Component
 */
function ImageModal({ 
  images, 
  currentIndex, 
  isOpen, 
  onClose, 
  onNext, 
  onPrevious 
}) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
    }
  }, [isOpen, currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          onPrevious();
          break;
        case 'ArrowRight':
          onNext();
          break;
        case '+':
        case '=':
          setZoom(prev => Math.min(prev * 1.2, 5));
          break;
        case '-':
          setZoom(prev => Math.max(prev / 1.2, 0.1));
          break;
        case 'r':
        case 'R':
          setRotation(prev => (prev + 90) % 360);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onNext, onPrevious]);

  if (!isOpen || !images[currentIndex]) return null;

  const currentImage = images[currentIndex];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 bg-black bg-opacity-50 p-4 flex items-center justify-between text-white z-10">
        <div className="flex items-center space-x-4">
          <h3 className="font-medium truncate max-w-md">
            {currentImage.original_filename}
          </h3>
          <span className="text-sm text-gray-300">
            {currentIndex + 1} από {images.length}
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.1))}
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setZoom(prev => Math.min(prev * 1.2, 5))}
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRotation(prev => (prev + 90) % 360)}
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(`/api/attachments/${currentImage.id}/download`, '_blank')}
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            <Download className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="lg"
            onClick={onPrevious}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white hover:bg-opacity-20 z-10"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          
          <Button
            variant="ghost"
            size="lg"
            onClick={onNext}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:bg-white hover:bg-opacity-20 z-10"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      {/* Image */}
      <div className="flex items-center justify-center w-full h-full p-16">
        <img
          src={`/api/attachments/${currentImage.id}/download`}
          alt={currentImage.original_filename}
          className="max-w-full max-h-full object-contain cursor-move"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s ease-in-out'
          }}
          onClick={(e) => {
            if (e.detail === 2) { // Double click
              setZoom(zoom === 1 ? 2 : 1);
            }
          }}
        />
      </div>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4 text-white text-center text-sm">
        <div className="flex items-center justify-center space-x-4">
          <span>Χρησιμοποιήστε τα βέλη για πλοήγηση</span>
          <span>•</span>
          <span>Double-click για zoom</span>
          <span>•</span>
          <span>ESC για κλείσιμο</span>
        </div>
      </div>
    </div>
  );
}

/**
 * File Icon Component
 */
function FileIcon({ attachment, className = "h-8 w-8" }) {
  const getFileIcon = () => {
    if (attachment.is_image) {
      return { icon: ImageIcon, color: 'text-green-500' };
    }
    
    const extension = attachment.file_type?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return { icon: FileText, color: 'text-red-500' };
      case 'doc':
      case 'docx':
        return { icon: FileText, color: 'text-blue-500' };
      case 'xls':
      case 'xlsx':
        return { icon: FileText, color: 'text-green-600' };
      case 'zip':
      case 'rar':
      case '7z':
        return { icon: Archive, color: 'text-purple-500' };
      default:
        return { icon: File, color: 'text-gray-500' };
    }
  };

  const { icon: Icon, color } = getFileIcon();
  return <Icon className={`${className} ${color}`} />;
}

/**
 * Main Attachment Gallery Component
 */
function AttachmentGallery({ 
  attachments = [], 
  showThumbnails = true,
  maxThumbnails = 4,
  className = '' 
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const images = attachments.filter(att => att.is_image);
  const files = attachments.filter(att => !att.is_image);

  const openImageModal = (imageIndex) => {
    setCurrentImageIndex(imageIndex);
    setModalOpen(true);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const previousImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Image Gallery */}
      {images.length > 0 && showThumbnails && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <ImageIcon className="h-4 w-4 mr-1" />
            Εικόνες ({images.length})
          </h4>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {images.slice(0, maxThumbnails).map((image, index) => (
              <div
                key={image.id}
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-100 aspect-square"
                onClick={() => openImageModal(index)}
              >
                <img
                  src={image.thumbnail_path ? 
                    `/api/attachments/${image.id}/thumbnail` : 
                    `/api/attachments/${image.id}/download`
                  }
                  alt={image.original_filename}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                />
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 flex items-center justify-center">
                  <Eye className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                
                {/* File name tooltip */}
                <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="truncate">{image.original_filename}</p>
                </div>
              </div>
            ))}
            
            {images.length > maxThumbnails && (
              <div 
                className="relative group cursor-pointer rounded-lg overflow-hidden bg-gray-200 aspect-square flex items-center justify-center"
                onClick={() => openImageModal(maxThumbnails)}
              >
                <div className="text-center">
                  <Maximize2 className="h-6 w-6 text-gray-500 mx-auto mb-1" />
                  <p className="text-xs text-gray-600">
                    +{images.length - maxThumbnails} περισσότερες
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <File className="h-4 w-4 mr-1" />
            Αρχεία ({files.length})
          </h4>
          
          <div className="space-y-2">
            {files.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center space-x-3">
                  <FileIcon attachment={file} />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {file.original_filename}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{file.file_type?.toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatFileSize(file.file_size)}</span>
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => window.open(`/api/attachments/${file.id}/download`, '_blank')}
                    className="h-8 w-8 p-0"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Compact view for images when thumbnails are disabled */}
      {images.length > 0 && !showThumbnails && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
            <ImageIcon className="h-4 w-4 mr-1" />
            Εικόνες ({images.length})
          </h4>
          
          <div className="space-y-2">
            {images.map((image, index) => (
              <Card key={image.id} className="p-3">
                <div className="flex items-center space-x-3">
                  <FileIcon attachment={image} />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {image.original_filename}
                    </p>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{image.file_type?.toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatFileSize(image.file_size)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openImageModal(index)}
                      className="h-8 w-8 p-0"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`/api/attachments/${image.id}/download`, '_blank')}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Image Modal */}
      <ImageModal
        images={images}
        currentIndex={currentImageIndex}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onNext={nextImage}
        onPrevious={previousImage}
      />
    </div>
  );
}

export default AttachmentGallery;

