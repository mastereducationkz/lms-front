import { useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiErrorCode } from '../../services/api/classMaterials';
import { errorMessage, isGoogleShareLink, t, validateLinkUrl, type Locale } from '../../lib/classMaterials';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
  onSubmit: (link: { url: string; title?: string }) => Promise<void>;
}

/**
 * The «Ссылка» add-menu entry (§8.1, D9): a URL and an optional title. `validateLinkUrl` runs
 * on blur and on submit — the same http(s)-only rule the backend enforces — and a Google
 * Docs/Drive host shows the sharing warning without blocking the submit.
 */
export default function LinkDialog({ open, onOpenChange, locale, onSubmit }: Props) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setUrl('');
    setTitle('');
    setUrlError(null);
  };

  const validate = () => {
    const code = validateLinkUrl(url);
    setUrlError(code ? t(code, locale) : null);
    return !code;
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await onSubmit({ url: url.trim(), title: title.trim() || undefined });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(apiErrorCode(err), locale));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('link', locale)}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="class-material-link-url">{t('linkUrl', locale)}</Label>
            <Input
              id="class-material-link-url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              onBlur={validate}
              placeholder="https://…"
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            {!urlError && isGoogleShareLink(url) && (
              <p className="text-xs text-amber-600 dark:text-amber-500">{t('googleWarning', locale)}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="class-material-link-title">{t('linkTitle', locale)}</Label>
            <Input id="class-material-link-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('cancel', locale)}
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={submitting || !url}>
            {t('save', locale)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
