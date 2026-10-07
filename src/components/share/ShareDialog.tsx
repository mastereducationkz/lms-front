/**
 * «Share achievement» dialog (owner, 2026-10-04): the student's story card, the name option, and
 * two ways out — [Share] (the phone's share sheet: Instagram, Snapchat and WhatsApp live there)
 * and [Save image]. No links: the card never leaves the device, only a count of the share does.
 *
 * The card is drawn the moment the dialog opens, so both buttons hand the file over synchronously
 * inside the tap — iPhones refuse a share started after an await (the SAT platform's bug).
 */
import { useEffect, useMemo, useState } from 'react';
import { AtSign, Download, Laptop, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { trackShare } from '@/services/api/shares';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/studentHome';
import { renderShareCard } from './renderShareCard';
import {
  desktopHint,
  formatShareName,
  isIOSDevice,
  saveMethod,
  shareButtons,
  shareCaption,
  shareErrorMessage,
  tagPrompt,
  type NameMode,
} from './shareCopy';
import type { ShareItem } from './shareItems';

const FILE_NAME = 'master-education.png';

function isDesktop(): boolean {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

export default function ShareDialog({ item, onClose }: { item: ShareItem; onClose: () => void }) {
  const t = useT();
  const [nameMode, setNameMode] = useState<NameMode>('short');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drawFailed, setDrawFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const desktop = useMemo(isDesktop, []);
  const ios = useMemo(() => typeof navigator !== 'undefined' && isIOSDevice(navigator), []);

  const short = formatShareName(item.userName, 'short');
  const full = formatShareName(item.userName, 'full');
  const nameOptions: { mode: NameMode; label: string }[] = [
    ...(short ? [{ mode: 'short' as const, label: short }] : []),
    ...(full && full !== short ? [{ mode: 'full' as const, label: full }] : []),
    { mode: 'none', label: t('studentHome.share.noName') },
  ];

  // Draw the card (again when the name option changes).
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setFile(null);
    setDrawFailed(false);
    renderShareCard({ text: item.text, name: formatShareName(item.userName, nameMode), orca: item.orca, crown: item.crown })
      .then((png) => {
        if (cancelled) return;
        url = URL.createObjectURL(png);
        setPreview(url);
        setFile(new File([png], FILE_NAME, { type: 'image/png' }));
      })
      .catch(() => { if (!cancelled) setDrawFailed(true); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [item, nameMode]);

  const canShareFiles = useMemo(() => {
    if (!file || typeof navigator === 'undefined' || !navigator.canShare) return false;
    try {
      return navigator.canShare({ files: [file] });
    } catch {
      return false;
    }
  }, [file]);

  const buttons = shareButtons({ canShareFiles, isDesktop: desktop });
  const viaSheet = saveMethod({ ios, canShareFiles }) === 'sheet';

  const share = () => {
    if (!file) return;
    setMessage(null);
    // No await before this call: the share sheet must open inside the tap.
    navigator.share({ files: [file], title: item.text.title, text: shareCaption() })
      .then(() => {
        setMessage(t('studentHome.share.shared'));
        trackShare(item.kind, item.ref, 'native');
      })
      .catch((error) => setMessage(shareErrorMessage(error)));
  };

  const save = () => {
    if (!file || !preview) return;
    setMessage(null);
    if (viaSheet) {
      // iOS: a blob download can open a tab instead of saving; the sheet's «Save Image» puts it in Photos.
      navigator.share({ files: [file] })
        .then(() => {
          setMessage(t('studentHome.share.savedPhotos'));
          trackShare(item.kind, item.ref, 'download');
        })
        .catch((error) => setMessage(shareErrorMessage(error)));
      return;
    }
    const a = document.createElement('a');
    a.href = preview;
    a.download = FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setMessage(t(desktop ? 'studentHome.share.savedDownloads' : 'studentHome.share.savedGallery'));
    trackShare(item.kind, item.ref, 'download');
  };

  const ready = Boolean(file);
  const shareButton = (primary: boolean) => (
    <Button
      key="share"
      type="button"
      size={primary ? 'lg' : 'default'}
      variant={primary ? 'default' : 'outline'}
      className={primary ? 'h-12 bg-brand-solid text-base text-brand-solid-foreground hover:bg-brand-solid-hover' : ''}
      disabled={!ready}
      onClick={share}
    >
      <Share2 className={`mr-2 ${primary ? 'h-5 w-5' : 'h-4 w-4'}`} aria-hidden /> {t('studentHome.share.share')}
    </Button>
  );
  const saveButton = (primary: boolean) => (
    <Button
      key="save"
      type="button"
      size={primary ? 'lg' : 'default'}
      variant={primary ? 'default' : 'outline'}
      className={primary ? 'h-12 bg-brand-solid text-base text-brand-solid-foreground hover:bg-brand-solid-hover' : ''}
      disabled={!ready}
      onClick={save}
    >
      <Download className={`mr-2 ${primary ? 'h-5 w-5' : 'h-4 w-4'}`} aria-hidden /> {t('studentHome.share.saveImage')}
    </Button>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto rounded-3xl p-0 sm:p-0">
        <div className="grid gap-0 md:grid-cols-[minmax(0,300px)_1fr]">
          {/* Card preview */}
          <div className="flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-blue-950 p-5 md:rounded-l-3xl dark:bg-none dark:bg-brand-surface">
            <div className="relative aspect-[9/16] w-[min(168px,44vw)] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15 md:w-[260px]">
              {preview && !drawFailed ? (
                <img src={preview} alt={t('studentHome.share.cardAlt', { title: item.text.title })} className={`h-full w-full object-cover transition-opacity ${ready ? 'opacity-100' : 'opacity-60'}`} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/10 text-center text-sm text-blue-100 dark:text-brand-surface-foreground">
                  {drawFailed ? t('studentHome.share.drawFailed') : t('studentHome.share.drawing')}
                </div>
              )}
            </div>
          </div>

          {/* Options and actions */}
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <DialogTitle className="text-xl font-bold">{t('studentHome.share.title')}</DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                {t('studentHome.share.description')}
              </DialogDescription>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('studentHome.share.nameOnCard')}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('studentHome.share.nameOnCard')}>
                {nameOptions.map((o) => (
                  <button
                    key={o.mode}
                    type="button"
                    role="radio"
                    aria-checked={nameMode === o.mode}
                    onClick={() => setNameMode(o.mode)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      nameMode === o.mode
                        ? 'border-brand-solid bg-brand-solid text-brand-solid-foreground dark:border-brand-border dark:bg-brand-surface dark:text-brand-subtle-foreground'
                        : 'border-border text-gray-700 dark:text-foreground hover:border-brand/50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              {buttons.primary === 'share'
                ? [shareButton(true), saveButton(false)]
                : [saveButton(true), ...(buttons.share ? [shareButton(false)] : [])]}
              {desktop && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Laptop className="h-4 w-4 shrink-0" aria-hidden /> {desktopHint()}
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-brand-surface/80 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <AtSign className="h-4 w-4 text-brand" aria-hidden /> {tagPrompt()}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <li><span className="font-semibold text-gray-700 dark:text-foreground">Instagram</span> → {t('studentHome.share.instagramStory')}</li>
                <li><span className="font-semibold text-gray-700 dark:text-foreground">WhatsApp</span> → {t('studentHome.share.whatsappStatus')}</li>
                <li><span className="font-semibold text-gray-700 dark:text-foreground">Snapchat</span> → {t('studentHome.share.snapchatStory')}</li>
              </ul>
              {viaSheet && (
                <p className="mt-2 text-xs text-muted-foreground">{t('studentHome.share.iosSaveHint')}</p>
              )}
            </div>

            <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
