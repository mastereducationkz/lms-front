import { useEffect, useRef, useState } from 'react';
import { Check, Eye, Play, User, Video } from 'lucide-react';
import type { RecordingLibraryItem } from '../../services/api/recordings';
import { formatClock, recordingHeading, timeRange, type Locale } from '../../lib/recordings';
import { badgeText, overallPercent, progressFor, stageTitle } from '../../lib/recordingProgress';
import { viewsHint, viewsLine } from '../../lib/recordingViews';
import { useT } from '../../lib/i18n/react';
import { cx } from '../calendar/calendarUtils';
import { ProgressBar, RecordingCardStage, RecordingStageBadge } from './RecordingProgress';

// How long a card that has just become watchable says so, before it looks like every other card.
const JUST_READY_MS = 4_000;

/** Stored media paths are relative to the API host; images need the host spelled out. */
function mediaUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  return `${backend}${path}`;
}

interface Props {
  item: RecordingLibraryItem;
  locale: Locale;
  onOpen: (item: RecordingLibraryItem) => void;
  /** Present only while browsing a substitute's group folder. */
  substitutionFor?: string | null;
}

/**
 * One recording in the library: the preview the ingest chose (the most detailed frame, not
 * the webcam tile Drive shows), how long it runs, when it was, which group and who taught it.
 * Until it is watchable the preview's place says where it is — in line, preparing and how far,
 * retrying or failed — and it updates in place while the library is open.
 */
export default function RecordingCard({ item, locale, onOpen, substitutionFor }: Props) {
  const t = useT();
  const [posterBroken, setPosterBroken] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const { name, lesson } = recordingHeading(item, locale);
  const courses = item.event_type === 'webinar' ? (item.courses ?? []).map((c) => c.title).join(', ') : '';
  const clock = formatClock(item.duration_seconds);
  const ready = item.status === 'ready';
  const poster = ready && item.poster_url && !posterBroken ? mediaUrl(item.poster_url) : null;
  const progress = ready ? null : progressFor(item.status, item.progress);
  // Who watched it — the server sends this to staff only (2026-09-28).
  const views = ready ? viewsLine(item.views, locale) : null;

  // A card that turns watchable while in view says so for a moment.
  const previous = useRef(item.status);
  const [justReady, setJustReady] = useState(false);
  useEffect(() => {
    if (previous.current !== 'ready' && item.status === 'ready') {
      setJustReady(true);
      const timer = window.setTimeout(() => setJustReady(false), JUST_READY_MS);
      previous.current = item.status;
      return () => window.clearTimeout(timer);
    }
    previous.current = item.status;
    return undefined;
  }, [item.status]);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={[name, lesson, timeRange(item.start_datetime, item.end_datetime), clock, progress && badgeText(progress, locale), views]
        .filter(Boolean).join(', ')}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-slate-900">
        {poster ? (
          <>
            {/* Until the picture arrives, a soft pulse rather than a flat dark box. */}
            {!posterLoaded && <span className="absolute inset-0 animate-pulse bg-slate-700/60" aria-hidden />}
            <img
              src={poster}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => setPosterLoaded(true)}
              onError={() => setPosterBroken(true)}
              className={cx(
                'h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]',
                posterLoaded ? 'opacity-100' : 'opacity-0',
              )}
            />
          </>
        ) : progress ? (
          <RecordingCardStage progress={progress} locale={locale} name={name} />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-700 to-slate-900 px-4 text-center">
            <Video className="h-6 w-6 text-white/45" aria-hidden />
            <span className="line-clamp-1 text-xs font-medium text-white/55">{name}</span>
          </div>
        )}

        {ready && (
          <>
            <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" aria-hidden />
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
              aria-hidden
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg">
                <Play className="ml-0.5 h-5 w-5 fill-slate-900 text-slate-900" />
              </span>
            </span>
          </>
        )}

        {clock && ready && (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
            {clock}
          </span>
        )}

        {progress && <RecordingStageBadge progress={progress} locale={locale} className="absolute left-2 top-2" />}

        {justReady && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-900 shadow-sm dark:bg-emerald-950/90 dark:text-emerald-200 animate-in fade-in zoom-in-95">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
            {t('recordings.card.justReady')}
          </span>
        )}

        {progress?.stage === 'processing' && (
          <ProgressBar
            percent={overallPercent(progress)}
            label={stageTitle(progress, locale)}
            className="absolute inset-x-0 bottom-0 h-1 rounded-none bg-black/30"
          />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-3">
        <span className="line-clamp-1 text-[15px] font-semibold leading-snug text-foreground">{name}</span>
        {courses && <span className="line-clamp-1 text-[12.5px] text-muted-foreground">{courses}</span>}
        <span className="flex items-center gap-1.5 text-[13px] tabular-nums text-muted-foreground">
          {lesson && <span className="font-medium text-foreground/80">{lesson}</span>}
          {lesson && <span aria-hidden>·</span>}
          <span>{timeRange(item.start_datetime, item.end_datetime)}</span>
        </span>
        {item.teacher?.name && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <User className="h-3.5 w-3.5 flex-none" aria-hidden />
            <span className="truncate">{item.teacher.name}</span>
          </span>
        )}
        {substitutionFor && (
          <span className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{t('recordings.folders.substitution', { name: substitutionFor })}</span>
        )}
        {views && (
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] tabular-nums text-muted-foreground" title={viewsHint(locale)}>
            <Eye className="h-3.5 w-3.5 flex-none" aria-hidden />
            <span className="truncate">{views}</span>
          </span>
        )}
      </div>
    </button>
  );
}
