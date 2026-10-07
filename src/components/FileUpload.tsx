import React, { useState, useRef } from 'react';
import { Upload, X, File, Download, FileImage, FileText, Paperclip, type LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/courseAuthoring';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  selectedFile?: File | null;
  uploadedFileUrl?: string;
  uploadedFileName?: string;
  allowedTypes?: string[];
  maxSizeMB?: number;
  disabled?: boolean;
  className?: string;
}

export default function FileUpload({
  onFileSelect,
  onFileRemove,
  selectedFile,
  uploadedFileUrl,
  uploadedFileName,
  allowedTypes = ['pdf', 'docx', 'doc', 'jpg', 'png', 'gif', 'txt'],
  maxSizeMB = 10,
  disabled = false,
  className = ''
}: FileUploadProps) {
  const t = useT();
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);

    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension && !allowedTypes.includes(fileExtension)) {
      setError(t('courseAuthoring.upload.typeNotAllowed', { ext: fileExtension, types: allowedTypes.join(', ') }));
      return;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setError(t('courseAuthoring.upload.tooLarge', { size: fileSizeMB.toFixed(1), max: maxSizeMB }));
      return;
    }

    onFileSelect(file);
  };

  const handleRemove = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onFileRemove?.();
    setError(null);
  };

  const getFileIcon = (fileName: string): LucideIcon => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
      case 'docx':
      case 'doc':
      case 'txt':
        return FileText;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return FileImage;
      default:
        return Paperclip;
    }
  };
  const UploadedFileIcon = getFileIcon(uploadedFileName || '');

  return (
    <div className={`space-y-4 ${className}`}>
      {/* File Upload Area */}
      {!uploadedFileUrl && (
        <div
          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept={allowedTypes.map(type => `.${type}`).join(',')}
            disabled={disabled}
          />
          
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              {dragActive ? t('courseAuthoring.upload.dropHere') : t('courseAuthoring.upload.clickOrDrag')}
            </p>
            <p className="text-xs text-gray-500">
              {t('courseAuthoring.upload.typesUpTo', { types: allowedTypes.join(', ').toUpperCase(), max: maxSizeMB })}
            </p>
          </div>
        </div>
      )}

      {/* Selected File Display */}
      {selectedFile && (
        <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <File className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">
                {t('courseAuthoring.size.mb', { size: (selectedFile.size / (1024 * 1024)).toFixed(1) })}
              </p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="p-1 text-gray-400 hover:text-gray-600"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Uploaded File Display */}
      {uploadedFileUrl && (
        <div className="flex items-center justify-between gap-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-lg">
          <div className="flex min-w-0 items-center space-x-3">
            <UploadedFileIcon className="h-5 w-5 shrink-0 text-green-700 dark:text-green-400" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                {uploadedFileName || t('courseAuthoring.upload.uploadedFile')}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{t('courseAuthoring.upload.uploaded')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <a
              href={uploadedFileUrl}
              download
              className="p-1 text-green-600 hover:text-green-700"
              title={t('courseAuthoring.upload.downloadFile')}
            >
              <Download className="h-4 w-4" />
            </a>
            {onFileRemove && (
              <button
                onClick={handleRemove}
                className="p-1 text-gray-400 hover:text-gray-600"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
