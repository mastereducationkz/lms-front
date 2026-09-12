import { useState } from 'react';
import { AlertTriangle, Loader2, Play, User, Video, VideoOff } from 'lucide-react';
import type { RecordingLibraryItem } from '../../services/api/recordings';
import { formatClock, splitLessonTitle, timeRange, type Locale } from '../../lib/recordings';
import { cx } from '../calendar/calendarUtils';

const TEXT = {
  en: { pending: 'Processing', failed: 'Could not process', removed: 'No longer available', watch: 'Watch', substitution: (name: string) => `Substitution · regular teacher: ${name}` },
  ru: { pending: 'Обрабатывается', failed: 'Не обработалась', removed: 'Больше недоступна', watch: 'Смотреть', substitution: (name: string) => `Замена · основной учитель: ${name}` },
} as const;

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
 */
export default function RecordingCard({ item, locale, onOpen, substitutionFor }: Props) {
  const t = TEXT[locale];
  const [posterBroken, setPosterBroken] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const { name, lesson } = splitLessonTitle(item.title, item.groups, locale);
  const clock = formatClock(item.duration_seconds);
  const ready = item.status === 'ready';
  const poster = ready && item.poster_url && !posterBroken ? mediaUrl(item.poster_url) : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={[name, lesson, timeRange(item.start_datetime, item.end_datetime), clock].filter(Boolean).join(', ')}
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
        ) : (
          <div
            className={cx(
              'flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-slate-700 to-slate-900 px-4 text-center',
              item.status === 'pending' && 'animate-pulse',
            )}
          >
            {item.status === 'pending' ? (
              <Loader2 className="h-6 w-6 animate-spin text-white/60" aria-hidden />
            ) : item.status === 'failed' || item.status === 'removed' ? (
              <VideoOff className="h-6 w-6 text-white/45" aria-hidden />
            ) : (
              <Video className="h-6 w-6 text-white/45" aria-hidden />
            )}
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

        {item.status !== 'ready' && (
          <span
            className={cx(
              'absolute left-2 top-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold',
              item.status === 'pending' ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-rose-900',
            )}
          >
            {item.status !== 'pending' && <AlertTriangle className="h-3 w-3" aria-hidden />}
            {t[item.status]}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-3.5 pb-3.5 pt-3">
        <span className="line-clamp-1 text-[15px] font-semibold leading-snug text-foreground">{name}</span>
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
          <span className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">{t.substitution(substitutionFor)}</span>
        )}
      </div>
    </button>
  );
}
