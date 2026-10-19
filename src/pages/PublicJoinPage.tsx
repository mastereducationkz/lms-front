import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CalendarPlus, CheckCircle2, Loader2, PlayCircle, Video } from 'lucide-react';
import { Button } from '../components/ui/button';
import PublicShell from '../components/open-webinars/PublicShell';
import { countdownText, useCountdown } from '../components/open-webinars/useCountdown';
import { getJoinInfo, PublicApiError, type JoinInfo } from '../services/api/publicWebinars';
import { formatDate, formatTime } from '../lib/i18n/format';
import { usePublicLocale } from '../lib/publicLocale';
import '@/lib/i18n/catalogs/openWebinars';

type State = { kind: 'loading' } | { kind: 'ready'; data: JoinInfo } | { kind: 'missing' } | { kind: 'cancelled' } | { kind: 'error' };

const REFRESH_MS = 15_000;

export function googleCalendarUrl(data: JoinInfo, pageUrl: string): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const query = new URLSearchParams({ action: 'TEMPLATE', text: data.title, dates: `${stamp(data.starts_at)}/${stamp(data.ends_at)}`, details: pageUrl });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

/**
 * A registrant's personal link (`/w/j/:code`): the confirmation, the countdown, then the way into the room.
 * Opening it while the webinar is on is what the funnel counts as «joined».
 */
export default function PublicJoinPage() {
  const { code = '' } = useParams();
  const { locale, setLocale, t } = usePublicLocale();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      setState({ kind: 'ready', data: await getJoinInfo(code) });
    } catch (failure) {
      setState((now) => (now.kind === 'ready' ? now : failure instanceof PublicApiError && failure.status === 404 ? { kind: 'missing' } : failure instanceof PublicApiError && failure.status === 410 ? { kind: 'cancelled' } : { kind: 'error' }));
    }
  }, [code]);

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
      {state.kind === 'missing' && <p className="rounded-2xl border border-border bg-card px-6 py-12 text-sm shadow-sm">{t('openWebinars.join.notFound')}</p>}
      {state.kind === 'cancelled' && <p role="status" className="rounded-2xl border border-border bg-card px-6 py-12 text-sm shadow-sm">{t('openWebinars.cancelled')}</p>}
      {state.kind === 'error' && (
        <div className="space-y-3 rounded-2xl border border-border bg-card px-6 py-12 text-sm shadow-sm">
          <p>{t('openWebinars.loadFailed')}</p>
          <Button variant="outline" size="sm" onClick={() => { setState({ kind: 'loading' }); void load(); }}>{t('openWebinars.retry')}</Button>
        </div>
      )}
      {data && (
        <article className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
          <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" aria-hidden />{t('openWebinars.join.registered')}
          </p>
          <div>
            <p className="text-sm text-muted-foreground">{t('openWebinars.join.hello', { name: data.name.split(' ')[0] })}</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight text-foreground">{data.title}</h1>
            <p className="mt-2 text-sm text-foreground">
              {t('openWebinars.when', {
                date: formatDate(data.starts_at, { weekday: 'long', day: 'numeric', month: 'long' }, locale),
                start: formatTime(data.starts_at, undefined, locale),
                end: formatTime(data.ends_at, undefined, locale),
              })}{' '}
              <span className="text-muted-foreground">· {t('openWebinars.timeNote')}</span>
            </p>
          </div>

          {data.state === 'upcoming' && (
            <p className="text-sm text-muted-foreground">
              {t('openWebinars.state.upcoming')}: <strong className="text-foreground">{countdownText(untilStart, t)}</strong>
              <br />{t('openWebinars.join.opensAt')}
            </p>
          )}
          {data.state === 'live' && data.join_url && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">{t('openWebinars.state.live')}</p>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <a href={data.join_url} target="_blank" rel="noopener noreferrer"><Video className="mr-2 h-4 w-4" aria-hidden />{t('openWebinars.join.button')}</a>
              </Button>
              <p className="text-xs text-muted-foreground">{t('openWebinars.join.opens')}</p>
            </div>
          )}
          {data.state === 'live' && !data.join_url && (
            <p className="text-sm text-muted-foreground" role="status">{t('openWebinars.join.preparing')}</p>
          )}
          {data.state === 'ended' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('openWebinars.state.ended')}</p>
              {data.recording_slug && (
                <Button asChild size="lg"><Link to={`/r/${data.recording_slug}`}><PlayCircle className="mr-2 h-4 w-4" aria-hidden />{t('openWebinars.recording.watch')}</Link></Button>
              )}
            </div>
          )}

          {data.state !== 'ended' && (
            <>
              <a href={googleCalendarUrl(data, window.location.href)} target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
                <CalendarPlus className="h-4 w-4" aria-hidden />{t('openWebinars.join.addToCalendar')}
              </a>
              <p className="rounded-lg bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">{t('openWebinars.join.yourLink')}</p>
            </>
          )}
        </article>
      )}
    </PublicShell>
  );
}
