import React, { useState, useRef } from 'react';
import { Upload, X, File, Image, FileText, Archive, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import PDFPreview from './PDFPreview';
import type { StepAttachment } from '../types';
import { MAX_FILE_SIZE_MB } from '../config/constants';

interface FileUploadAreaProps {
  attachments: StepAttachment[];
  onFileUpload: (file: File) => Promise<void>;
  onFileDelete: (attachmentId: number | string) => Promise<void>;
  disabled?: boolean;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
  tempMode?: boolean; // For handling temporary files before step is saved
}

const FileUploadArea: React.FC<FileUploadAreaProps> = (props) => {
  const {
    attachments,
    onFileUpload,
    onFileDelete,
    disabled = false,
    maxFileSize = MAX_FILE_SIZE_MB,
    allowedTypes = ['pdf', 'docx', 'doc', 'jpg', 'png', 'gif', 'webp', 'txt', 'zip', 'xlsx', 'pptx'],
    tempMode = false
  } = props;
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await handleFileUpload(files[0]);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      alert(`File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed size of ${maxFileSize}MB`);
      return;
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension && !allowedTypes.includes(fileExtension)) {
      alert(`File type .${fileExtension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
      return;
    }

    setIsUploading(true);
    try {
      await onFileUpload(file);
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    if (disabled || isUploading) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
          const namedFile = file.name
            ? file
            : new File([file], `pasted-image-${Date.now()}.${extension}`, { type: file.type });
          await handleFileUpload(namedFile);
          break;
        }
      }
    }
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <Image className="w-5 h-5 text-blue-500" />;
      case 'zip':
      case 'rar':
        return <Archive className="w-5 h-5 text-yellow-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : disabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label="Upload files. Drag and drop, choose files, or paste an image with Ctrl+V."
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept={allowedTypes.map(type => `.${type}`).join(',')}
          disabled={disabled}
        />

        <div className="space-y-2">
          <Upload className={`w-8 h-8 mx-auto ${disabled ? 'text-gray-400' : 'text-gray-500'}`} />
          <div>
            <p className={`text-sm ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
              {isUploading ? 'Uploading...' : 'Drag and drop files here, or'}
            </p>
            {!disabled && !isUploading && (
              <p className="text-xs text-gray-500">
                Click here and press Ctrl+V to paste an image
              </p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading}
              className="mt-2"
            >
              Choose Files
            </Button>
          </div>
          <p className="text-xs text-gray-500">
            Max {maxFileSize}MB • {allowedTypes.join(', ').toUpperCase()}
          </p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {attachments.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900">Attached Files</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="relative">
                {attachment.file_type.toLowerCase() === 'pdf' && !tempMode && attachment.file_url ? (
                  // PDF Preview
                  <div className="relative">
                    <PDFPreview
                      filename={attachment.filename}
                      fileUrl={attachment.file_url}
                      fileSize={attachment.file_size}
                      showFullPreview={false}
                    />
                    {!disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onFileDelete(attachment.id)}
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800 bg-white/90 hover:bg-white p-1 rounded-full shadow-sm"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  // Regular file display
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(attachment.file_type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.filename}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.file_size)} • {attachment.file_type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!tempMode && attachment.file_url && (
                        <a
                          href={`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${attachment.file_url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800"
                        >
                          Download
                        </a>
                      )}
                      {tempMode && (
                        <span className="text-sm text-gray-500">
                          Ready to upload
                        </span>
                      )}
                      {!disabled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onFileDelete(tempMode ? attachment.filename : attachment.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadArea;
