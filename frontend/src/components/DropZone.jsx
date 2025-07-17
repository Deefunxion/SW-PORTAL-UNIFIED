import React, { useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, FileCheck, FileX } from 'lucide-react';
import { toast } from 'sonner';

const baseStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '40px',
  borderWidth: 2,
  borderRadius: '0.5rem',
  borderColor: '#e2e8f0',
  borderStyle: 'dashed',
  backgroundColor: '#f8fafc',
  color: '#64748b',
  outline: 'none',
  transition: 'border .24s ease-in-out, background-color .24s ease-in-out',
  cursor: 'pointer',
};

const activeStyle = {
  borderColor: '#2563eb',
  backgroundColor: '#eff6ff',
};

const acceptStyle = {
  borderColor: '#16a34a',
  backgroundColor: '#f0fdf4',
};

const rejectStyle = {
  borderColor: '#dc2626',
  backgroundColor: '#fef2f2',
};

function DropZone({ onDrop, maxFiles = 10, maxSize = 16 * 1024 * 1024 /* 16MB */ }) {
  const onDropValidated = useCallback((acceptedFiles, fileRejections) => {
    if (fileRejections.length > 0) {
      fileRejections.forEach(({ file, errors }) => {
        errors.forEach(error => {
          if (error.code === 'file-too-large') {
            toast.error(`Το αρχείο "${file.name}" είναι πολύ μεγάλο. Μέγιστο μέγεθος: ${maxSize / 1024 / 1024}MB`);
          } else if (error.code === 'file-invalid-type') {
            toast.error(`Μη αποδεκτός τύπος αρχείου για το "${file.name}"`);
          } else {
            toast.error(`Σφάλμα στο αρχείο "${file.name}": ${error.message}`);
          }
        });
      });
    }

    if (acceptedFiles.length > 0) {
      onDrop(acceptedFiles);
    }
  }, [onDrop, maxSize]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    onDrop: onDropValidated,
    maxFiles,
    maxSize,
  });

  const style = useMemo(() => ({
    ...baseStyle,
    ...(isDragActive ? activeStyle : {}),
    ...(isDragAccept ? acceptStyle : {}),
    ...(isDragReject ? rejectStyle : {}),
  }), [isDragActive, isDragReject, isDragAccept]);

  const getIcon = () => {
    if (isDragAccept) return <FileCheck className="w-16 h-16 text-green-500" />;
    if (isDragReject) return <FileX className="w-16 h-16 text-red-500" />;
    return <UploadCloud className="w-16 h-16 text-gray-400" />;
  };

  const getText = () => {
    if (isDragAccept) return "Αφήστε τα αρχεία για να ξεκινήσει το ανέβασμα...";
    if (isDragReject) return "Μερικά αρχεία δεν είναι αποδεκτά";
    return "Σύρετε αρχεία εδώ, ή κάντε κλικ για επιλογή";
  };

  return (
    <div {...getRootProps({ style })}>
      <input {...getInputProps()} />
      {getIcon()}
      <p className="mt-4 text-center text-sm">{getText()}</p>
      <p className="text-xs text-gray-500 mt-1">
        Μέγιστος αριθμός αρχείων: {maxFiles}, Μέγιστο μέγεθος: {maxSize / 1024 / 1024}MB
      </p>
    </div>
  );
}

export default DropZone;
