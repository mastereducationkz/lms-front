import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, X } from 'lucide-react';
import { Button } from '../ui/button';
import { fetchResultProofBlob } from '../../services/api/exams';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/exams';

interface Props {
  resultId: number;
  title?: string;
  /** Shown for write roles: swap the file for another. */
  onReplace?: () => void;
  onClose: () => void;
}

/** The private score report, fetched through the authenticated client and shown in the page. */
export function ProofPreviewDialog({ resultId, title, onReplace, onClose }: Props) {
  const t = useT();
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBlob(null); setFailed(false);
    fetchResultProofBlob(resultId).then(
      (b) => { if (!cancelled) setBlob(b); },
      () => { if (!cancelled) setFailed(true); },
    );
    return () => { cancelled = true; };
  }, [resultId]);

  useEffect(() => {
    if (!blob) { setUrl(null); return undefined; }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const isPdf = blob?.type === 'application/pdf';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-2 sm:p-4"
         role="dialog" aria-modal="true" aria-label={t('exams.proof.dialogTitle')}
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col rounded-lg bg-background shadow-lg">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
            {title ?? t('exams.proof.dialogTitle')}
          </h2>
          {onReplace && <Button size="sm" variant="outline" onClick={onReplace}>{t('exams.proof.replace')}</Button>}
          {url && (
            <Button size="sm" variant="ghost" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer" aria-label={t('exams.proof.openTab')} title={t('exams.proof.openTab')}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose} aria-label={t('common.close')}>
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="min-h-[40vh] flex-1 overflow-auto p-2">
          {failed && <p className="p-6 text-center text-sm text-red-600 dark:text-red-400" role="alert">{t('exams.errors.openFileFailed')}</p>}
          {!failed && !url && <p className="p-6 text-center text-sm text-muted-foreground">{t('common.loading')}</p>}
          {url && (isPdf
            ? <iframe src={url} title={t('exams.proof.dialogTitle')} className="h-[78vh] w-full rounded border" />
            : <img src={url} alt={t('exams.proof.dialogTitle')} className="mx-auto max-h-[78vh] max-w-full object-contain" />)}
        </div>
      </div>
    </div>,
    document.body,
  );
}
