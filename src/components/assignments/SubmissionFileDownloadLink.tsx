import { Download } from 'lucide-react';
import { safeUploadUrl } from '../../lib/mediaUrl';

interface SubmissionFileDownloadLinkProps {
  /** The stored file reference on a submission — untrusted, student-supplied; the backend
   *  accepts any string today, and legacy rows already hold whatever an old client sent. */
  fileUrl: string | null | undefined;
  className?: string;
}

/**
 * A "Download" link for a submission's file, resolved through `safeUploadUrl`. When the
 * stored value isn't a safe upload reference (a hostile scheme, a foreign host, a
 * malformed legacy row), renders nothing rather than a live link — callers already show
 * the file name as plain text next to this, so the file stays visible either way.
 */
export function SubmissionFileDownloadLink({ fileUrl, className }: SubmissionFileDownloadLinkProps) {
  const href = safeUploadUrl(fileUrl);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      <Download className="w-4 h-4 mr-1" />
      Download
    </a>
  );
}
