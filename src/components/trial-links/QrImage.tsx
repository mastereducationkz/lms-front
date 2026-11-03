import { useEffect, useState } from 'react';
import { Download, Loader2, Maximize2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog';
import { toast } from '../Toast';
import { useT } from '../../lib/i18n/react';
import { downloadBlob, qrPng, qrSvg } from './qr';
import '@/lib/i18n/catalogs/trialLinks';

/** The address as people read it from a slide: no scheme. */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, '');

function useQrDataUrl(url: string) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    qrSvg(url, 640)
      .then((svg) => { if (!cancelled) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url]);
  return { src, failed };
}

/** A big, projector-friendly view: the code and the address under it, nothing else. */
export function QrFullscreen({ url, open, onOpenChange, title }: { url: string; open: boolean; onOpenChange: (v: boolean) => void; title: string }) {
  const { src } = useQrDataUrl(url);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(92vw,44rem)] bg-white p-8 text-black">
        <DialogTitle className="text-center text-2xl font-bold text-black">{title}</DialogTitle>
        {src && <img src={src} alt="" className="mx-auto aspect-square w-full max-w-[34rem]" />}
        <p className="text-center font-mono text-2xl font-semibold tracking-wide text-black">{displayUrl(url)}</p>
      </DialogContent>
    </Dialog>
  );
}

export default function QrImage({ url, code, title }: { url: string; code: string; title: string }) {
  const t = useT();
  const { src, failed } = useQrDataUrl(url);
  const [busy, setBusy] = useState<'png' | 'svg' | null>(null);
  const [full, setFull] = useState(false);

  const save = async (kind: 'png' | 'svg') => {
    setBusy(kind);
    try {
      const blob = kind === 'png' ? await qrPng(url, 2048) : new Blob([await qrSvg(url, 2048)], { type: 'image/svg+xml' });
      downloadBlob(blob, `master-education-qr-${code.toLowerCase()}.${kind}`);
    } catch {
      toast(t('trialLinks.links.qrFailed'), 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex aspect-square w-44 items-center justify-center rounded-xl border border-border bg-white p-1.5">
        {src ? <img src={src} alt="" className="h-full w-full" />
          : failed ? <span className="px-3 text-center text-xs text-red-600">{t('trialLinks.links.qrFailed')}</span>
            : <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5">
        {(['png', 'svg'] as const).map((kind) => (
          <Button key={kind} variant="outline" size="sm" onClick={() => save(kind)} disabled={busy !== null}>
            {busy === kind ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
            {t(kind === 'png' ? 'trialLinks.links.png' : 'trialLinks.links.svg')}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={() => setFull(true)}>
          <Maximize2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />{t('trialLinks.links.fullscreen')}
        </Button>
      </div>
      <QrFullscreen url={url} open={full} onOpenChange={setFull} title={title} />
    </div>
  );
}
