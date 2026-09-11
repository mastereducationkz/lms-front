import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownToLine, Loader2, Play, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { clockAt, highlightParts, linesInBlock, searchTranscript, stamp, type TalkLocale } from '../../lib/meetTalk';
import { currentLineIndex, isSpeaking, lessonAt, revealScrollTop } from '../../lib/transcriptFollow';
import type { TalkRole, TalkTranscript as TranscriptData, TranscriptLine } from '../../services/api/meetTalk';
import type { TalkFocus } from './TalkGrid';

const TEXT = {
  en: {
    transcript: 'Transcript', search: 'Search the transcript', lines: (n: number) => `${n} line${n === 1 ? '' : 's'}`,
    noMatch: 'Nothing in the transcript matches.', playFrom: 'Play the recording from here',
    showAll: 'Show the whole transcript', focusLines: (n: number) => `${n} line${n === 1 ? '' : 's'} in this block`,
    follow: 'Follow the video', following: 'Following the video', paused: 'Not following',
    backToNow: 'Back to now', searching: 'Following pauses while you search.',
    now: 'Now playing', beforeFirst: 'Nothing said yet',
    transcriptState: {
      pending: 'The transcript is being prepared. It appears about half an hour after the recording is ready.',
      off: 'Transcripts are switched off, so this lesson has no text and no interaction figures.',
      failed: 'The transcript could not be made.',
      not_available: 'No transcript for this lesson: it has no recording, or it is from before transcripts were switched on.',
    },
  },
  ru: {
    transcript: 'Расшифровка', search: 'Поиск по расшифровке', lines: (n: number) => `${n} строк`,
    noMatch: 'В расшифровке ничего не найдено.', playFrom: 'Воспроизвести запись с этого места',
    showAll: 'Показать всю расшифровку', focusLines: (n: number) => `${n} строк в этом блоке`,
    follow: 'Следовать за видео', following: 'Следует за видео', paused: 'Не следует',
    backToNow: 'К текущему месту', searching: 'Во время поиска расшифровка не следует за видео.',
    now: 'Сейчас', beforeFirst: 'Пока никто не говорил',
    transcriptState: {
      pending: 'Расшифровка готовится. Она появится примерно через полчаса после того, как будет готова запись.',
      off: 'Расшифровки выключены, поэтому у этого урока нет текста и показателей взаимодействия.',
      failed: 'Не удалось сделать расшифровку.',
      not_available: 'Для этого урока нет расшифровки: нет записи, или урок был до включения расшифровок.',
    },
  },
} as const;

const INK: Record<TalkRole, string> = {
  teacher: 'text-violet-700 dark:text-violet-300',
  student: 'text-emerald-700 dark:text-emerald-300',
  unknown: 'text-amber-700 dark:text-amber-300',
  other: 'text-sky-700 dark:text-sky-300',
};

// Keys that scroll a focused list: pressing one means the viewer is reading on their own.
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const ROW = 'grid w-full grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 px-3 py-1.5 text-left';
const ROW_WIDE = 'sm:grid-cols-[4rem_9rem_minmax(0,1fr)]';

interface RowProps {
  line: TranscriptLine;
  ranges: [number, number][];
  start: string;
  /** The line the video is at; `speaking` while it is still being said. */
  current: boolean;
  speaking: boolean;
  narrow: boolean;
  onSeek?: (recordingSeconds: number) => void;
  playLabel: string;
}

/** One transcript line. Memoised: the video's clock re-renders the list a few times a second. */
const Row = memo(function Row({ line, ranges, start, current, speaking, narrow, onSeek, playLabel }: RowProps) {
  const body = (
    <>
      <span className={cn('flex items-center gap-1 text-[11px] tabular-nums', current ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
        {onSeek && <Play className={cn('h-3 w-3 flex-none', current ? 'opacity-100' : 'opacity-50')} aria-hidden />}
        {clockAt(start, line.lesson_at)}
      </span>
      <span className={cn('truncate text-xs font-semibold', line.role ? INK[line.role] : 'text-muted-foreground')} title={line.speaker_label}>
        {line.speaker_label}
      </span>
      <span className={cn('col-span-2 text-[13px] leading-snug text-foreground', !narrow && 'sm:col-span-1')}>
        {highlightParts(line.text, ranges).map((part, i) => (part.hit
          ? <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40">{part.text}</mark>
          : <span key={i}>{part.text}</span>))}
      </span>
    </>
  );
  const tone = cn(
    current && (speaking
      ? 'bg-primary/10 shadow-[inset_3px_0_0_hsl(var(--primary))]'
      : 'bg-muted/60 shadow-[inset_3px_0_0_hsl(var(--primary)/0.45)]'),
  );
  const grid = cn(ROW, !narrow && ROW_WIDE, tone);
  return (
    <li aria-current={current ? 'true' : undefined}>
      {onSeek ? (
        <button type="button" onClick={() => onSeek(line.at)} title={playLabel}
          className={cn(grid, 'transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring')}>
          {body}
        </button>
      ) : (
        <div className={grid}>{body}</div>
      )}
    </li>
  );
});

interface Props {
  transcript: TranscriptData | undefined;
  /** The lesson's start: lines are stamped on the Almaty clock, the same as the blocks. */
  start: string;
  locale: TalkLocale;
  /** When given, clicking a line plays the recording from there. */
  onSeek?: (recordingSeconds: number) => void;
  showErrors?: boolean;
  /** A block picked in the grid: only what was said in it. */
  focus?: TalkFocus | null;
  onClearFocus?: () => void;
  /**
   * The video's time, in recording seconds. When given (a player is beside it), the transcript
   * follows: the line being said is highlighted and kept in view, until the viewer scrolls away.
   */
  playhead?: number | null;
  /** Fill the parent's height — the player's side panel — instead of a list of fixed height. */
  fill?: boolean;
  /** Stamp and speaker stacked above the text, for a narrow column. */
  narrow?: boolean;
  /** Hide the section title where tabs already name it. */
  hideTitle?: boolean;
  /** A shorter list, for a card under a video on a phone: the line being said stays on screen. */
  short?: boolean;
  className?: string;
}

/**
 * The lesson's words: searchable, each line named, and — beside a video — following it.
 *
 * Following scrolls only the list, never the page or the dialog around it. Any scrolling by hand
 * (wheel, touch, keys, the scrollbar) stops it, and «Back to now» brings it back; so does playing
 * from a line. A search pauses it while there is a query: the matches are not where the video is.
 */
export function TalkTranscript({
  transcript, start, locale, onSeek, showErrors = false, focus, onClearFocus, playhead,
  fill = false, narrow = false, hideTitle = false, short = false, className,
}: Props) {
  const t = TEXT[locale];
  const [query, setQuery] = useState('');
  const [follow, setFollow] = useState(true);
  const listRef = useRef<HTMLOListElement>(null);
  const all = useMemo(() => transcript?.lines ?? [], [transcript]);
  const lines = useMemo(() => (focus ? linesInBlock(all, focus) : all), [all, focus]);
  const hits = useMemo(() => searchTranscript(lines, query), [lines, query]);
  const shown = useMemo(() => hits.map((h) => h.line), [hits]);

  const tracking = playhead !== undefined;
  const searching = query.trim() !== '';
  const following = tracking && follow && !searching;
  const current = tracking ? currentLineIndex(shown, playhead) : -1;
  const speaking = current >= 0 && isSpeaking(shown[current], playhead);
  const offset = transcript?.recording_offset_seconds ?? null;
  const nowLesson = lessonAt(playhead, offset);
  const nowLabel = playhead == null ? null : nowLesson != null ? clockAt(start, nowLesson) : stamp(playhead);

  const reveal = useCallback((index: number, smooth: boolean) => {
    const list = listRef.current;
    const item = list?.children[index] as HTMLElement | undefined;
    if (!list || !item) return;
    const top = revealScrollTop({ top: list.scrollTop, height: list.clientHeight },
      { top: item.offsetTop, height: item.offsetHeight });
    if (top === null) return;
    // Glide to the next line; jump when it is far (a seek, or the panel just opened).
    const near = Math.abs(top - list.scrollTop) < list.clientHeight * 1.5;
    list.scrollTo({ top, behavior: smooth && near && !reducedMotion() ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (following && current >= 0) reveal(current, true);
  }, [following, current, reveal]);

  const stopFollowing = () => { if (tracking) setFollow(false); };
  const backToNow = () => {
    setFollow(true);
    if (current >= 0) reveal(current, false);
  };
  const seekAndFollow = useCallback((seconds: number) => {
    onSeek?.(seconds);
    setFollow(true);
  }, [onSeek]);

  if (!transcript) return null;
  if (transcript.state !== 'ready') {
    return (
      <section className={cn('flex flex-col gap-2', className)}>
        {!hideTitle && <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.transcript}</h4>}
        <p className="text-[13px] text-muted-foreground">
          {transcript.state === 'pending' && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin align-[-2px]" aria-hidden />}
          {t.transcriptState[transcript.state]}
          {transcript.state === 'failed' && showErrors && transcript.error && (
            <span className="mt-1 block font-mono text-[11px] text-rose-600 dark:text-rose-400">{transcript.error}</span>
          )}
        </p>
      </section>
    );
  }

  return (
    <section className={cn('flex flex-col gap-2', fill && 'min-h-0 flex-1', className)} aria-label={t.transcript}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!hideTitle && <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.transcript}</h4>}
        {tracking && (
          <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-muted-foreground" aria-live="off">
            <span className="text-[11px] uppercase tracking-wide">{t.now}</span>
            <span className="font-semibold text-foreground">{nowLabel ?? '—'}</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {tracking && (
            <button
              type="button"
              aria-pressed={follow}
              onClick={() => (follow ? setFollow(false) : backToNow())}
              title={t.follow}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                following
                  ? 'border-primary/40 bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground')}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', following ? 'bg-primary' : 'bg-muted-foreground/50')} aria-hidden />
              {following ? t.following : t.follow}
            </button>
          )}
          <span className="text-[11px] tabular-nums text-muted-foreground">{t.lines(searching ? hits.length : lines.length)}</span>
        </div>
      </div>

      {focus && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
          <span className="font-semibold text-foreground">{focus.name}</span>
          <span className="tabular-nums text-muted-foreground">{focus.label}</span>
          <span className="text-muted-foreground">· {t.focusLines(lines.length)}</span>
          <button type="button" onClick={onClearFocus}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="h-3.5 w-3.5" aria-hidden /> {t.showAll}
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          aria-label={t.search}
          className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {tracking && searching && <p className="text-[11px] text-muted-foreground">{t.searching}</p>}

      {hits.length === 0 ? (
        <p className="px-1 py-3 text-[13px] text-muted-foreground">{t.noMatch}</p>
      ) : (
        <div className={cn('relative', fill && 'min-h-0 flex-1')}>
          <ol
            ref={listRef}
            tabIndex={-1}
            onWheel={stopFollowing}
            onTouchMove={stopFollowing}
            onKeyDown={(e) => { if (SCROLL_KEYS.has(e.key)) stopFollowing(); }}
            // A press on the list itself, not on a line, is its scrollbar being dragged.
            onPointerDown={(e) => { if (e.target === e.currentTarget) stopFollowing(); }}
            // Positioned either way, so each line's offsetTop is measured from the list itself.
            className={cn('divide-y divide-border/60 overflow-y-auto overscroll-contain rounded-lg border border-border focus-visible:outline-none',
              fill ? 'absolute inset-0' : cn('relative', short ? 'max-h-[40vh]' : 'max-h-[26rem]'))}
          >
            {hits.map(({ line, ranges }, index) => (
              // Position and time together: two lines can start in the same second.
              <Row
                key={`${index}:${line.at}`}
                line={line}
                ranges={ranges}
                start={start}
                current={index === current}
                speaking={index === current && speaking}
                narrow={narrow}
                onSeek={onSeek ? seekAndFollow : undefined}
                playLabel={t.playFrom}
              />
            ))}
          </ol>
          {tracking && !following && !searching && current >= 0 && (
            <button
              type="button"
              onClick={backToNow}
              className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-md transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" aria-hidden />
              {t.backToNow}
              {nowLabel && <span className="tabular-nums text-muted-foreground">· {nowLabel}</span>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
