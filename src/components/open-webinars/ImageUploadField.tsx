import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, UserRound } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { mediaUrl } from '../../lib/mediaUrl';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  /** `banner`: a wide poster shown whole. `photo`: a round portrait. Picks the copy (`openWebinars.admin.<kind>.*`), the preview and its `data-<kind>-preview` mark. */
  kind: 'banner' | 'photo';
  id: string;
  /** The stored path (`/uploads/…`) or, for an older record, an absolute URL; null for no picture. */
  value: string | null;
  onChange: (url: string | null) => void;
  /** Sends the file and answers with its stable relative path. */
  upload: (file: File) => Promise<{ url: string }>;
  disabled?: boolean;
  /** Tells the form around it that a file is on its way, so it can hold its own Save until the path is known. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * A picture of a public webinar page: upload, see it, replace it, remove it. The file is uploaded at once; it belongs
 * to the record only when the form's Save sends its path, and «Remove» sends `null`.
 */
export default function ImageUploadField({ kind, id, value, onChange, upload, disabled = false, onBusyChange }: Props) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = mediaUrl(value);
  const previewMark = { [`data-${kind}-preview`]: true };

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // The same limits the server enforces, so a doomed upload never leaves the browser.
    if (!TYPES.includes(file.type)) { setError(t(`openWebinars.admin.${kind}.badType`)); return; }
    if (file.size > MAX_BYTES) { setError(t(`openWebinars.admin.${kind}.tooBig`)); return; }
    setBusy(true);
    try {
      const { url } = await upload(file);
      // The form may have moved on to another record while the file travelled; its picture is not this one.
      if (mounted.current) onChange(url);
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : t('openWebinars.error.generic'));
    } finally {
      if (mounted.current) setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{t(`openWebinars.admin.${kind}.label`)}</Label>
      {kind === 'banner' ? (
        src && <img src={src} alt={t('openWebinars.admin.banner.alt')} {...previewMark} className="max-h-64 w-auto max-w-full rounded-lg border border-border object-contain" />
      ) : src ? (
        <img src={src} alt={t('openWebinars.admin.photo.alt')} {...previewMark} className="h-24 w-24 rounded-full border border-border object-cover" />
      ) : (
        <span className="flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-border bg-muted/50 text-muted-foreground"><UserRound className="h-8 w-8" aria-hidden /></span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} ref={input} type="file" accept={TYPES.join(',')} className="sr-only" disabled={disabled || busy}
               onChange={(e) => void pick(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden />}
          {busy ? t(`openWebinars.admin.${kind}.uploading`) : t(value ? `openWebinars.admin.${kind}.replace` : `openWebinars.admin.${kind}.upload`)}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} onClick={() => { setError(null); onChange(null); }}>{t(`openWebinars.admin.${kind}.remove`)}</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{t(`openWebinars.admin.${kind}.hint`)}</p>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
