import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Check, Copy, KeyRound, Loader2, PartyPopper, UserCheck } from 'lucide-react';
import { Button } from '../../ui/button';
import { formatDateTime } from '../../../lib/i18n/format';
import type { Locale } from '../../../lib/i18n/locale';
import type { TFunction } from '../../../lib/i18n/translate';
import type { SignupResult as Result } from '../../../services/api/trialLinks';
import '@/lib/i18n/catalogs/trialLinks';

function CopyRow({ t, label, value, mono }: { t: TFunction; label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* no clipboard (an old browser, an iframe): the value is on screen to type */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-background px-4 py-3">
      <div className="min-w-0">
        <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`truncate text-lg font-semibold text-foreground ${mono ? 'font-mono tracking-wider' : ''}`}>{value}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0">
        {copied ? <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden /> : <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
        {copied ? t('trialLinks.done.copied') : t('trialLinks.done.copy')}
      </Button>
    </div>
  );
}

interface Props {
  t: TFunction;
  locale: Locale;
  result: Result;
  /** `created` only: whether the automatic sign-in is still running, worked, or failed. */
  signIn: 'pending' | 'done' | 'failed';
  onStart: () => void;
}

/** What the student sees after the button: their credentials (a new account) or where to sign in (everyone else). */
export default function SignupResult({ t, locale, result, signIn, onStart }: Props) {
  if (result.outcome === 'created' && result.password) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <PartyPopper className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('trialLinks.done.title')}</h2>
            {result.expires_at && (
              <p className="text-sm text-muted-foreground">{t('trialLinks.done.until', { date: formatDateTime(result.expires_at, undefined, locale) })}</p>
            )}
          </div>
        </div>
        {result.courses && result.courses.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('trialLinks.done.courses')}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.courses.map((c) => (
                <span key={c} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{c}</span>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-3">
          <CopyRow t={t} label={t('trialLinks.done.login')} value={result.email ?? ''} />
          <CopyRow t={t} label={t('trialLinks.done.password')} value={result.password} mono />
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <Camera className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {t('trialLinks.done.screenshot', { email: result.email ?? '' })}
        </p>
        {signIn === 'failed' ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">{t('trialLinks.done.signInFailed')}</p>
            <Button asChild size="lg" className="h-12 w-full text-base"><Link to="/login?method=password">{t('trialLinks.done.goSignIn')}</Link></Button>
          </div>
        ) : (
          <Button type="button" size="lg" className="h-12 w-full text-base font-semibold" onClick={onStart} disabled={signIn === 'pending'}>
            {signIn === 'pending' ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />{t('trialLinks.done.signingIn')}</>) : t('trialLinks.done.start')}
          </Button>
        )}
      </div>
    );
  }

  const copy = result.outcome === 'already_student'
    ? { icon: UserCheck, title: t('trialLinks.student.title'), body: t('trialLinks.student.body') }
    : result.outcome === 'phone_registered'
      ? { icon: KeyRound, title: t('trialLinks.phone.title'), body: t('trialLinks.phone.body', { email: result.masked_email ?? '' }) }
      : { icon: KeyRound, title: t('trialLinks.existing.title'), body: t('trialLinks.existing.body', { email: result.email ?? '' }) };
  const Icon = copy.icon;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h2 className="text-xl font-bold text-foreground">{copy.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
        </div>
      </div>
      <Button asChild size="lg" className="h-12 w-full text-base"><Link to="/login?method=password">{t('trialLinks.existing.signIn')}</Link></Button>
      <Link to="/forgot-password" className="block text-center text-sm text-primary underline-offset-4 hover:underline">
        {t('trialLinks.existing.forgot')}
      </Link>
    </div>
  );
}
