/**
 * «Share achievement» dialog (SH1–SH8): the student's story card, the name option, and the ways
 * out — the phone's share sheet (Instagram, Snapchat and WhatsApp live there), Download, Copy
 * link, and on a computer a QR code to finish on the phone.
 *
 * The card is drawn the moment the dialog opens, so «Share» hands the file to the share sheet
 * synchronously inside the tap — iPhones refuse a share that starts after an await (the SAT
 * platform's bug). A link is a snapshot, made once per name option and only when first needed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AtSign, Check, Download, Link2, QrCode, Share2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/Toast';
import { createShare, revokeShare, trackShare, type ShareLink } from '@/services/api/shares';
import { renderShareCard } from './renderShareCard';
import { formatShareName, primaryAction, SHARE_CAPTION, shareErrorMessage, TAG_PROMPT, type NameMode, type ShareMethod } from './shareCopy';
import type { ShareItem } from './shareItems';

const FILE_NAME = 'master-education.png';
const EXPIRY = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

function isDesktop(): boolean {
  try {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

export default function ShareDialog({ item, onClose }: { item: ShareItem; onClose: () => void }) {
  const [nameMode, setNameMode] = useState<NameMode>('short');
  const [file, setFile] = useState<File | null>(null);
  const [linkImage, setLinkImage] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [drawFailed, setDrawFailed] = useState(false);
  const [linkByMode, setLinkByMode] = useState<Partial<Record<NameMode, ShareLink>>>({});
  const [qr, setQr] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<ShareMethod | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);
  const links = useRef<Partial<Record<NameMode, Promise<ShareLink>>>>({});
  const tracked = useRef<Set<string>>(new Set());
  const desktop = useMemo(isDesktop, []);
  const link = linkByMode[nameMode] ?? null;
  const setLink = useCallback((l: ShareLink) => setLinkByMode((m) => ({ ...m, [nameMode]: l })), [nameMode]);

  const short = formatShareName(item.userName, 'short');
  const full = formatShareName(item.userName, 'full');
  const nameOptions: { mode: NameMode; label: string }[] = [
    ...(short ? [{ mode: 'short' as const, label: short }] : []),
    ...(full && full !== short ? [{ mode: 'full' as const, label: full }] : []),
    { mode: 'none', label: 'No name' },
  ];

  // Draw the card (again when the name option changes).
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setFile(null);
    setDrawFailed(false);
    renderShareCard({ text: item.text, name: formatShareName(item.userName, nameMode), orca: item.orca, crown: item.crown })
      .then(({ png, jpeg }) => {
        if (cancelled) return;
        url = URL.createObjectURL(png);
        setPreview(url);
        setFile(new File([png], FILE_NAME, { type: 'image/png' }));
        setLinkImage(jpeg);
      })
      .catch(() => { if (!cancelled) setDrawFailed(true); });
    setQr(null);
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

  /** The snapshot link for the current name option — created once, on first need. */
  const ensureLink = useCallback((): Promise<ShareLink> => {
    if (!file || !linkImage) return Promise.reject(new Error('The card is still being drawn'));
    const existing = links.current[nameMode];
    if (existing) return existing;
    const made = createShare({ kind: item.kind, ref: item.ref, nameMode, image: linkImage }).then((l) => {
      setLink(l);
      return l;
    });
    made.catch(() => { delete links.current[nameMode]; });
    links.current[nameMode] = made;
    return made;
  }, [file, linkImage, item.kind, item.ref, nameMode, setLink]);

  const count = useCallback((method: ShareMethod) => {
    ensureLink().then((l) => {
      const key = `${l.slug}:${method}`;
      if (method !== 'qr' || !tracked.current.has(key)) trackShare(l.slug, method);
      tracked.current.add(key);
    }).catch(() => undefined);
  }, [ensureLink]);

  const share = () => {
    if (!file) return;
    setMessage(null);
    // No await before this call: the share sheet must open inside the tap.
    navigator.share({ files: [file], title: item.text.title, text: SHARE_CAPTION })
      .then(() => {
        setMessage('Shared! Tag @master.education so we can see it.');
        count('native');
      })
      .catch((error) => setMessage(shareErrorMessage(error)));
  };

  const download = () => {
    if (!file || !preview) return;
    const a = document.createElement('a');
    a.href = preview;
    a.download = FILE_NAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setMessage('Saved. Post it from your gallery as a story.');
    count('download');
  };

  const copy = async () => {
    setMessage(null);
    setBusy('copy');
    const urlBlob = ensureLink().then((l) => new Blob([l.url], { type: 'text/plain' }));
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        // A promised clipboard item keeps the tap's permission while the link is being made.
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': urlBlob })]);
      } else {
        const l = await ensureLink();
        await navigator.clipboard.writeText(l.url);
      }
      toast('Link copied — paste it anywhere.', 'success');
      count('copy');
    } catch (error) {
      const failed = await urlBlob.then(() => null, (e: Error) => e);
      setMessage(failed ? failed.message : 'Couldn’t copy automatically — select the link below and copy it.');
    } finally {
      setBusy(null);
    }
  };

  const showQr = async () => {
    setMessage(null);
    setBusy('qr');
    try {
      const l = await ensureLink();
      setQr(await QRCode.toDataURL(l.url, { margin: 1, width: 232, errorCorrectionLevel: 'M', color: { dark: '#0B1B4D', light: '#FFFFFF' } }));
      count('qr');
    } catch (error) {
      setMessage((error as Error).message || 'Couldn’t make the QR code.');
    } finally {
      setBusy(null);
    }
  };

  const turnOff = async () => {
    if (!link) return;
    if (!confirmOff) {
      setConfirmOff(true);
      return;
    }
    try {
      const off = await revokeShare(link.slug);
      setLink(off);
      setQr(null);
      delete links.current[nameMode];
      setConfirmOff(false);
      setMessage('Link turned off. Nobody can open it now.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const ready = Boolean(file);
  const showShare = primaryAction({ canShareFiles, isDesktop: desktop }) === 'share';
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[94vh] max-w-3xl overflow-y-auto rounded-3xl p-0 sm:p-0">
        <div className="grid gap-0 md:grid-cols-[minmax(0,300px)_1fr]">
          {/* Card preview */}
          <div className="flex items-center justify-center bg-gradient-to-br from-[#1E3A8A] via-[#1D4ED8] to-[#172554] p-5 md:rounded-l-3xl">
            <div className="relative aspect-[9/16] w-[min(168px,44vw)] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/15 md:w-[260px]">
              {preview && !drawFailed ? (
                <img src={preview} alt={`Story card: ${item.text.title}`} className={`h-full w-full object-cover transition-opacity ${ready ? 'opacity-100' : 'opacity-60'}`} />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/10 text-center text-sm text-blue-100">
                  {drawFailed ? 'We couldn’t draw your card. Close and try again.' : 'Drawing your card…'}
                </div>
              )}
            </div>
          </div>

          {/* Options and actions */}
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <DialogTitle className="text-xl font-bold">Share your moment</DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                Post this card to your Instagram story, Snapchat or WhatsApp status.
              </DialogDescription>
            </div>

            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name on the card</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Name on the card">
                {nameOptions.map((o) => (
                  <button
                    key={o.mode}
                    type="button"
                    role="radio"
                    aria-checked={nameMode === o.mode}
                    onClick={() => setNameMode(o.mode)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      nameMode === o.mode
                        ? 'border-[#2563EB] bg-[#2563EB] text-white'
                        : 'border-gray-200 dark:border-border text-gray-700 dark:text-gray-200 hover:border-[#2563EB]/50'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2">
              {showShare ? (
                <Button type="button" size="lg" className="h-12 bg-[#2563EB] text-base text-white hover:bg-[#1D4ED8]" disabled={!ready} onClick={share}>
                  <Share2 className="mr-2 h-5 w-5" aria-hidden /> Share
                </Button>
              ) : (
                <Button type="button" size="lg" className="h-12 bg-[#2563EB] text-base text-white hover:bg-[#1D4ED8]" disabled={!ready} onClick={download}>
                  <Download className="mr-2 h-5 w-5" aria-hidden /> Download image
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                {showShare && (
                  <Button type="button" variant="outline" disabled={!ready} onClick={download}>
                    <Download className="mr-2 h-4 w-4" aria-hidden /> Download
                  </Button>
                )}
                <Button type="button" variant="outline" disabled={!ready || busy === 'copy'} onClick={copy} className={showShare ? '' : 'col-span-2'}>
                  <Link2 className="mr-2 h-4 w-4" aria-hidden /> {busy === 'copy' ? 'Making the link…' : 'Copy link'}
                </Button>
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                <AtSign className="h-4 w-4 text-[#2563EB]" aria-hidden /> {TAG_PROMPT}
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <li><span className="font-semibold text-gray-700 dark:text-gray-200">Instagram</span> → Your story</li>
                <li><span className="font-semibold text-gray-700 dark:text-gray-200">WhatsApp</span> → My status</li>
                <li><span className="font-semibold text-gray-700 dark:text-gray-200">Snapchat</span> → My Story</li>
              </ul>
            </div>

            {desktop && (
              <div className="flex items-center gap-4 rounded-2xl border border-gray-200 dark:border-border p-3">
                {qr ? (
                  <img src={qr} alt="QR code for your share link" width={116} height={116} className="rounded-lg" />
                ) : (
                  <span className="flex h-[116px] w-[116px] shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-900">
                    <Smartphone className="h-8 w-8 text-gray-400" aria-hidden />
                  </span>
                )}
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-gray-900 dark:text-white">On your phone?</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {qr ? 'Scan it with your phone camera, then tap «Share to your story».' : 'Get a QR code and post it to your story from your phone.'}
                  </p>
                  {!qr && (
                    <Button type="button" variant="outline" size="sm" className="mt-2" disabled={!ready || busy === 'qr'} onClick={showQr}>
                      <QrCode className="mr-2 h-4 w-4" aria-hidden /> {busy === 'qr' ? 'Making the link…' : 'Show QR code'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {link && (
              <div className="rounded-2xl border border-gray-200 dark:border-border p-3 text-xs">
                {link.live ? (
                  <>
                    <p className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                      <Check className="h-3.5 w-3.5" aria-hidden /> Link ready · works until {EXPIRY.format(new Date(link.expires_at))}
                    </p>
                    <input
                      readOnly
                      value={link.url}
                      onFocus={(e) => e.currentTarget.select()}
                      className="mt-2 w-full rounded-lg border border-gray-200 dark:border-border bg-gray-50 dark:bg-gray-900 px-2 py-1.5 text-xs"
                      aria-label="Share link"
                    />
                    <button type="button" onClick={turnOff} className="mt-2 font-medium text-gray-500 underline-offset-2 hover:text-red-600 hover:underline">
                      {confirmOff ? 'Tap again to turn the link off' : 'Turn off this link'}
                    </button>
                  </>
                ) : (
                  <p className="text-muted-foreground">This link is turned off. Copy a new one any time.</p>
                )}
              </div>
            )}

            <p role="status" aria-live="polite" className="min-h-[1.25rem] text-sm text-gray-600 dark:text-gray-300">{message}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
