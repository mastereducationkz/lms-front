/**
 * A quiet line at the foot of the season banner for a League student with no personal Telegram link
 * (owner, 2026-10-13): what they would get, a «Connect Telegram» button and «Not now». Never a popup,
 * never in the attention queue, never in the banner's way. «Connect» is the Settings page's own flow
 * (`useTelegramLink`: the same endpoints, the same Start polling); «Not now» hides the line for
 * `SNOOZE_DAYS` days; once linked it thanks them and is gone for good. It shows only after the
 * status loaded and only while there is no link: loading, an error, a blocked bot and an unreachable
 * Support all show nothing.
 *
 * `LeagueTelegramLineView` is the pure picture; `LeagueTelegramLine` adds the status and the clock.
 */
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Send } from 'lucide-react';
import { useT } from '@/lib/i18n/react';
import { THANKS_MS, knownLinked, lineMode, readSnoozed, rememberLinked, snooze, type LineMode } from '@/lib/leagueTelegram';
import { useTelegramLink } from '@/lib/useTelegramLink';
import '@/lib/i18n/catalogs/studentHome';

const GOLD =
  'inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-2 text-xs font-bold text-blue-950 transition-colors hover:bg-amber-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';
const QUIET =
  'inline-flex items-center rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-amber-200 ring-1 ring-white/15 transition-colors hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300';

interface ViewProps {
  mode: Exclude<LineMode, 'hidden'>;
  /** The t.me deep link, while waiting for Start. */
  linkUrl?: string | null;
  busy?: boolean;
  failed?: boolean;
  onConnect?: () => void;
  onLater?: () => void;
}

export function LeagueTelegramLineView({ mode, linkUrl = null, busy = false, failed = false, onConnect, onLater }: ViewProps) {
  const t = useT();
  const text =
    mode === 'offer' ? t('studentHome.league.telegram.offer')
    : mode === 'waiting' ? t('studentHome.league.telegram.waiting')
    : mode === 'timed-out' ? t('studentHome.league.telegram.timedOut')
    : t('studentHome.league.telegram.thanks');
  const connect = (
    <button type="button" disabled={busy} onClick={onConnect} className={GOLD}>
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
      {t('studentHome.league.telegram.connect')}
    </button>
  );
  const later = (
    <button type="button" onClick={onLater} className={QUIET}>
      {t('studentHome.league.telegram.later')}
    </button>
  );
  const open = linkUrl ? (
    <a href={linkUrl} target="_blank" rel="noopener noreferrer" className={GOLD}>
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      {t('studentHome.league.telegram.open')}
    </a>
  ) : null;

  return (
    <div role="group" aria-label={t('studentHome.league.telegram.region')} className="relative border-t border-white/10 px-4 py-3 @lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p role={mode === 'offer' ? undefined : 'status'} className="min-w-0 flex-1 text-xs text-blue-100/90">
          {mode === 'waiting' && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin text-amber-300" aria-hidden />}
          {text}
          {failed && <span role="alert" className="mt-0.5 block text-amber-200">{t('studentHome.league.telegram.failed')}</span>}
        </p>
        {mode !== 'thanks' && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {mode === 'offer' && <>{connect}{later}</>}
            {mode === 'waiting' && open}
            {mode === 'timed-out' && <>{open}{connect}{later}</>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LeagueTelegramLine({ userId }: { userId: number | string }) {
  const [snoozed, setSnoozed] = useState(() => readSnoozed(userId, Date.now()));
  const [linkedBefore] = useState(() => knownLinked(userId));
  const [wasWaiting, setWasWaiting] = useState(false);
  const [thanksOver, setThanksOver] = useState(false);
  const [failed, setFailed] = useState(false);
  const tg = useTelegramLink(!snoozed && !linkedBefore);
  const mode = snoozed || linkedBefore ? 'hidden' : lineMode({ phase: tg.phase, stale: tg.status?.stale === true, wasWaiting, thanksOver });

  useEffect(() => {
    if (tg.phase === 'waiting') setWasWaiting(true);
    if (tg.phase === 'connected') rememberLinked(userId);
  }, [tg.phase, userId]);

  useEffect(() => {
    if (mode !== 'thanks') return undefined;
    const timer = window.setTimeout(() => setThanksOver(true), THANKS_MS);
    return () => window.clearTimeout(timer);
  }, [mode]);

  if (mode === 'hidden') return null;
  return (
    <LeagueTelegramLineView
      mode={mode}
      linkUrl={tg.link?.url ?? null}
      busy={tg.busy}
      failed={failed}
      onConnect={async () => {
        if (tg.busy) return;
        setFailed(!(await tg.connect()));
      }}
      onLater={() => {
        snooze(userId, Date.now());
        setSnoozed(true);
      }}
    />
  );
}
