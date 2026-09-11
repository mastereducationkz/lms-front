import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Loader2, MessagesSquare, Play, Search, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { clock } from '../../lib/meetAttendance';
import {
  axisPosition,
  formatDuration,
  clockAt,
  highlightParts,
  linesInBlock,
  percent,
  searchTranscript,
  spanBar,
  stamp,
  talkAxis,
  talkSummaryLine,
  type TalkLocale,
} from '../../lib/meetTalk';
import {
  getLessonTalk,
  type TalkPerson,
  type TalkRecord,
  type TalkRole,
  type TalkTranscript,
} from '../../services/api/meetTalk';
import { TalkGrid, type TalkFocus } from './TalkGrid';

/** Loads a lesson's talk time when `enabled`; null while loading, or when not the viewer's lesson. */
export function useLessonTalk(eventId: number | null | undefined, enabled = true) {
  const [talk, setTalk] = useState<TalkRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setTalk(null);
    setFailed(false);
    if (eventId == null || !enabled) return;
    let cancelled = false;
    setLoading(true);
    getLessonTalk(eventId)
      .then((t) => { if (!cancelled) setTalk(t); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId, enabled]);

  return { talk, loading, failed };
}

const TEXT = {
  en: {
    teacher: 'Teacher', students: 'Students',
    speech: 'Speech', silence: 'Silence', longest: 'Longest teacher stretch', changes: 'Speaker changes',
    per10: (n: number) => `${n.toLocaleString('en-GB', { maximumFractionDigits: 1 })} / 10 min`,
    whoSpoke: 'Who spoke', didntSpeak: 'Didn’t speak',
    heldBack: 'Some speech came from Google accounts nobody has confirmed yet («?»). Confirm them in the Attendance tab and their talk time is named — here and in every lesson they join.',
    voices: 'Meet wasn’t recording who spoke in this lesson (it was before talk time was switched on), so the names come from the recording’s voices and who was in the room. A voice that could be more than one student stays «Голос N», and nobody is listed as silent.',
    notConfirmed: 'Not confirmed', notThisClass: 'Not in this class', notNamed: 'Could be more than one student',
    timeline: 'Who spoke, and when', every10: 'Every 10 minutes', blocks: 'Blocks', exact: 'Exact',
    showAll: 'Show the whole transcript', focusLines: (n: number) => `${n} line${n === 1 ? '' : 's'} in this block`,
    bucket: (from: string, to: string, t: string, s: string) => `${from}–${to} · teacher ${t}, students ${s}`,
    interaction: 'Interaction', teacherQuestions: 'Teacher questions', answered: 'Answered',
    medianWait: 'Median wait before an answer', studentQuestions: 'Student questions',
    transcript: 'Transcript', search: 'Search the transcript', lines: (n: number) => `${n} line${n === 1 ? '' : 's'}`,
    noMatch: 'Nothing in the transcript matches.', playFrom: 'Play the recording from here',
    transcriptState: {
      pending: 'The transcript is being prepared. It appears about half an hour after the recording is ready.',
      off: 'Transcripts are switched off, so this lesson has no text and no interaction figures.',
      failed: 'The transcript could not be made.',
      not_available: 'No transcript for this lesson: it has no recording, or it is from before transcripts were switched on.',
    },
    state: {
      off: 'Talk time is switched off.',
      waiting: 'Talk time appears here about half an hour after the lesson ends.',
      none: 'No talk time for this lesson: Meet wasn’t transcribing it.',
      no_room: 'This lesson wasn’t held in an LMS Meet room, so there is no talk time.',
      unavailable: 'Too old: Google no longer keeps this lesson’s data.',
      not_started: 'The lesson hasn’t started yet.',
    },
  },
  ru: {
    teacher: 'Преподаватель', students: 'Ученики',
    speech: 'Речь', silence: 'Тишина', longest: 'Самый долгий монолог', changes: 'Смена говорящих',
    per10: (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 1 })} за 10 мин`,
    whoSpoke: 'Кто говорил', didntSpeak: 'Не говорили',
    heldBack: 'Часть речи пришла с Google-аккаунтов, которые ещё не подтверждены («?»). Когда их подтвердят, их время будет подписано.',
    voices: 'Meet не записывал, кто говорил на этом уроке (он был до включения), поэтому имена определены по голосам в записи и по тому, кто был в комнате. Голос, который может принадлежать нескольким ученикам, остаётся «Голос N», а молчавших не показываем.',
    notConfirmed: 'Не подтверждён', notThisClass: 'Не из этой группы', notNamed: 'Может быть одним из нескольких учеников',
    timeline: 'Кто, когда и сколько говорил', every10: 'Каждые 10 минут', blocks: 'Блоки', exact: 'Точно',
    showAll: 'Показать всю расшифровку', focusLines: (n: number) => `${n} строк в этом блоке`,
    bucket: (from: string, to: string, t: string, s: string) => `${from}–${to} · преподаватель ${t}, ученики ${s}`,
    interaction: 'Взаимодействие', teacherQuestions: 'Вопросы преподавателя', answered: 'С ответом',
    medianWait: 'Медианное ожидание ответа', studentQuestions: 'Вопросы учеников',
    transcript: 'Расшифровка', search: 'Поиск по расшифровке', lines: (n: number) => `${n} строк`,
    noMatch: 'В расшифровке ничего не найдено.', playFrom: 'Воспроизвести запись с этого места',
    transcriptState: {
      pending: 'Расшифровка готовится. Она появится примерно через полчаса после того, как будет готова запись.',
      off: 'Расшифровки выключены, поэтому у этого урока нет текста и показателей взаимодействия.',
      failed: 'Не удалось сделать расшифровку.',
      not_available: 'Для этого урока нет расшифровки: нет записи, или урок был до включения расшифровок.',
    },
    state: {
      off: 'Время речи выключено.',
      waiting: 'Время речи появится примерно через полчаса после урока.',
      none: 'Для этого урока нет времени речи: Meet его не расшифровывал.',
      no_room: 'Урок проходил не в Meet-комнате LMS, поэтому времени речи нет.',
      unavailable: 'Слишком давно: Google больше не хранит данные этого урока.',
      not_started: 'Урок ещё не начался.',
    },
  },
} as const;

const BAR: Record<TalkRole, string> = {
  teacher: 'bg-violet-500 dark:bg-violet-400',
  student: 'bg-emerald-500 dark:bg-emerald-400',
  unknown: 'bg-amber-400 dark:bg-amber-500',
  other: 'bg-sky-500 dark:bg-sky-400',
};

const INK: Record<TalkRole, string> = {
  teacher: 'text-violet-700 dark:text-violet-300',
  student: 'text-emerald-700 dark:text-emerald-300',
  unknown: 'text-amber-700 dark:text-amber-300',
  other: 'text-sky-700 dark:text-sky-300',
};

type Text = (typeof TEXT)[TalkLocale];

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

/** Teacher against students, as one bar. */
function SplitBar({ teacher, students, className }: { teacher: number | null | undefined; students: number | null | undefined; className?: string }) {
  const t = Math.max(0, Math.min(1, teacher ?? 0));
  const s = Math.max(0, Math.min(1 - t, students ?? 0));
  return (
    <div className={cn('flex h-2.5 overflow-hidden rounded-full bg-muted', className)} aria-hidden>
      <div className={BAR.teacher} style={{ width: `${t * 100}%` }} />
      <div className={BAR.student} style={{ width: `${s * 100}%` }} />
    </div>
  );
}

function Headline({ talk, t, locale }: { talk: TalkRecord; t: Text; locale: TalkLocale }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', BAR.teacher)} aria-hidden />
            {t.teacher} <span className="tabular-nums">{percent(talk.teacher_share)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            {t.students} <span className="tabular-nums">{percent(talk.students_share)}</span>
            <span className={cn('h-2 w-2 rounded-full', BAR.student)} aria-hidden />
          </span>
        </div>
        <SplitBar teacher={talk.teacher_share} students={talk.students_share} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.speech} value={formatDuration(talk.speech_seconds, locale)} />
        <Stat label={t.silence} value={formatDuration(talk.silence_seconds, locale)} />
        {talk.longest_teacher_stretch_seconds != null && (
          <Stat label={t.longest} value={formatDuration(talk.longest_teacher_stretch_seconds, locale)} />
        )}
        {talk.speaker_changes_per_10_min != null && (
          <Stat label={t.changes} value={t.per10(talk.speaker_changes_per_10_min)} />
        )}
      </div>
    </div>
  );
}

function Notes({ talk, t }: { talk: TalkRecord; t: Text }) {
  const silent = talk.silent_students ?? [];
  return (
    <>
      {silent.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">{t.didntSpeak}:</span> {silent.map((s) => s.name).join(', ')}
        </p>
      )}
      {(talk.source === 'voices' || talk.held_back) && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {talk.source === 'voices' ? t.voices : t.heldBack}
        </p>
      )}
    </>
  );
}

function Buckets({ talk, t, locale }: { talk: TalkRecord; t: Text; locale: TalkLocale }) {
  const buckets = talk.buckets ?? [];
  if (buckets.length === 0) return null;
  const base = new Date(talk.start).getTime();
  const at = (minute: number) => clock(new Date(base + minute * 60_000).toISOString());
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted-foreground">{t.every10}</div>
      <div className="flex h-16 items-end gap-1" role="img" aria-label={t.every10}>
        {buckets.map((b, i) => {
          const next = buckets[i + 1]?.from_minute ?? Math.round((talk.lesson_seconds ?? 3600) / 60);
          const length = Math.max(60, (next - b.from_minute) * 60);
          return (
            <div
              key={b.from_minute}
              className="flex h-full min-w-0 flex-1 flex-col justify-end overflow-hidden rounded-sm bg-muted/50"
              title={t.bucket(at(b.from_minute), at(next), formatDuration(b.teacher_seconds, locale), formatDuration(b.students_seconds, locale))}
            >
              <div className={BAR.student} style={{ height: `${Math.min(100, (b.students_seconds / length) * 100)}%` }} />
              <div className={BAR.teacher} style={{ height: `${Math.min(100, (b.teacher_seconds / length) * 100)}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 text-[10px] tabular-nums text-muted-foreground">
        {buckets.map((b) => <span key={b.from_minute} className="min-w-0 flex-1 truncate">{at(b.from_minute)}</span>)}
      </div>
    </div>
  );
}

function Lanes({ talk }: { talk: TalkRecord }) {
  const people = useMemo(() => (talk.people ?? []).filter((p) => p.seconds > 0), [talk.people]);
  const lessonSeconds = talk.lesson_seconds ?? 3600;
  const axis = useMemo(() => talkAxis(talk.start, lessonSeconds, people), [talk.start, lessonSeconds, people]);
  if (people.length === 0) return null;
  const bandLeft = axisPosition(axis, 0);
  const bandWidth = axisPosition(axis, lessonSeconds) - bandLeft;
  // Narrow on a phone so the track keeps room for its clock labels.
  const grid = 'grid grid-cols-[5.5rem_1fr] gap-x-2 sm:grid-cols-[minmax(7rem,13rem)_1fr] sm:gap-x-3';
  return (
    <div className="text-sm">
      <div className={cn(grid, 'items-end pb-1')}>
        <span />
        <div className="relative h-4">
          {axis.ticks.map((tick) => (
            <span key={tick.at} className="absolute -translate-x-1/2 text-[10px] tabular-nums text-muted-foreground"
              style={{ left: `${axisPosition(axis, tick.at)}%` }}>
              {tick.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {people.map((p: TalkPerson) => (
          <div key={p.key} className={cn(grid, 'items-center')}>
            <span className={cn('truncate text-xs', p.role === 'teacher' ? 'font-semibold' : 'font-medium')} title={p.name}>{p.name}</span>
            <div className="relative h-4 overflow-hidden rounded bg-muted/30">
              <div className="absolute inset-y-0 bg-muted/70" style={{ left: `${bandLeft}%`, width: `${bandWidth}%` }} />
              {axis.ticks.map((tick) => (
                <div key={tick.at} className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${axisPosition(axis, tick.at)}%` }} />
              ))}
              {p.spans.map((span) => {
                const bar = spanBar(axis, span);
                return bar && (
                  <div key={span[0]} title={`${stamp(span[0])}–${stamp(span[1])}`}
                    className={cn('absolute inset-y-0.5 rounded-[2px]', BAR[p.role])}
                    style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Insights({ talk, t }: { talk: TalkRecord; t: Text }) {
  const i = talk.insights;
  if (!i) return null;
  const answeredShare = i.teacher_questions ? ` (${percent(i.answered / i.teacher_questions)})` : '';
  return (
    <Section title={t.interaction}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t.teacherQuestions} value={String(i.teacher_questions)} />
        <Stat label={t.answered} value={`${i.answered}${answeredShare}`} />
        <Stat label={t.medianWait} value={i.median_wait_seconds == null ? '—' : `${i.median_wait_seconds.toLocaleString('en-GB', { maximumFractionDigits: 1 })} s`} />
        <Stat label={t.studentQuestions} value={String(i.student_questions)} />
      </div>
    </Section>
  );
}

function Transcript({ transcript, start, t, onSeek, showErrors, focus, onClearFocus }: {
  transcript: TalkTranscript | undefined;
  /** The lesson's start: lines are stamped on the Almaty clock, the same as the blocks. */
  start: string;
  t: Text;
  onSeek?: (recordingSeconds: number) => void;
  showErrors: boolean;
  /** A block picked in the grid: only what was said in it. */
  focus?: TalkFocus | null;
  onClearFocus?: () => void;
}) {
  const [query, setQuery] = useState('');
  const all = useMemo(() => transcript?.lines ?? [], [transcript]);
  const lines = useMemo(() => (focus ? linesInBlock(all, focus) : all), [all, focus]);
  const hits = useMemo(() => searchTranscript(lines, query), [lines, query]);

  if (!transcript) return null;
  if (transcript.state !== 'ready') {
    return (
      <Section title={t.transcript}>
        <p className="text-[13px] text-muted-foreground">
          {transcript.state === 'pending' && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin align-[-2px]" aria-hidden />}
          {t.transcriptState[transcript.state]}
          {transcript.state === 'failed' && showErrors && transcript.error && (
            <span className="mt-1 block font-mono text-[11px] text-rose-600 dark:text-rose-400">{transcript.error}</span>
          )}
        </p>
      </Section>
    );
  }

  return (
    <Section
      title={t.transcript}
      aside={<span className="text-[11px] tabular-nums text-muted-foreground">{t.lines(query.trim() ? hits.length : lines.length)}</span>}
    >
      {focus && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[13px]">
          <span className="font-semibold text-foreground">{focus.name}</span>
          <span className="tabular-nums text-muted-foreground">{focus.label}</span>
          <span className="text-muted-foreground">· {t.focusLines(lines.length)}</span>
          <button type="button" onClick={onClearFocus}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-muted-foreground transition hover:bg-background hover:text-foreground">
            <X className="h-3.5 w-3.5" aria-hidden /> {t.showAll}
          </button>
        </div>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="talk-transcript-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          aria-label={t.search}
          className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {hits.length === 0 ? (
        <p className="px-1 py-3 text-[13px] text-muted-foreground">{t.noMatch}</p>
      ) : (
        <ol className="max-h-[26rem] divide-y divide-border/60 overflow-y-auto rounded-lg border border-border">
          {hits.map(({ line, ranges }, index) => {
            const body = (
              <>
                <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                  {onSeek && <Play className="h-3 w-3 flex-none opacity-60" aria-hidden />}
                  {clockAt(start, line.lesson_at)}
                </span>
                <span className={cn('truncate text-xs font-semibold', line.role ? INK[line.role] : 'text-muted-foreground')} title={line.speaker_label}>
                  {line.speaker_label}
                </span>
                <span className="col-span-2 text-[13px] leading-snug text-foreground sm:col-span-1">
                  {highlightParts(line.text, ranges).map((part, i) => (part.hit
                    ? <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-foreground dark:bg-yellow-500/40">{part.text}</mark>
                    : <span key={i}>{part.text}</span>))}
                </span>
              </>
            );
            const grid = 'grid w-full grid-cols-[4rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5 px-3 py-1.5 text-left sm:grid-cols-[4rem_9rem_minmax(0,1fr)]';
            return (
              // Position and time together: two lines can start in the same second.
              <li key={`${index}:${line.at}`}>
                {onSeek ? (
                  <button type="button" onClick={() => onSeek(line.at)} title={t.playFrom}
                    className={cn(grid, 'transition hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none')}>
                    {body}
                  </button>
                ) : (
                  <div className={grid}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}

interface Props {
  talk: TalkRecord;
  /** When given, transcript lines play the recording from where they were said. */
  onSeek?: (recordingSeconds: number) => void;
  /** full: everything; compact: one line for the lesson card; public: no transcript, no insights. */
  variant?: 'full' | 'compact' | 'public';
  locale?: TalkLocale;
  /** Admins see why a transcript failed. */
  showErrors?: boolean;
  className?: string;
}

/**
 * Who spoke in a lesson and for how long: the teacher against the students, each person, when
 * they spoke, how the class interacted — and, inside the LMS, the searchable transcript.
 */
export default function TalkPanel({ talk, onSeek, variant = 'full', locale = 'en', showErrors = false, className }: Props) {
  const t = TEXT[locale];
  const [view, setView] = useState<'blocks' | 'exact'>('blocks');
  const [focus, setFocus] = useState<TalkFocus | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const readable = variant === 'full' && talk.transcript?.state === 'ready';
  const pick = (next: TalkFocus | null) => {
    setFocus(next);
    if (next) requestAnimationFrame(() => transcriptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  if (talk.state !== 'ready') {
    if (variant === 'compact' && talk.state !== 'waiting') return null;
    return <p className={cn('text-sm text-muted-foreground', className)}>{t.state[talk.state]}</p>;
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1', className)}>
        <SplitBar teacher={talk.teacher_share} students={talk.students_share} className="w-24 flex-none" />
        <span className="text-[13px] tabular-nums text-foreground">{talkSummaryLine(talk, locale)}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <Headline talk={talk} t={t} locale={locale} />
      <Section
        title={t.timeline}
        aside={(
          <div className="inline-flex gap-0.5 rounded-md border border-border bg-muted/40 p-0.5" role="group" aria-label={t.timeline}>
            {(['blocks', 'exact'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                className={cn('rounded px-2 py-0.5 text-[11px] font-medium transition',
                  view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {v === 'blocks' ? t.blocks : t.exact}
              </button>
            ))}
          </div>
        )}
      >
        {view === 'blocks'
          ? <TalkGrid talk={talk} locale={locale} focus={focus} onPick={readable ? pick : undefined} />
          : (
            <>
              <Buckets talk={talk} t={t} locale={locale} />
              <Lanes talk={talk} />
            </>
          )}
        <Notes talk={talk} t={t} />
      </Section>
      {variant === 'full' && <Insights talk={talk} t={t} />}
      {variant === 'full' && (
        <div ref={transcriptRef} className="scroll-mt-4">
          <Transcript transcript={talk.transcript} start={talk.start} t={t} onSeek={onSeek} showErrors={showErrors}
            focus={focus} onClearFocus={() => setFocus(null)} />
        </div>
      )}
    </div>
  );
}

const CARD_TEXT = {
  en: { title: 'Talk time', show: 'Show talk time', hide: 'Hide' },
  ru: { title: 'Время речи', show: 'Показать время речи', hide: 'Скрыть' },
} as const;

/**
 * Talk time beside a recording: a one-line summary, and the full panel on request — the same
 * shape as the participants list next to it. Renders nothing unless there is something to read.
 */
export function TalkCard({ talk, locale = 'en', onSeek, variant = 'full', showErrors = false, defaultOpen = false, className }: Omit<Props, 'variant'> & {
  variant?: 'full' | 'public';
  defaultOpen?: boolean;
}) {
  const t = CARD_TEXT[locale];
  const [open, setOpen] = useState(defaultOpen);
  if (talk.state !== 'ready' && talk.state !== 'waiting') return null;
  const ready = talk.state === 'ready';
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)} aria-label={t.title}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <MessagesSquare className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
        <TalkPanel talk={talk} variant="compact" locale={locale} className="min-w-0" />
        {ready && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? t.hide : t.show}
            <ChevronDown className={cn('h-3.5 w-3.5 transition', open && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>
      {ready && open && (
        <div className="border-t border-border px-4 py-4">
          <TalkPanel talk={talk} variant={variant} locale={locale} onSeek={onSeek} showErrors={showErrors} />
        </div>
      )}
    </section>
  );
}
