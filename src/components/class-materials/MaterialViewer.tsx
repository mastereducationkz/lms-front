import { useEffect, useRef, useState } from 'react';
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
  pdf: 'flex h-[90vh] max-w-4xl flex-col gap-2 p-2 sm:p-3',
  audio: 'max-w-sm',
  download: 'max-w-sm',
};

/**
 * Opens one file material: logs the open (`POST …/open`, which mints the short-lived signed URL)
 * and renders whatever its kind calls for — a lightbox, an inline pdf with an «open in a new tab»
 * fallback (phones often can't show a pdf in an iframe), the audio player, or a "download"
 * button for Office/HEIC, which browsers can't preview (D13). Link items never come here:
 * `MaterialRow` opens them through a plain anchor.
 *
 * Audio outlives its signed URL on a long listen. If the player errors, the URL is minted again
 * once per open and playback resumes where it stopped.
 */
export default function MaterialViewer({ item, open, onOpenChange, locale }: Props) {
  const [result, setResult] = useState<OpenResult | null>(null);
  const [resumeAt, setResumeAt] = useState<{ at: number; play: boolean } | null>(null);
  // Bumped on every open, so a late URL refresh never lands on a different item's viewer.
  const session = useRef(0);
  const audioRefreshed = useRef(false);
  const kind = item ? viewerContentKind(item) : null;

  useEffect(() => {
    const current = ++session.current;
    setResult(null);
    setResumeAt(null);
    audioRefreshed.current = false;
    if (!open || !item || viewerContentKind(item) === 'link') return;
    openClassMaterialItem(item.id)
      .then((res) => {
        if (session.current === current) setResult(res);
      })
      .catch((e) => {
        if (session.current !== current) return;
        toast.error(errorMessage(apiErrorCode(e), locale));
        onOpenChange(false);
      });
    // `onOpenChange` is expected to be a stable setter from the caller; re-running this only
    // on `open`/the item changing (not on every parent render) avoids re-fetching mid-view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  useEffect(
    () => () => {
      session.current += 1;
    },
    [],
  );

  const refreshAudio = (state: { currentTime: number; playing: boolean }) => {
    if (!item) return;
    if (audioRefreshed.current) {
      toast.error(t('somethingWrong', locale));
      return;
    }
    audioRefreshed.current = true;
    const current = session.current;
    openClassMaterialItem(item.id)
      .then((res) => {
        if (session.current !== current) return;
        setResumeAt({ at: state.currentTime, play: state.playing });
        setResult(res);
      })
      .catch((e) => {
        if (session.current === current) toast.error(errorMessage(apiErrorCode(e), locale));
      });
  };

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
          <>
            <iframe src={result.url} title={item.title} className="min-h-0 w-full flex-1 rounded border-0" />
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-none self-center py-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t('openInNewTab', locale)}
            </a>
          </>
        )}
        {result && kind === 'audio' && <AudioPlayer src={result.url} resumeAt={resumeAt} onError={refreshAudio} />}
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
