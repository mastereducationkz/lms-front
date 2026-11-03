import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Gift, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';
import PublicShell from '../components/open-webinars/PublicShell';
import { usePageTitle } from '../components/open-webinars/usePageTitle';
import SignupForm from '../components/trial-links/public/SignupForm';
import SignupResult from '../components/trial-links/public/SignupResult';
import { visitorKey } from '../components/trial-links/public/visitorKey';
import { useAuth } from '../contexts/AuthContext';
import { PublicApiError } from '../services/api/publicWebinars';
import {
  getTrialLink, recordTrialLinkOpen, signUpForTrial, type PublicTrialLink, type SignupBody, type SignupResult as Result,
} from '../services/api/trialLinks';
import { usePublicLocale } from '../lib/publicLocale';
import { captureAttribution } from '../lib/utm';
import '@/lib/i18n/catalogs/openWebinars';
import '@/lib/i18n/catalogs/trialLinks';

type PageState = { kind: 'loading' } | { kind: 'ready'; link: PublicTrialLink } | { kind: 'missing' } | { kind: 'error' };

/** How often the page re-reads the link while the form is open: a presentation that starts shows up as a one-tap school. */
const REFRESH_MS = 60_000;

/**
 * The page behind the QR code on a presentation slide (`/t/:code`, no login): one screen of questions, then the new
 * account's login and password, already signed in. Owner, 2026-11-03.
 */
export default function TrialSignupPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { locale, setLocale, t } = usePublicLocale();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [result, setResult] = useState<Result | null>(null);
  const [signIn, setSignIn] = useState<'pending' | 'done' | 'failed'>('pending');
  usePageTitle(t('trialLinks.public.badge'));

  const load = useCallback(async () => {
    try {
      const link = await getTrialLink(code);
      setState({ kind: 'ready', link });
    } catch (failure) {
      setState((now) => {
        if (failure instanceof PublicApiError && failure.status === 404) return { kind: 'missing' };
        return now.kind === 'ready' ? now : { kind: 'error' };
      });
    }
  }, [code]);

  useEffect(() => {
    captureAttribution();
    void load();
    // A scan counts once per visitor; a failure here never touches the page.
    recordTrialLinkOpen(code, visitorKey()).catch(() => undefined);
  }, [code, load]);

  useEffect(() => {
    if (result) return undefined;
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load, result]);

  const submit = async (body: SignupBody) => {
    const out = await signUpForTrial(code, body);
    setResult(out);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (out.outcome === 'created' && out.email && out.password) {
      setSignIn('pending');
      const signed = await login(out.email, out.password);
      setSignIn(signed.success ? 'done' : 'failed');
    }
  };

  const link = state.kind === 'ready' ? state.link : null;

  return (
    <PublicShell locale={locale} setLocale={setLocale} t={t}>
      <div className="mx-auto w-full max-w-xl">
        {state.kind === 'loading' && (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-16 text-sm text-muted-foreground shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('trialLinks.public.loading')}
          </div>
        )}
        {state.kind === 'missing' && (
          <p className="rounded-2xl border border-border bg-card px-6 py-12 text-sm text-foreground shadow-sm">{t('trialLinks.public.notFound')}</p>
        )}
        {state.kind === 'error' && (
          <div className="space-y-3 rounded-2xl border border-border bg-card px-6 py-12 text-sm shadow-sm">
            <p>{t('trialLinks.public.loadFailed')}</p>
            <Button variant="outline" size="sm" onClick={() => { setState({ kind: 'loading' }); void load(); }}>{t('trialLinks.public.retry')}</Button>
          </div>
        )}

        {link && result && (
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <SignupResult t={t} locale={locale} result={result} signIn={signIn} onStart={() => navigate('/dashboard', { replace: true })} />
          </section>
        )}

        {link && !result && (
          <>
            <header className="mb-5 space-y-3 px-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> {t('trialLinks.public.badge')}
              </span>
              <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
                {t('trialLinks.public.title', { count: link.days })}
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">{t('trialLinks.public.subtitle')}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-xs font-medium text-foreground/80">
                <li className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5 text-primary" aria-hidden />{t('trialLinks.public.point.lessons')}</li>
                <li className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-primary" aria-hidden />{t('trialLinks.public.point.instant')}</li>
                <li className="flex items-center gap-1.5"><Gift className="h-3.5 w-3.5 text-primary" aria-hidden />{t('trialLinks.public.point.free')}</li>
              </ul>
            </header>
            <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
              {link.open ? (
                <SignupForm t={t} locale={locale} link={link} onSubmit={submit} />
              ) : (
                <div className="space-y-2 py-6 text-center">
                  <p className="text-base font-medium text-foreground">{t(`trialLinks.public.closed.${link.closed_reason ?? 'signups_closed'}`)}</p>
                  <p className="text-sm text-muted-foreground">{t('trialLinks.public.closed.contact')}</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PublicShell>
  );
}
