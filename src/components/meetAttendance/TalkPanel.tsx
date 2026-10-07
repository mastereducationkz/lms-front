import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MessagesSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { clock } from '../../lib/meetAttendance';
import {
  axisPosition,
  formatDuration,
  percent,
  spanBar,
  stamp,
  talkAxis,
  talkSummaryLine,
} from '../../lib/meetTalk';
import { formatNumber, t, type Locale, type MessageKey } from '../../lib/i18n';
import { useLocale } from '../../lib/i18n/react';
import {
  getLessonTalk,
  type TalkPerson,
  type TalkRecord,
  type TalkRole,
  type TalkState,
} from '../../services/api/meetTalk';
import { TalkGrid, type TalkFocus } from './TalkGrid';
import { TalkTranscript } from './TalkTranscript';
import '@/lib/i18n/catalogs/meet';

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

const STATE: Record<Exclude<TalkState, 'ready'>, MessageKey> = {
  off: 'meet.talkPanel.stateOff',
  waiting: 'meet.talkPanel.stateWaiting',
  none: 'meet.talkPanel.stateNone',
  no_room: 'meet.talkPanel.stateNoRoom',
  unavailable: 'meet.talkPanel.stateUnavailable',
  not_started: 'meet.talkPanel.stateNotStarted',
};

/** One decimal at most, in the reader's number format: "4.5" / «4,5». */
const decimal = (n: number, locale: Locale) => formatNumber(n, { maximumFractionDigits: 1 }, locale);

const BAR: Record<TalkRole, string> = {
  teacher: 'bg-violet-500 dark:bg-violet-400',
  student: 'bg-emerald-500 dark:bg-emerald-400',
  unknown: 'bg-amber-400 dark:bg-amber-500',
  other: 'bg-sky-500 dark:bg-sky-400',
};

export function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
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
export function SplitBar({ teacher, students, className }: { teacher: number | null | undefined; students: number | null | undefined; className?: string }) {
  const t = Math.max(0, Math.min(1, teacher ?? 0));
  const s = Math.max(0, Math.min(1 - t, students ?? 0));
  return (
    <div className={cn('flex h-2.5 overflow-hidden rounded-full bg-muted', className)} aria-hidden>
      <div className={BAR.teacher} style={{ width: `${t * 100}%` }} />
      <div className={BAR.student} style={{ width: `${s * 100}%` }} />
    </div>
  );
}

/** `columns`: 4 across a wide panel; 2 in a narrow column, where four would squeeze the labels. */
export function Headline({ talk, locale, columns = 4 }: { talk: TalkRecord; locale: Locale; columns?: 2 | 4 }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px] font-medium">
          <span className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', BAR.teacher)} aria-hidden />
            {t('meet.talkPanel.teacher', undefined, locale)} <span className="tabular-nums">{percent(talk.teacher_share)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            {t('meet.talkPanel.students', undefined, locale)} <span className="tabular-nums">{percent(talk.students_share)}</span>
            <span className={cn('h-2 w-2 rounded-full', BAR.student)} aria-hidden />
          </span>
        </div>
        <SplitBar teacher={talk.teacher_share} students={talk.students_share} />
      </div>
      <div className={cn('grid grid-cols-2 gap-3', columns === 4 && 'sm:grid-cols-4')}>
        <Stat label={t('meet.talkPanel.speech', undefined, locale)} value={formatDuration(talk.speech_seconds, locale)} />
        <Stat label={t('meet.talkPanel.silence', undefined, locale)} value={formatDuration(talk.silence_seconds, locale)} />
        {talk.longest_teacher_stretch_seconds != null && (
          <Stat label={t('meet.talkPanel.longest', undefined, locale)} value={formatDuration(talk.longest_teacher_stretch_seconds, locale)} />
        )}
        {talk.speaker_changes_per_10_min != null && (
          <Stat label={t('meet.talkPanel.changes', undefined, locale)}
            value={t('meet.talkPanel.per10', { value: decimal(talk.speaker_changes_per_10_min, locale) }, locale)} />
        )}
      </div>
    </div>
  );
}

export function Notes({ talk, locale }: { talk: TalkRecord; locale: Locale }) {
  const silent = talk.silent_students ?? [];
  return (
    <>
      {silent.length > 0 && (
        <p className="text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">{t('meet.talkPanel.didntSpeak', undefined, locale)}:</span> {silent.map((s) => s.name).join(', ')}
        </p>
      )}
      {(talk.source === 'voices' || talk.held_back) && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {t(talk.source === 'voices' ? 'meet.talkPanel.voices' : 'meet.talkPanel.heldBack', undefined, locale)}
        </p>
      )}
    </>
  );
}

export function Buckets({ talk, locale }: { talk: TalkRecord; locale: Locale }) {
  const buckets = talk.buckets ?? [];
  if (buckets.length === 0) return null;
  const every10 = t('meet.talkPanel.every10', undefined, locale);
  const base = new Date(talk.start).getTime();
  const at = (minute: number) => clock(new Date(base + minute * 60_000).toISOString());
  return (
    <div>
      <div className="mb-1 text-[11px] text-muted-foreground">{every10}</div>
      <div className="flex h-16 items-end gap-1" role="img" aria-label={every10}>
        {buckets.map((b, i) => {
          const next = buckets[i + 1]?.from_minute ?? Math.round((talk.lesson_seconds ?? 3600) / 60);
          const length = Math.max(60, (next - b.from_minute) * 60);
          return (
            <div
              key={b.from_minute}
              className="flex h-full min-w-0 flex-1 flex-col justify-end overflow-hidden rounded-sm bg-muted/50"
              title={t('meet.talkPanel.bucket', {
                from: at(b.from_minute), to: at(next),
                teacher: formatDuration(b.teacher_seconds, locale), students: formatDuration(b.students_seconds, locale),
              }, locale)}
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

export function Lanes({ talk }: { talk: TalkRecord }) {
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

export function Insights({ talk, locale, columns = 4 }: { talk: TalkRecord; locale: Locale; columns?: 2 | 4 }) {
  const i = talk.insights;
  if (!i) return null;
  const answeredShare = i.teacher_questions ? ` (${percent(i.answered / i.teacher_questions)})` : '';
  return (
    <Section title={t('meet.talkPanel.interaction', undefined, locale)}>
      <div className={cn('grid grid-cols-2 gap-3', columns === 4 && 'sm:grid-cols-4')}>
        <Stat label={t('meet.talkPanel.teacherQuestions', undefined, locale)} value={String(i.teacher_questions)} />
        <Stat label={t('meet.talkPanel.answered', undefined, locale)} value={`${i.answered}${answeredShare}`} />
        <Stat label={t('meet.talkPanel.medianWait', undefined, locale)}
          value={i.median_wait_seconds == null ? '—' : t('meet.duration.seconds', { seconds: decimal(i.median_wait_seconds, locale) }, locale)} />
        <Stat label={t('meet.talkPanel.studentQuestions', undefined, locale)} value={String(i.student_questions)} />
      </div>
    </Section>
  );
}

interface Props {
  talk: TalkRecord;
  /** When given, transcript lines play the recording from where they were said. */
  onSeek?: (recordingSeconds: number) => void;
  /** full: everything; compact: one line for the lesson card; public: no transcript, no insights. */
  variant?: 'full' | 'compact' | 'public';
  /** The signed-in user's by default; the watch-link page, read by accountants, passes 'ru'. */
  locale?: Locale;
  /** Admins see why a transcript failed. */
  showErrors?: boolean;
  className?: string;
}

/**
 * Who spoke in a lesson and for how long: the teacher against the students, each person, when
 * they spoke, how the class interacted — and, inside the LMS, the searchable transcript.
 */
export default function TalkPanel({ talk, onSeek, variant = 'full', locale: forced, showErrors = false, className }: Props) {
  const userLocale = useLocale();
  const locale = forced ?? userLocale;
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
    return <p className={cn('text-sm text-muted-foreground', className)}>{t(STATE[talk.state], undefined, locale)}</p>;
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
      <Headline talk={talk} locale={locale} />
      <Section
        title={t('meet.talkPanel.timeline', undefined, locale)}
        aside={(
          <div className="inline-flex gap-0.5 rounded-md border border-border bg-muted/40 p-0.5" role="group" aria-label={t('meet.talkPanel.timeline', undefined, locale)}>
            {(['blocks', 'exact'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
                className={cn('rounded px-2 py-0.5 text-[11px] font-medium transition',
                  view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {t(v === 'blocks' ? 'meet.talkPanel.blocks' : 'meet.talkPanel.exact', undefined, locale)}
              </button>
            ))}
          </div>
        )}
      >
        {view === 'blocks'
          ? <TalkGrid talk={talk} locale={locale} focus={focus} onPick={readable ? pick : undefined} />
          : (
            <>
              <Buckets talk={talk} locale={locale} />
              <Lanes talk={talk} />
            </>
          )}
        <Notes talk={talk} locale={locale} />
      </Section>
      {variant === 'full' && <Insights talk={talk} locale={locale} />}
      {variant === 'full' && (
        <div ref={transcriptRef} className="scroll-mt-4">
          <TalkTranscript transcript={talk.transcript} start={talk.start} locale={locale} onSeek={onSeek}
            showErrors={showErrors} focus={focus} onClearFocus={() => setFocus(null)} />
        </div>
      )}
    </div>
  );
}

/**
 * Talk time beside a recording: a one-line summary, and the full panel on request — the same
 * shape as the participants list next to it. Renders nothing unless there is something to read.
 */
export function TalkCard({ talk, locale: forced, onSeek, variant = 'full', showErrors = false, defaultOpen = false, className }: Omit<Props, 'variant'> & {
  variant?: 'full' | 'public';
  defaultOpen?: boolean;
}) {
  const userLocale = useLocale();
  const locale = forced ?? userLocale;
  const title = t('meet.talkCard.title', undefined, locale);
  const [open, setOpen] = useState(defaultOpen);
  if (talk.state !== 'ready' && talk.state !== 'waiting') return null;
  const ready = talk.state === 'ready';
  return (
    <section className={cn('rounded-xl border border-border bg-card', className)} aria-label={title}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
        <MessagesSquare className="h-4 w-4 flex-none text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <TalkPanel talk={talk} variant="compact" locale={locale} className="min-w-0" />
        {ready && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(open ? 'meet.talkCard.hide' : 'meet.talkCard.show', undefined, locale)}
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
