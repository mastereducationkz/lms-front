/**
 * The finale's card (owner, 2026-10-26): the Halloween story card with the person's first name,
 * and the same two ways out as «Share achievement» — the phone's share sheet (where Instagram,
 * WhatsApp and Snapchat live) and Save image. The card is drawn when the dialog opens so both
 * buttons hand the file over inside the tap (iPhones refuse a share started after an await).
 * Nothing is uploaded and nothing is counted.
 */
import { useEffect, useMemo, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { MascotConfig } from '@/components/mascot/config';
import { desktopHint, isIOSDevice, saveMethod, shareButtons, shareErrorMessage } from '@/components/share/shareCopy';
import { firstName } from '@/lib/personNames';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/seasonal';
import '@/lib/i18n/catalogs/studentHome';
import { renderHalloweenCard } from './storyCard';

const FILE_NAME = 'master-halloween-2026.png';

function isDesktop(): boolean {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

export default function CardDialog({ orca, userName, onClose }: { orca: MascotConfig; userName: string; onClose: () => void }) {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const desktop = useMemo(isDesktop, []);
  const ios = useMemo(() => typeof navigator !== 'undefined' && isIOSDevice(navigator), []);
  const name = firstName(userName) || null;
  const title = t('seasonal.halloween.card.title');
  const line = t('seasonal.halloween.card.line');
  const pill = t('seasonal.halloween.card.pill');

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    renderHalloweenCard({ orca, title, line, pill, name })
      .then((png) => {
        if (cancelled) return;
        url = URL.createObjectURL(png);
        setPreview(url);
        setFile(new File([png], FILE_NAME, { type: 'image/png' }));
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [orca, title, line, pill, name]);

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
    navigator.share({ files: [file], title })
      .then(() => setMessage(t('studentHome.share.shared')))
      .catch((error) => setMessage(shareErrorMessage(error)));
  };

  const save = () => {
    if (!file || !preview) return;
    setMessage(null);
    if (viaSheet) {
      navigator.share({ files: [file] })
        .then(() => setMessage(t('studentHome.share.savedPhotos')))
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
  };

  const ready = Boolean(file);
  const primaryClass = 'h-12 bg-brand-solid text-base text-brand-solid-foreground hover:bg-brand-solid-hover';
  const shareButton = (primary: boolean) => (
    <Button key="share" type="button" size={primary ? 'lg' : 'default'} variant={primary ? 'default' : 'outline'}
      className={primary ? primaryClass : ''} disabled={!ready} onClick={share}>
      <Share2 className={`mr-2 ${primary ? 'h-5 w-5' : 'h-4 w-4'}`} aria-hidden /> {t('studentHome.share.share')}
    </Button>
  );
  const saveButton = (primary: boolean) => (
    <Button key="save" type="button" size={primary ? 'lg' : 'default'} variant={primary ? 'default' : 'outline'}
      className={primary ? primaryClass : ''} disabled={!ready} onClick={save}>
      <Download className={`mr-2 ${primary ? 'h-5 w-5' : 'h-4 w-4'}`} aria-hidden /> {t('studentHome.share.saveImage')}
    </Button>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto rounded-3xl p-0 sm:p-0">
        <div className="grid md:grid-cols-[minmax(0,300px)_1fr]">
          <div className="flex items-center justify-center bg-[#1E1433] p-5 md:rounded-l-3xl">
            <div className="relative aspect-[9/16] w-[min(168px,44vw)] overflow-hidden rounded-2xl md:w-[260px]">
              {preview && !failed ? (
                <img src={preview} alt={t('seasonal.halloween.card.alt')} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/10 p-3 text-center text-sm text-white">
                  {failed ? t('seasonal.halloween.card.failed') : t('seasonal.halloween.card.drawing')}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <DialogTitle className="text-xl font-bold">{t('seasonal.halloween.finale.title')}</DialogTitle>
              <DialogDescription className="mt-1 text-sm">{t('seasonal.halloween.finale.body')}</DialogDescription>
            </div>
            <div className="flex flex-col gap-2">
              {buttons.primary === 'share'
                ? [shareButton(true), saveButton(false)]
                : [saveButton(true), ...(buttons.share ? [shareButton(false)] : [])]}
              {desktop && <p className="text-sm text-muted-foreground">{desktopHint()}</p>}
              {viaSheet && <p className="text-xs text-muted-foreground">{t('studentHome.share.iosSaveHint')}</p>}
            </div>
            <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
