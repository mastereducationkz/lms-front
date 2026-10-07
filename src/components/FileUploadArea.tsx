import React, { useState, useRef } from 'react';
import { Upload, X, File, Image, FileText, Archive, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import PDFPreview from './PDFPreview';
import type { StepAttachment } from '../types';
import { MAX_FILE_SIZE_MB } from '../config/constants';
import { useT } from '@/lib/i18n/react';
import type { MessageKey } from '@/lib/i18n';
import '@/lib/i18n/catalogs/courseAuthoring';

const SIZE_KEYS: MessageKey[] = ['courseAuthoring.size.bytes', 'courseAuthoring.size.kb', 'courseAuthoring.size.mb', 'courseAuthoring.size.gb'];

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
  const t = useT();
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
      alert(t('courseAuthoring.upload.tooLarge', { size: fileSizeMB.toFixed(1), max: maxFileSize }));
      return;
    }

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension && !allowedTypes.includes(fileExtension)) {
      alert(t('courseAuthoring.upload.typeNotAllowed', { ext: fileExtension, types: allowedTypes.join(', ') }));
      return;
    }

    setIsUploading(true);
    try {
      await onFileUpload(file);
    } catch (error) {
      console.error('Failed to upload file:', error);
      alert(t('courseAuthoring.upload.failed'));
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
        return <FileText className="w-5 h-5 text-red-500 dark:text-red-400" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <Image className="w-5 h-5 text-brand" />;
      case 'zip':
      case 'rar':
        return <Archive className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />;
      default:
        return <File className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return t('courseAuthoring.size.bytes', { size: 0 });
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return t(SIZE_KEYS[i], { size: parseFloat((bytes / Math.pow(k, i)).toFixed(2)) });
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          isDragOver
            ? 'border-brand bg-brand-surface'
            : disabled
            ? 'border-border bg-muted'
            : 'border-input hover:border-input'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-label={t('courseAuthoring.upload.areaAria')}
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
          <Upload className={`w-8 h-8 mx-auto ${disabled ? 'text-muted-foreground' : 'text-muted-foreground'}`} />
          <div>
            <p className={`text-sm ${disabled ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
              {isUploading ? t('courseAuthoring.upload.uploading') : t('courseAuthoring.upload.dragFilesOr')}
            </p>
            {!disabled && !isUploading && (
              <p className="text-xs text-muted-foreground">
                {t('courseAuthoring.upload.pasteHint')}
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
              {t('courseAuthoring.upload.chooseFiles')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('courseAuthoring.upload.maxAndTypes', { max: maxFileSize, types: allowedTypes.join(', ').toUpperCase() })}
          </p>
        </div>
      </div>

      {/* Uploaded Files List */}
      {attachments.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-foreground">{t('courseAuthoring.upload.attached')}</h4>
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
                        className="absolute top-2 right-2 text-red-600 hover:text-red-800 bg-card/90 hover:bg-card p-1 rounded-full shadow-sm dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  // Regular file display
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg border">
                    <div className="flex items-center space-x-3">
                      {getFileIcon(attachment.file_type)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {attachment.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
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
                          className="text-sm text-brand hover:text-brand"
                        >
                          {t('courseAuthoring.pdf.download')}
                        </a>
                      )}
                      {tempMode && (
                        <span className="text-sm text-muted-foreground">
                          {t('courseAuthoring.upload.ready')}
                        </span>
                      )}
                      {!disabled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onFileDelete(tempMode ? attachment.filename : attachment.id)}
                          className="text-red-600 hover:text-red-800 p-1 dark:text-red-400 dark:hover:text-red-300"
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
