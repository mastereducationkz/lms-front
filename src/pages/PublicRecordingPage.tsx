import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarClock, Loader2 } from 'lucide-react';
import HlsVideoPlayer from '../components/HlsVideoPlayer';
import PublicShell from '../components/open-webinars/PublicShell';
import ConsultationCard from '../components/open-webinars/ConsultationCard';
import PresenterBlock from '../components/open-webinars/PresenterBlock';
import { inLocale } from '../components/open-webinars/englishText';
import { usePageTitle } from '../components/open-webinars/usePageTitle';
import { getPublicRecording, PublicApiError, type PublicRecording } from '../services/api/publicWebinars';
import { formatDate } from '../lib/i18n/format';
import { usePublicLocale } from '../lib/publicLocale';
import '@/lib/i18n/catalogs/openWebinars';

type State = { kind: 'loading' } | { kind: 'ready'; data: PublicRecording } | { kind: 'withdrawn' } | { kind: 'missing' } | { kind: 'error' };

/**
 * A webinar's recording for anyone with the link (`/r/:slug`). No login, and nothing about who was in the room:
 * the title, the speaker, the video, and the same «leave your number» card as under an open webinar.
 */
export default function PublicRecordingPage() {
  const { slug = '' } = useParams();
  const { locale, setLocale, t } = usePublicLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [playFailed, setPlayFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getPublicRecording(slug)
      .then((data) => live && setState({ kind: 'ready', data }))
      .catch((failure) => {
        if (!live) return;
        setState(failure instanceof PublicApiError && failure.status === 410 ? { kind: 'withdrawn' }
          : failure instanceof PublicApiError && failure.status === 404 ? { kind: 'missing' } : { kind: 'error' });
      });
    return () => { live = false; };
  }, [slug]);

  const data = state.kind === 'ready' ? state.data : null;
  // The English title and description when the visitor reads English and they were written; the original otherwise.
  const title = data ? inLocale(locale, data.title, data.title_en) : '';
  usePageTitle(title);
  const description = data ? inLocale(locale, data.description, data.description_en) : null;
  const message = state.kind === 'withdrawn' ? t('openWebinars.recording.withdrawn')
    : state.kind === 'missing' ? t('openWebinars.recording.missing') : state.kind === 'error' ? t('openWebinars.loadFailed') : null;

  return (
    <PublicShell locale={locale} setLocale={setLocale} t={t}>
      {state.kind === 'loading' && (
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-6 py-16 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {t('openWebinars.loading')}
        </div>
      )}
      {message && <p className="rounded-2xl border border-border bg-card px-6 py-12 text-sm text-foreground shadow-sm">{message}</p>}
      {data && (
        <div className="space-y-5">
          <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="bg-black">
              <HlsVideoPlayer url={data.url} poster={data.poster_url} title={title} className="aspect-video w-full" onError={() => setPlayFailed(true)} />
            </div>
            {playFailed && <p role="alert" className="px-5 pt-3 text-sm text-red-600 dark:text-red-400">{t('openWebinars.recording.playFailed')}</p>}
            <div className="space-y-3 p-5 sm:p-7">
              <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">{title}</h1>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarClock className="h-4 w-4 flex-none" aria-hidden />
                {t('openWebinars.recording.recordedOn', { date: formatDate(data.starts_at, { day: 'numeric', month: 'long', year: 'numeric' }, locale) })}
              </p>
              <PresenterBlock speaker={data.speaker} locale={locale} t={t} />
              {description && <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{description}</p>}
            </div>
          </article>
          {data.consultation_open !== false && <ConsultationCard t={t} locale={locale} webinarSlug={data.slug} consent={data.consent} />}
        </div>
      )}
    </PublicShell>
  );
}
