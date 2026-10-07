import React, { useState } from 'react';
import { X, Download, Maximize2, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { useT } from '@/lib/i18n/react';
import type { MessageKey } from '@/lib/i18n';
import '@/lib/i18n/catalogs/courseAuthoring';

const SIZE_KEYS: MessageKey[] = ['courseAuthoring.size.bytes', 'courseAuthoring.size.kb', 'courseAuthoring.size.mb', 'courseAuthoring.size.gb'];

interface PDFPreviewProps {
  filename: string;
  fileUrl: string;
  fileSize: number;
  onClose?: () => void;
  showFullPreview?: boolean;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({
  filename,
  fileUrl,
  fileSize,
  onClose,
  showFullPreview = false
}) => {
  const t = useT();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return t('courseAuthoring.size.bytes', { size: 0 });
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return t(SIZE_KEYS[i], { size: parseFloat((bytes / Math.pow(k, i)).toFixed(2)) });
  };

  const fullUrl = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}${fileUrl}`;

  const handleIframeLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!showFullPreview) {
    // Compact preview for FileUploadArea
    return (
      <div className="relative bg-muted border rounded-lg overflow-hidden">
        <div className="aspect-[4/3] relative">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand"></div>
            </div>
          )}
          {hasError ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
              <div className="text-center">
                <FileText className="mx-auto mb-2 h-6 w-6" aria-hidden="true" />
                <div className="text-xs">{t('courseAuthoring.pdf.preview')}</div>
              </div>
            </div>
          ) : (
            <iframe
              src={`${fullUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="w-full h-full border-0"
              title={filename}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
            />
          )}
        </div>
        <div className="p-2 bg-card border-t">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{filename}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
            </div>
            <div className="flex items-center space-x-1 ml-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsFullscreen(true)}
                className="h-6 w-6 p-0"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                asChild
                className="h-6 w-6 p-0"
              >
                <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                  <Download className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Fullscreen Modal */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-card rounded-lg w-full h-full max-w-6xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <div>
                  <h3 className="text-lg font-semibold">{filename}</h3>
                  <p className="text-sm text-muted-foreground">{formatFileSize(fileSize)}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                  >
                    <a href={fullUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />
                      {t('courseAuthoring.pdf.download')}
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsFullscreen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 relative">
                <iframe
                  src={fullUrl}
                  className="w-full h-full border-0"
                  title={filename}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full preview mode
  return (
    <div className="w-full h-full bg-card rounded-lg border overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b bg-muted">
        <div>
          <h4 className="text-sm font-medium">{filename}</h4>
          <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="outline"
            asChild
          >
            <a href={fullUrl} target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-1" />
              {t('courseAuthoring.pdf.download')}
            </a>
          </Button>
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="relative" style={{ height: 'calc(100% - 60px)' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
          </div>
        )}
        <iframe
          src={fullUrl}
          className="w-full h-full border-0"
          title={filename}
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>
    </div>
  );
};

export default PDFPreview;
