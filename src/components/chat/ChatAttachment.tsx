import { useState } from 'react';
import { Download, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { fileNameFromUrl, safeUploadUrl } from '../../lib/mediaUrl';

// Every image type the app accepts, matching the mobile client. The test allows a
// query string / fragment after the extension (signed URLs).
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|webp|heic|heif|bmp|tiff?|avif)(\?|#|$)/i;
// The subset browsers can actually decode. HEIC/HEIF have no browser decoder at all and
// TIFF only works in Safari, so those render as a downloadable image card rather than a
// broken <img>. AVIF/WebP are listed here but still fall back via the <img> onError below
// when an older browser can't decode them.
const BROWSER_DECODABLE_RE = /\.(jpe?g|png|gif|webp|bmp|avif)(\?|#|$)/i;

/** Renders a message attachment: inline image preview (click to open a lightbox),
 * an "image we can't decode" card, or a file download link. */
export function ChatAttachment({ fileUrl }: { fileUrl: string }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  // Flips to true when the browser refuses to decode an image we expected it to handle.
  const [decodeFailed, setDecodeFailed] = useState(false);

  // fileUrl is student/staff-supplied and unvalidated server-side today (a separate PR adds
  // write-side validation); resolve it through the safe helper before it ever reaches a
  // src/href, and never load or link a value it rejects.
  const url = safeUploadUrl(fileUrl);
  const fileName = fileNameFromUrl(fileUrl);

  if (!url) {
    return (
      <div className="flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg bg-black/10 dark:bg-white/10 max-w-[220px] text-muted-foreground">
        <ImageIcon className="w-4 h-4 shrink-0" />
        <span className="text-xs truncate">Attachment unavailable</span>
      </div>
    );
  }

  const isImage = IMAGE_EXT_RE.test(fileUrl);
  const canPreview = isImage && BROWSER_DECODABLE_RE.test(fileUrl) && !decodeFailed;

  if (canPreview) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="block mb-1 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label={`Open image ${fileName}`}
        >
          <img
            src={url}
            alt={fileName}
            onError={() => setDecodeFailed(true)}
            className="max-w-[220px] max-h-[220px] rounded-lg object-cover"
          />
        </button>

        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-3xl p-2 sm:p-3 bg-black/95 border-gray-800">
            <DialogTitle className="sr-only">{fileName}</DialogTitle>
            <img
              src={url}
              alt={fileName}
              className="max-h-[80vh] w-auto mx-auto object-contain rounded"
            />
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              download={fileName}
              className="flex items-center justify-center gap-1.5 text-xs text-gray-200 hover:text-white"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="truncate max-w-[70vw]">{fileName}</span>
            </a>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Images the browser cannot render (HEIC/HEIF/TIFF, or a failed decode) still read as
  // images — an image chip that downloads instead of a broken preview.
  if (isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        download={fileName}
        className="flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg bg-black/10 dark:bg-white/10 max-w-[220px]"
      >
        <ImageIcon className="w-4 h-4 shrink-0" />
        <span className="min-w-0">
          <span className="block text-xs truncate">{fileName}</span>
          <span className="block text-[10px] opacity-70">Preview unavailable — open to view</span>
        </span>
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline mb-1 break-all block">
      📎 {fileName}
    </a>
  );
}
