import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Download, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  answeredShare,
  formatDuration,
  percent,
  sortTeachers,
  teacherFigure,
  teachersCsv,
  teacherTalkCsv,
  type TeacherSort,
} from '../../lib/meetTalk';
import {
  getTeachersTalk,
  getTeacherTalk,
  TalkSwitchedOff,
  type TalkTally,
  type TeacherTalk,
  type TeachersTalk,
} from '../../services/api/meetTalk';
import { Card, QuestionCards, SortHeader, SplitCard, TalkLessonsTable, nextSort } from './TalkReportParts';

const DAY = 24 * 60 * 60 * 1000;

interface Props {
  periodDays: number;
  /** Open one lesson's talk time. */
  onOpenLesson: (eventId: number) => void;
  /** Show one group in «By group». */
  onOpenGroup: (groupId: number) => void;
}

type Load<T> = { state: 'loading' } | { state: 'ready'; data: T | null } | { state: 'off' } | { state: 'failed' };

function useReport<T>(fetch: (() => Promise<T | null>) | null, deps: unknown[]): [Load<T>, () => void] {
  const [load, setLoad] = useState<Load<T>>({ state: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!fetch) return;
    let cancelled = false;
    setLoad({ state: 'loading' });
    fetch()
      .then((data) => { if (!cancelled) setLoad({ state: 'ready', data }); })
      .catch((e) => { if (!cancelled) setLoad({ state: e instanceof TalkSwitchedOff ? 'off' : 'failed' }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, retry]);
  return [load, () => setRetry((n) => n + 1)];
}

function download(csv: string, name: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

const safe = (text: string) => text.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

function States<T>({ load, onRetry, what, children }: {
  load: Load<T>;
  onRetry: () => void;
  what: string;
  children: (data: T) => React.ReactNode;
}) {
  if (load.state === 'loading') {
    return <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading {what}…</div>;
  }
  if (load.state === 'off') {
    return <p className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">Talk time is switched off.</p>;
  }
  if (load.state === 'failed') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load {what}.</p>
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <RotateCcw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }
  if (load.data === null) return <p className="px-1 py-6 text-sm text-muted-foreground">This isn&apos;t available to you.</p>;
  return <>{children(load.data)}</>;
}

/** The metrics a teacher's row and a group's row share. */
const METRICS: { key: Exclude<TeacherSort, 'name'>; label: string; hint?: string }[] = [
  { key: 'lessons', label: 'Lessons' },
  { key: 'teacher_share', label: 'Teacher’s share', hint: 'Of all speech in the lesson, averaged over the lessons' },
  { key: 'teacher_seconds', label: 'Teacher / students', hint: 'Minutes each side spoke over the period' },
  { key: 'longest_stretch_seconds', label: 'Longest stretch', hint: 'The longest the teacher spoke with no student in between, averaged over lessons' },
  { key: 'questions_per_lesson', label: 'Asked / lesson', hint: 'Teacher questions per lesson with a transcript' },
  { key: 'answered_share', label: 'Answered', hint: 'Teacher questions a student answered within 20 seconds' },
  { key: 'student_questions_per_lesson', label: 'Students asked / lesson', hint: 'Student questions per lesson with a transcript' },
  { key: 'silent_per_lesson', label: 'Silent / lesson', hint: 'Students in the room 10+ minutes without a word, per lesson' },
];

function MetricCells({ row }: { row: TalkTally }) {
  const dash = <span className="text-muted-foreground/60">—</span>;
  const asked = teacherFigure(row, 'questions_per_lesson');
  const answered = answeredShare(row.questions);
  const students = teacherFigure(row, 'student_questions_per_lesson');
  const t = Math.max(0, Math.min(1, row.teacher_share ?? 0));
  return (
    <>
      <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{row.lessons}</td>
      <td className="px-3 py-2.5 text-right text-xs">
        {row.teacher_share == null ? dash : (
          <span className="flex items-center justify-end gap-2">
            <span className="flex h-1.5 w-16 overflow-hidden rounded-full bg-emerald-500/70 dark:bg-emerald-400/60" aria-hidden>
              <span className="h-full bg-violet-500 dark:bg-violet-400" style={{ width: `${t * 100}%` }} />
            </span>
            <span className="w-9 text-right tabular-nums">{percent(row.teacher_share)}</span>
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
        <span className="text-violet-700 dark:text-violet-300">{formatDuration(row.teacher_seconds)}</span>
        {' / '}
        <span className="text-emerald-700 dark:text-emerald-300">{formatDuration(row.student_seconds)}</span>
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatDuration(row.longest_stretch_seconds)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{asked ?? dash}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{answered == null ? dash : percent(answered)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{students ?? dash}</td>
      <td className={cn('px-3 py-2.5 text-right tabular-nums', row.silent_per_lesson ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted-foreground/60')}>
        {row.silent_per_lesson || '—'}
      </td>
    </>
  );
}

function TeachersTable({ data, onPick }: { data: TeachersTalk; onPick: (teacherId: number) => void }) {
  const [sort, setSort] = useState<{ key: TeacherSort; direction: 'asc' | 'desc' }>({ key: 'teacher_share', direction: 'desc' });
  const rows = useMemo(() => sortTeachers(data.teachers, sort.key, sort.direction), [data, sort]);
  const onSort = (key: TeacherSort) => setSort((s) => nextSort(s, key, ['name']));
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
        No lessons with talk time in this period. Talk time appears about half an hour after each lesson.
      </div>
    );
  }
  return (
    <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label="Teachers">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <SortHeader label="Teacher" column="name" sort={sort} onSort={onSort} align="left" className="pl-4" />
            {METRICS.map((m) => <SortHeader key={m.key} label={m.label} hint={m.hint} column={m.key} sort={sort} onSort={onSort} />)}
            <th className="w-10 px-2 py-2.5" aria-label="Open" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr
              key={r.teacher_id}
              onClick={() => onPick(r.teacher_id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r.teacher_id); } }}
              tabIndex={0}
              aria-label={`Open ${r.name}`}
              className="cursor-pointer transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <td className="min-w-[11rem] py-2.5 pl-4 pr-3">
                <div className="font-medium text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.groups} group{r.groups === 1 ? '' : 's'}</div>
              </td>
              <MetricCells row={r} />
              <td className="px-2 py-2.5 text-muted-foreground"><ChevronRight className="h-4 w-4" aria-hidden /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TeacherDetail({ data, onOpenLesson, onOpenGroup }: {
  data: TeacherTalk;
  onOpenLesson: (eventId: number) => void;
  onOpenGroup: (groupId: number) => void;
}) {
  const t = data.teacher;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SplitCard
          className="sm:col-span-2"
          teacherSeconds={t.teacher_seconds}
          studentSeconds={t.student_seconds}
          teacherShare={t.teacher_share}
          studentsShare={t.students_share}
          note={`${t.lessons} lesson${t.lessons === 1 ? '' : 's'} · ${t.groups} group${t.groups === 1 ? '' : 's'} · longest stretch ${formatDuration(t.longest_stretch_seconds)} on average`}
        />
        <QuestionCards questions={t.questions} lessons={t.lessons} />
        <Card
          label="Didn’t speak"
          hint="Students in the room 10+ minutes without a word, per lesson."
          value={`${t.silent_per_lesson} per lesson`}
          tone={t.silent_per_lesson ? 'warn' : undefined}
          sub={`of ${t.students_in_room_per_lesson} students in the room, on average`}
        />
      </div>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label="Groups">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pl-4 pr-3 text-left">Group</th>
              {METRICS.map((m) => <th key={m.key} className="px-3 py-2.5 text-right" title={m.hint}>{m.label}</th>)}
              <th className="w-24 px-2 py-2.5" aria-label="Open" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.groups.map((g) => (
              <tr key={g.group_id ?? 'none'}>
                <td className="min-w-[11rem] py-2.5 pl-4 pr-3 font-medium text-foreground">{g.name ?? 'No group'}</td>
                <MetricCells row={g} />
                <td className="px-2 py-2.5 text-right">
                  {g.group_id != null && (
                    <button type="button" onClick={() => onOpenGroup(g.group_id as number)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
                      Students <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <TalkLessonsTable lessons={data.lessons} onOpenLesson={onOpenLesson} show="groups" />
    </div>
  );
}

/**
 * Talk time by teacher, for heads (owner, 2026-09-11): every teacher side by side over the
 * period, and one teacher across all their groups — with each group and each lesson.
 */
export function TeacherTalkView({ periodDays, onOpenLesson, onOpenGroup }: Props) {
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const range = () => ({ date_from: new Date(Date.now() - periodDays * DAY).toISOString() });
  const [all, retryAll] = useReport<TeachersTalk>(() => getTeachersTalk(range()), [periodDays]);
  const [one, retryOne] = useReport<TeacherTalk>(
    teacherId == null ? null : () => getTeacherTalk(teacherId, range()), [teacherId, periodDays],
  );
  const picked = teacherId == null ? null : (one.state === 'ready' ? one.data : null);
  const pickedName = picked?.teacher.name
    ?? (all.state === 'ready' ? all.data?.teachers.find((r) => r.teacher_id === teacherId)?.name : undefined);
  const today = new Date().toISOString().slice(0, 10);

  const exportCsv = () => {
    if (teacherId == null && all.state === 'ready' && all.data) download(teachersCsv(all.data), `talk-time_teachers_${periodDays}d_${today}.csv`);
    if (picked) download(teacherTalkCsv(picked), `talk-time_${safe(picked.teacher.name)}_${periodDays}d_${today}.csv`);
  };
  const canExport = teacherId == null ? all.state === 'ready' && Boolean(all.data?.teachers.length) : Boolean(picked);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {teacherId == null ? (
          <span className="text-sm font-medium text-foreground">Every teacher</span>
        ) : (
          <>
            <button type="button" onClick={() => setTeacherId(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <ArrowLeft className="h-4 w-4" aria-hidden /> All teachers
            </button>
            <span className="text-sm font-semibold text-foreground">{pickedName ?? 'Teacher'}</span>
          </>
        )}
        <span className="text-xs text-muted-foreground">Last {periodDays} days · all their groups · times are Almaty</span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!canExport}
          title={teacherId == null ? 'Every teacher, as a spreadsheet' : 'This teacher’s groups and lessons, as a spreadsheet'}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </button>
      </div>

      {teacherId == null ? (
        <States load={all} onRetry={retryAll} what="the teachers">
          {(data) => <TeachersTable data={data} onPick={setTeacherId} />}
        </States>
      ) : (
        <States load={one} onRetry={retryOne} what="this teacher">
          {(data) => <TeacherDetail data={data} onOpenLesson={onOpenLesson} onOpenGroup={onOpenGroup} />}
        </States>
      )}
    </div>
  );
}
