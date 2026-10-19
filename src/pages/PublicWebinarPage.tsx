import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, Loader2, Mic2, PlayCircle, Video } from 'lucide-react';
import { Button } from '../components/ui/button';
import PublicShell from '../components/open-webinars/PublicShell';
import ContactForm from '../components/open-webinars/ContactForm';
import ConsultationCard from '../components/open-webinars/ConsultationCard';
import { countdownText, useCountdown } from '../components/open-webinars/useCountdown';
import { getPublicWebinar, PublicApiError, registerForWebinar, type PublicWebinar } from '../services/api/publicWebinars';
import { formatDate, formatTime } from '../lib/i18n/format';
import { usePublicLocale } from '../lib/publicLocale';
import { captureAttribution } from '../lib/utm';
import '@/lib/i18n/catalogs/openWebinars';

type State = { kind: 'loading' } | { kind: 'ready'; data: PublicWebinar } | { kind: 'missing' } | { kind: 'cancelled' } | { kind: 'error' };

/** How often the page re-asks, so «starts in …» turns into the join button without a reload. */
const REFRESH_MS = 30_000;

/**
 * A webinar anyone can open (`/w/:slug`): what it is, who speaks, when — and either the register form
 * (webinars with registration) or the join button (open-link webinars). No login.
 */
export default function PublicWebinarPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { locale, setLocale, t } = usePublicLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', data: await getPublicWebinar(slug) });
    } catch (failure) {
      setState((now) => (now.kind === 'ready' ? now : failure instanceof PublicApiError && failure.status === 404 ? { kind: 'missing' } : failure instanceof PublicApiError && failure.status === 410 ? { kind: 'cancelled' } : { kind: 'error' }));
    }
  }, [slug]);

  // Where the visitor came from is read the moment they land, so it survives anything the page does next.
  useEffect(() => { captureAttribution(); }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const data = state.kind === 'ready' ? state.data : null;
  const untilStart = useCountdown(data?.starts_at);

  return (
    <PublicShell locale={locale} setLocale={setLocale} t={t}>
      {state.kind === 'loading' && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-16 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('openWebinars.loading')}
        </div>
      )}
      {state.kind === 'missing' && <p className="rounded-2xl border border-border bg-card px-6 py-12 text-sm text-foreground shadow-sm">{t('openWebinars.notFound')}</p>}
      {state.kind === 'cancelled' && <p role="status" className="rounded-2xl border border-border bg-card px-6 py-12 text-sm text-foreground shadow-sm">{t('openWebinars.cancelled')}</p>}
      {state.kind === 'error' && (
        <div className="space-y-3 rounded-2xl border border-border bg-card px-6 py-12 text-sm shadow-sm">
          <p>{t('openWebinars.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => { setState({ kind: 'loading' }); void load(); }}>{t('openWebinars.retry')}</Button>
        </div>
      )}
      {data && (
        <div className="space-y-5">
          <article className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">{data.title}</h1>
            <p className="mt-3 flex items-center gap-2 text-sm text-foreground">
              <CalendarClock className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
              <span>
                {t('openWebinars.when', {
                  date: formatDate(data.starts_at, { weekday: 'long', day: 'numeric', month: 'long' }, locale),
                  start: formatTime(data.starts_at, undefined, locale),
                  end: formatTime(data.ends_at, undefined, locale),
                })}{' '}
                <span className="text-muted-foreground">· {t('openWebinars.timeNote')}</span>
              </span>
            </p>
            {data.speaker && (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-muted/50 p-3" data-speaker>
                {data.speaker.photo_url ? (
                  <img src={data.speaker.photo_url} alt="" className="h-12 w-12 flex-none rounded-full object-cover" />
                ) : (
                  <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-primary/10 text-primary"><Mic2 className="h-5 w-5" aria-hidden /></span>
                )}
                <div className="min-w-0 text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('openWebinars.speaker')}</p>
                  <p className="font-semibold text-foreground">{data.speaker.name}{data.speaker.organisation ? `, ${data.speaker.organisation}` : ''}</p>
                  {data.speaker.bio && <p className="mt-0.5 text-muted-foreground">{data.speaker.bio}</p>}
                </div>
              </div>
            )}
            {data.description && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground">{data.description}</p>}
          </article>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7" aria-live="polite">
            {data.state === 'upcoming' && (
              <p className="mb-4 text-sm text-muted-foreground">
                {t('openWebinars.state.upcoming')}: <strong className="text-foreground">{countdownText(untilStart, t)}</strong>
              </p>
            )}
            {data.state === 'live' && <p className="mb-4 text-sm font-semibold text-green-700 dark:text-green-400">{t('openWebinars.state.live')}</p>}
            {data.state === 'ended' && <p className="mb-4 text-sm text-muted-foreground">{t('openWebinars.state.ended')}</p>}

            {data.registration_open && (data.consent.policy_ready ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-foreground">{t('openWebinars.form.title')}</h2>
                <ContactForm
                  t={t}
                  withEmail
                  consentText={locale === 'ru' ? data.consent.text_ru : data.consent.text_en}
                  submitLabel={t('openWebinars.form.submit')}
                  onSubmit={async (body) => {
                    const done = await registerForWebinar(data.slug, body);
                    navigate(done.join_path);
                  }}
                />
              </>
            ) : <p className="text-sm text-muted-foreground">{t('openWebinars.form.noPolicy')}</p>)}

            {data.access_mode === 'open' && data.state !== 'ended' && (
              data.join_url ? (
                <div className="space-y-2">
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <a href={data.join_url} target="_blank" rel="noopener noreferrer"><Video className="mr-2 h-4 w-4" aria-hidden />{t('openWebinars.join.button')}</a>
                  </Button>
                  <p className="text-xs text-muted-foreground">{t('openWebinars.join.opens')}</p>
                </div>
              ) : <p className="text-sm text-muted-foreground">{t(data.state === 'live' ? 'openWebinars.join.preparing' : 'openWebinars.join.opensAt')}</p>
            )}

            {data.state === 'ended' && data.recording_slug && (
              <Button asChild size="lg" className="mt-1 w-full sm:w-auto">
                <Link to={`/r/${data.recording_slug}`}><PlayCircle className="mr-2 h-4 w-4" aria-hidden />{t('openWebinars.recording.watch')}</Link>
              </Button>
            )}
          </section>

          {(data.access_mode === 'open' || data.state === 'ended') && (
            <ConsultationCard t={t} locale={locale} webinarSlug={data.slug} consent={data.consent} />
          )}
        </div>
      )}
    </PublicShell>
  );
}
