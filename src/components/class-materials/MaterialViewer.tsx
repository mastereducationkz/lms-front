import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { AudioPlayer } from '../AudioPlayer';
import { apiErrorCode, openClassMaterialItem, type MaterialItem, type OpenResult } from '../../services/api/classMaterials';
import { errorMessage, t, type Locale } from '../../lib/classMaterials';
import { viewerContentKind } from '../../lib/classMaterialsView';

interface Props {
  item: MaterialItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}

const DIALOG_CLASS: Record<'image' | 'pdf' | 'audio' | 'download', string> = {
  image: 'max-w-[95vw] border-gray-800 bg-black/95 p-2 sm:max-w-3xl sm:p-3',
  pdf: 'flex h-[90vh] max-w-4xl flex-col p-2 sm:p-3',
  audio: 'max-w-sm',
  download: 'max-w-sm',
};

/**
 * Opens one material: logs the open (`POST …/open`, which mints the short-lived signed URL)
 * and renders whatever its kind calls for — a lightbox, an inline pdf, the audio player, or a
 * "download" button for Office/HEIC, which browsers can't preview (D13). A link item never
 * shows a dialog at all: it opens in a new tab and `onOpenChange(false)` fires right away, so
 * the caller's `open` state falls back in step.
 */
export default function MaterialViewer({ item, open, onOpenChange, locale }: Props) {
  const [result, setResult] = useState<OpenResult | null>(null);
  const kind = item ? viewerContentKind(item) : null;

  useEffect(() => {
    setResult(null);
    if (!open || !item) return undefined;
    let cancelled = false;
    openClassMaterialItem(item.id)
      .then((res) => {
        if (cancelled) return;
        if (res.kind === 'link') {
          window.open(res.url, '_blank', 'noopener,noreferrer');
          onOpenChange(false);
          return;
        }
        setResult(res);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(errorMessage(apiErrorCode(e), locale));
        onOpenChange(false);
      });
    return () => {
      cancelled = true;
    };
    // `onOpenChange` is expected to be a stable setter from the caller; re-running this only
    // on `open`/the item changing (not on every parent render) avoids re-fetching mid-view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  if (!item || kind === null || kind === 'link') return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS[kind]}>
        <DialogTitle className="sr-only">{item.title}</DialogTitle>
        {!result && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          </div>
        )}
        {result && kind === 'image' && (
          <img src={result.url} alt={item.title} className="mx-auto max-h-[80vh] w-auto rounded object-contain" />
        )}
        {result && kind === 'pdf' && (
          <iframe src={result.url} title={item.title} className="h-full w-full flex-1 rounded border-0" />
        )}
        {result && kind === 'audio' && <AudioPlayer src={result.url} />}
        {result && kind === 'download' && (
          <button
            type="button"
            onClick={() => window.location.assign(result.url)}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted"
          >
            <Download className="h-4 w-4" aria-hidden />
            {t('download', locale)}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
