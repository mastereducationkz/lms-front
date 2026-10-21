import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { uploadBanner } from '../../services/api/openWebinars';
import { mediaUrl } from '../../lib/mediaUrl';
import { useT } from '@/lib/i18n/react';
import '@/lib/i18n/catalogs/openWebinars';

const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  /** The stored path (`/uploads/webinar_banners/…`), or null for no banner. */
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/**
 * The poster of a public webinar: upload, see it, remove it. The file is uploaded at once; it belongs to the
 * webinar only when the form's Save sends its path (`banner_url`), and «Remove» sends `null`.
 */
export default function BannerField({ value, onChange, disabled = false }: Props) {
  const t = useT();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const src = mediaUrl(value);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // The same limits the server enforces, so a doomed upload never leaves the browser.
    if (!TYPES.includes(file.type)) { setError(t('openWebinars.admin.banner.badType')); return; }
    if (file.size > MAX_BYTES) { setError(t('openWebinars.admin.banner.tooBig')); return; }
    setBusy(true);
    try {
      onChange((await uploadBanner(file)).url);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : t('openWebinars.error.generic'));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="ow-banner">{t('openWebinars.admin.banner.label')}</Label>
      {src && <img src={src} alt={t('openWebinars.admin.banner.alt')} data-banner-preview className="max-h-64 w-auto max-w-full rounded-lg border border-border object-contain" />}
      <div className="flex flex-wrap items-center gap-2">
        <input id="ow-banner" ref={input} type="file" accept={TYPES.join(',')} className="sr-only" disabled={disabled || busy}
               onChange={(e) => void pick(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" disabled={disabled || busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden />}
          {busy ? t('openWebinars.admin.banner.uploading') : t(value ? 'openWebinars.admin.banner.replace' : 'openWebinars.admin.banner.upload')}
        </Button>
        {value && <Button type="button" variant="ghost" size="sm" disabled={disabled || busy} onClick={() => { setError(null); onChange(null); }}>{t('openWebinars.admin.banner.remove')}</Button>}
      </div>
      <p className="text-xs text-muted-foreground">{t('openWebinars.admin.banner.hint')}</p>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
