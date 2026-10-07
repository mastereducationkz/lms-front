import { ArrowDown, ArrowUp, ChevronRight, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { clock } from '../../lib/meetAttendance';
import {
  answeredShare,
  formatDuration,
  lessonBarHeight,
  lessonBars,
  lessonBarSize,
  lessonMarkLabel,
  percent,
  perLesson,
} from '../../lib/meetTalk';
import type { GroupTalkLesson, StudentLessonMark, TalkQuestions } from '../../services/api/meetTalk';
import { formatDate } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

/**
 * The pieces the Talk time reports share: the summary cards, sortable headers, share bars, a
 * student's lesson sparkline, and the lessons table (a group's and a teacher's are the same table).
 */

export function dayLabel(iso: string): string {
  return formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Seconds as words, or a dash for nothing said — "0 s" read like a measurement. */
export function spokeFor(seconds: number | null | undefined): string {
  return seconds ? formatDuration(seconds) : '—';
}

export function Card({ label, value, sub, hint, tone, className, children }: {
  label: string;
  value?: string;
  sub?: string;
  hint?: string;
  tone?: 'warn';
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-border bg-card px-4 py-3', className)} title={hint}>
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {hint && <Info className="h-3 w-3 opacity-60" aria-hidden />}
      </div>
      {value !== undefined && (
        <div className={cn('truncate text-lg font-semibold tabular-nums text-foreground', tone === 'warn' && 'text-amber-700 dark:text-amber-300')}>
          {value}
        </div>
      )}
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      {children}
    </div>
  );
}

/** Teacher against students: minutes and shares over one bar. */
export function SplitCard({ teacherSeconds, studentSeconds, teacherShare, studentsShare, note, className }: {
  teacherSeconds: number;
  studentSeconds: number;
  teacherShare: number | null;
  studentsShare: number | null;
  note?: string;
  className?: string;
}) {
  const tr = useT();
  const t = Math.max(0, Math.min(1, teacherShare ?? 0));
  const s = Math.max(0, Math.min(1 - t, studentsShare ?? 0));
  return (
    <Card label={tr('meetViews.talkParts.whoTalked')} hint={tr('meetViews.talkParts.whoTalkedHint')} className={className}>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-sm font-semibold">
        <span className="text-violet-700 dark:text-violet-300">{tr('meet.talk.teacherShare', { share: percent(teacherShare) })}</span>
        <span className="text-right text-emerald-700 dark:text-emerald-300">{tr('meetViews.talkParts.studentsShare', { share: percent(studentsShare) })}</span>
      </div>
      <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="bg-violet-500 dark:bg-violet-400" style={{ width: `${t * 100}%` }} />
        <div className="bg-emerald-500 dark:bg-emerald-400" style={{ width: `${s * 100}%` }} />
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3 text-xs tabular-nums text-muted-foreground">
        <span>{formatDuration(teacherSeconds)}</span>
        <span className="text-right">{formatDuration(studentSeconds)}</span>
      </div>
      {note && <div className="mt-1 text-xs text-muted-foreground">{note}</div>}
    </Card>
  );
}

/** "Teacher asked" and "Students asked", from questions added up over lessons with a transcript. */
export function QuestionCards({ questions, lessons }: { questions: TalkQuestions | null | undefined; lessons: number }) {
  const t = useT();
  if (!questions) {
    return (
      <>
        <Card label={t('meetViews.talkParts.teacherAsked')} value="—" sub={t('meetViews.talkParts.needsTranscripts')} />
        <Card label={t('meetViews.talkParts.studentsAsked')} value="—" sub={t('meetViews.talkParts.needsTranscripts')} />
      </>
    );
  }
  const share = answeredShare(questions);
  const partial = questions.lessons_with_transcript < lessons
    ? ` · ${t('meetViews.talkParts.partial', { with: questions.lessons_with_transcript, count: lessons })}` : '';
  return (
    <>
      <Card
        label={t('meetViews.talkParts.teacherAsked')}
        hint={t('meetViews.talkParts.teacherAskedHint')}
        value={String(questions.teacher_questions)}
        sub={`${t('meetViews.talkParts.answered', { count: questions.answered })}${share == null ? '' : ` · ${percent(share)}`}${partial}`}
      />
      <Card
        label={t('meetViews.talkParts.studentsAsked')}
        hint={t('meetViews.talkParts.studentsAskedHint')}
        value={String(questions.student_questions)}
        sub={`${t('meetViews.talkParts.perLesson', { value: perLesson(questions.student_questions, questions.lessons_with_transcript) ?? 0 })}${partial}`}
      />
    </>
  );
}

export function ShareBar({ share, tone }: { share: number | null | undefined; tone: 'teacher' | 'student' }) {
  if (share == null) return <span className="text-muted-foreground/60">—</span>;
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={cn('block h-full rounded-full', tone === 'teacher' ? 'bg-violet-500 dark:bg-violet-400' : 'bg-emerald-500 dark:bg-emerald-400')}
          style={{ width: `${Math.min(100, share * 100)}%` }}
        />
      </span>
      <span className="w-9 text-right tabular-nums">{percent(share)}</span>
    </span>
  );
}

/** A sortable column header. */
export function SortHeader<K extends string>({ label, hint, column, sort, onSort, align = 'right', className }: {
  label: string;
  hint?: string;
  column: K;
  sort: { key: K; direction: 'asc' | 'desc' };
  onSort: (key: K) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  const active = sort.key === column;
  return (
    <th className={cn('px-3 py-2.5', align === 'left' ? 'text-left' : 'text-right', className)}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(column)} title={hint}
        className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground', active && 'text-foreground',
          align === 'right' && 'flex-row-reverse')}>
        {active && (sort.direction === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
        <span className={cn(hint && 'underline decoration-dotted decoration-muted-foreground/40 underline-offset-2')}>{label}</span>
      </button>
    </th>
  );
}

/** The next sort: the same column flips, a new one starts high-to-low (names A–Z). */
export function nextSort<K extends string>(current: { key: K; direction: 'asc' | 'desc' }, key: K, ascending: K[] = []) {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' as const : 'asc' as const };
  return { key, direction: ascending.includes(key) ? 'asc' as const : 'desc' as const };
}

const BAR_HEIGHT = 18; // px: the sparkline's full height
const BAR_SPACE = 200; // px: the width a sparkline fits into (≈ 13rem), however many lessons

/**
 * A student's lessons as one line of thin bars, oldest first: the taller, the longer they spoke;
 * a low amber stub for silent; a hollow tick for "in briefly"; a faint dash for not there. Bars
 * narrow as lessons add up, so 36 — and up to 48 — fit on one line; older ones are counted.
 * `peakSeconds` is the group's longest speech in one lesson, so every row is on one scale.
 */
export function LessonBars({ marks, peakSeconds }: { marks: StudentLessonMark[]; peakSeconds: number }) {
  const { shown, earlier } = lessonBars(marks);
  const { width, gap } = lessonBarSize(shown.length, BAR_SPACE);
  return (
    <span className="inline-flex items-end gap-1.5">
      {earlier > 0 && <span className="self-center whitespace-nowrap text-[10px] text-muted-foreground">+{earlier}</span>}
      <span className="flex items-end" style={{ gap, height: BAR_HEIGHT }} role="img"
        aria-label={shown.map((m) => lessonMarkLabel(m)).join('; ')}>
        {shown.map((m) => (
          <span key={m.event_id} title={lessonMarkLabel(m)} className="flex h-full flex-none flex-col justify-end" style={{ width }}>
            <LessonBar mark={m} peakSeconds={peakSeconds} />
          </span>
        ))}
      </span>
    </span>
  );
}

function LessonBar({ mark, peakSeconds }: { mark: StudentLessonMark; peakSeconds: number }) {
  if (mark.state === 'present') return <span className="h-1.5 w-full rounded-[1px] ring-1 ring-inset ring-muted-foreground/50" />;
  if (mark.state === 'absent') return <span className="h-0.5 w-full rounded-full bg-muted-foreground/40" />;
  const height = Math.max(2, Math.round(lessonBarHeight(mark, peakSeconds) * BAR_HEIGHT));
  return (
    <span className={cn('w-full rounded-t-[1px]', mark.state === 'spoke' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-amber-400 dark:bg-amber-500')}
      style={{ height }} />
  );
}

/** What the bars mean, once, under the table. */
export function DotsLegend() {
  const t = useT();
  const swatch = (className: string, height: number) => (
    <span className="flex h-3 w-2 flex-col justify-end"><span className={cn('w-full', className)} style={{ height }} /></span>
  );
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-muted-foreground">
      <span>{t('meetViews.talkParts.legendBars')}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="flex items-end gap-px">{swatch('rounded-t-[1px] bg-emerald-500', 5)}{swatch('rounded-t-[1px] bg-emerald-500', 12)}</span>
        {t('meetViews.talkParts.legendSpoke')}
      </span>
      <span className="inline-flex items-center gap-1.5">{swatch('rounded-t-[1px] bg-amber-400', 3)}{t('meetViews.talkParts.legendSilent')}</span>
      <span className="inline-flex items-center gap-1.5">{swatch('h-1.5 rounded-[1px] ring-1 ring-inset ring-muted-foreground/50', 6)}{t('meetViews.talkParts.legendBrief')}</span>
      <span className="inline-flex items-center gap-1.5">{swatch('rounded-full bg-muted-foreground/40', 2)}{t('meetViews.talkParts.legendAbsent')}</span>
      <span>{t('meetViews.talkParts.legendCap')}</span>
    </div>
  );
}

function QuestionCell({ lesson }: { lesson: GroupTalkLesson }) {
  const t = useT();
  if (lesson.teacher_questions == null) return <span className="text-muted-foreground/60">—</span>;
  const share = lesson.teacher_questions ? (lesson.answered ?? 0) / lesson.teacher_questions : null;
  return (
    <span title={lesson.median_wait_seconds != null ? t('meetViews.talkParts.medianWait', { seconds: lesson.median_wait_seconds }) : undefined}>
      <span className="font-medium text-foreground">{lesson.teacher_questions}</span>
      <span className="text-muted-foreground"> · {share == null ? '—' : percent(share)}</span>
    </span>
  );
}

/** A report's lessons, newest first; a row opens that lesson's talk time. */
export function TalkLessonsTable({ lessons, onOpenLesson, show }: {
  lessons: GroupTalkLesson[];
  onOpenLesson: (eventId: number) => void;
  /** The group view names the teacher; a teacher's view names the group. */
  show: 'teacher' | 'groups';
}) {
  const t = useT();
  return (
    <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label={t('meetViews.shared.lessons')}>
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5">{t('meet.dialog.lesson')}</th>
            <th className="px-3 py-2.5">{t(show === 'teacher' ? 'meet.talkPanel.teacher' : 'meetViews.shared.group')}</th>
            <th className="px-3 py-2.5 text-right">{t('meetViews.talkParts.teacherShare')}</th>
            <th className="px-3 py-2.5 text-right">{t('meet.talkPanel.speech')}</th>
            <th className="px-3 py-2.5 text-right" title={t('meetViews.talkParts.askedAnsweredHint')}>{t('meetViews.talkParts.askedAnswered')}</th>
            <th className="px-3 py-2.5 text-right" title={t('meetViews.talkParts.studentQuestionsHint')}>{t('meetViews.talkParts.studentsAsked')}</th>
            <th className="px-3 py-2.5 text-right">{t('meet.participants.room')}</th>
            <th className="px-3 py-2.5 text-right" title={t('meetViews.talkParts.silentHint')}>{t('meet.talkPanel.didntSpeak')}</th>
            <th className="w-10 px-2 py-2.5" aria-label={t('meetViews.shared.open')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {lessons.map((l) => (
            <tr
              key={l.event_id}
              onClick={() => onOpenLesson(l.event_id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenLesson(l.event_id); } }}
              tabIndex={0}
              aria-label={t('meetViews.talkParts.openTalk', { title: l.title })}
              className="cursor-pointer transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <td className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">{l.title}</span>
                  {l.source === 'voices' && (
                    <span title={t('meetViews.talkParts.voicesHint')}
                      className="rounded bg-amber-100 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {t('meetViews.talkParts.voices')}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">{dayLabel(l.start)} · {clock(l.start)}</div>
              </td>
              <td className="min-w-[10rem] px-3 py-2.5 text-foreground">
                {show === 'teacher' ? (l.teacher_name ?? '—') : ((l.groups ?? []).map((g) => g.name).join(', ') || '—')}
              </td>
              <td className="px-3 py-2.5 text-right text-xs"><ShareBar share={l.teacher_share} tone="teacher" /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatDuration(l.speech_seconds)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums"><QuestionCell lesson={l} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{l.student_questions ?? '—'}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{l.students_in_room}</td>
              <td className={cn('px-3 py-2.5 text-right tabular-nums', l.silent ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted-foreground/60')}>
                {l.silent || '—'}
              </td>
              <td className="px-2 py-2.5 text-muted-foreground"><ChevronRight className="h-4 w-4" aria-hidden /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
