import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, Loader2, PlayCircle, Video } from 'lucide-react';
import { Button } from '../components/ui/button';
import PublicShell from '../components/open-webinars/PublicShell';
import ContactForm from '../components/open-webinars/ContactForm';
import ConsultationCard from '../components/open-webinars/ConsultationCard';
import PresenterBlock from '../components/open-webinars/PresenterBlock';
import { countdownText, useCountdown } from '../components/open-webinars/useCountdown';
import { usePublicPage } from '../components/open-webinars/usePublicPage';
import { getPublicWebinar, registerForWebinar } from '../services/api/publicWebinars';
import { formatDate, formatTime } from '../lib/i18n/format';
import { mediaUrl } from '../lib/mediaUrl';
import { usePublicLocale } from '../lib/publicLocale';
import { captureAttribution } from '../lib/utm';
import '@/lib/i18n/catalogs/openWebinars';

/** How often the page re-asks while the webinar is not over, so «starts in …» turns into the join button without a reload. */
const REFRESH_MS = 30_000;

/**
 * A webinar anyone can open (`/w/:slug`): what it is, who speaks, when — and either the register form
 * (webinars with registration) or the join button (open-link webinars). No login.
 */
export default function PublicWebinarPage() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();
  const { locale, setLocale, t } = usePublicLocale();
  const { state, retry } = usePublicPage(slug, getPublicWebinar, REFRESH_MS);
  // A phone that is already registered gets no personal link back (nobody may open another person's page by typing
  // their number): the server re-sends it to the e-mail on file, and this is all the page can say.
  const [sentToEmail, setSentToEmail] = useState(false);

  // Where the visitor came from is read the moment they land, so it survives anything the page does next.
  useEffect(() => { captureAttribution(); }, []);

  const data = state.kind === 'ready' ? state.data : null;
  const untilStart = useCountdown(data?.starts_at);
  const banner = mediaUrl(data?.banner_url);

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
          <Button variant="outline" size="sm" onClick={retry}>{t('openWebinars.retry')}</Button>
        </div>
      )}
      {data && (
        <div className="space-y-5">
          {/* The poster leads the page. Everything below stays the source of truth: the date baked into a poster can go stale. */}
          {banner && <img src={banner} alt={data.title} data-banner className="mx-auto h-auto max-h-[85vh] w-auto max-w-full rounded-2xl object-contain" />}
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
            <PresenterBlock speaker={data.speaker} t={t} />
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

            {data.full && data.access_mode === 'registration' && data.state !== 'ended' && (
              <p role="status" data-full className="text-sm font-medium text-foreground">{t('openWebinars.form.full')}</p>
            )}

            {data.registration_open && !data.full && (sentToEmail ? (
              <p role="status" data-registered-neutral className="text-sm text-foreground">{t('openWebinars.form.registeredNeutral')}</p>
            ) : data.consent.policy_ready ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-foreground">{t('openWebinars.form.title')}</h2>
                <ContactForm
                  t={t}
                  locale={locale}
                  withEmail
                  consentText={locale === 'ru' ? data.consent.text_ru : data.consent.text_en}
                  submitLabel={t('openWebinars.form.submit')}
                  onSubmit={async (body) => {
                    const done = await registerForWebinar(data.slug, body);
                    if (done.join_path) navigate(done.join_path);
                    else setSentToEmail(true);
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
