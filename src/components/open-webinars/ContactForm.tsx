import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { PublicApiError, type ContactBody } from '../../services/api/publicWebinars';
import { captureAttribution } from '../../lib/utm';
import { hasMessage, type TFunction } from '../../lib/i18n/translate';
import { Link } from 'react-router-dom';
import '@/lib/i18n/catalogs/openWebinars';

interface Props {
  t: TFunction;
  /** A seat needs an e-mail (the link and reminders go there); a call-back request does not. */
  withEmail: boolean;
  consentText: string;
  submitLabel: string;
  onSubmit: (body: ContactBody) => Promise<void>;
}

/** What went wrong, in the visitor's language: the backend's stable code when the catalog knows it. */
export function errorText(error: unknown, t: TFunction): string {
  if (error instanceof PublicApiError) {
    if (error.code === 'network') return t('openWebinars.error.network');
    const key = `openWebinars.error.${error.code}`;
    if (error.code && hasMessage(key)) return t(key);
  }
  return t('openWebinars.error.generic');
}

/** Name, phone, (e-mail), consent. Used for a seat at a webinar and for «leave your number». */
export default function ContactForm({ t, withEmail, consentText, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!consent) {
      setError(t('openWebinars.error.consent_required'));
      return;
    }
    setBusy(true);
    setError(null);
    const { utm, referer } = captureAttribution();
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined, consent, utm, referer, ow_extra: trap });
    } catch (failure) {
      setError(errorText(failure, t));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="ow-name">{t('openWebinars.form.name')}</Label>
        <Input id="ow-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={120} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ow-phone">{t('openWebinars.form.phone')}</Label>
        <Input id="ow-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+7 700 000 00 00" required />
      </div>
      {withEmail && (
        <div className="space-y-1.5">
          <Label htmlFor="ow-email">{t('openWebinars.form.email')}</Label>
          <Input id="ow-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          <p className="text-xs text-muted-foreground">{t('openWebinars.form.emailHint')}</p>
        </div>
      )}
      {/* A person never sees this field; a bot fills every field it finds. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <input name="ow_extra" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
      </div>
      <div className="flex items-start gap-2.5">
        <Checkbox id="ow-consent" checked={consent} onCheckedChange={(next) => setConsent(next === true)} className="mt-0.5" />
        <Label htmlFor="ow-consent" className="text-xs font-normal leading-relaxed text-muted-foreground">
          {consentText}{' '}
          <Link to="/privacy" target="_blank" className="underline underline-offset-4">{t('openWebinars.form.privacy')}</Link>
        </Label>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />{t('openWebinars.form.sending')}</>) : submitLabel}
      </Button>
    </form>
  );
}
