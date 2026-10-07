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
import type { MessageKey } from '../../lib/i18n';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/meet';
import '@/lib/i18n/catalogs/meetViews';

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

function States<T>({ load, onRetry, loadingText, failedText, children }: {
  load: Load<T>;
  onRetry: () => void;
  loadingText: string;
  failedText: string;
  children: (data: T) => React.ReactNode;
}) {
  const t = useT();
  if (load.state === 'loading') {
    return <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> {loadingText}</div>;
  }
  if (load.state === 'off') {
    return <p className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">{t('meet.talkPanel.stateOff')}</p>;
  }
  if (load.state === 'failed') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">{failedText}</p>
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
          <RotateCcw className="h-4 w-4" /> {t('common.retry')}
        </button>
      </div>
    );
  }
  if (load.data === null) return <p className="px-1 py-6 text-sm text-muted-foreground">{t('meetViews.teacherTalk.unavailable')}</p>;
  return <>{children(load.data)}</>;
}

/** The metrics a teacher's row and a group's row share. */
const METRICS: { key: Exclude<TeacherSort, 'name'>; label: MessageKey; hint?: MessageKey }[] = [
  { key: 'lessons', label: 'meetViews.shared.lessons' },
  { key: 'teacher_share', label: 'meetViews.talkParts.teacherShare', hint: 'meetViews.teacherTalk.shareHint' },
  { key: 'teacher_seconds', label: 'meetViews.teacherTalk.split', hint: 'meetViews.teacherTalk.splitHint' },
  { key: 'longest_stretch_seconds', label: 'meetViews.teacherTalk.longest', hint: 'meetViews.teacherTalk.longestHint' },
  { key: 'questions_per_lesson', label: 'meetViews.teacherTalk.askedPerLesson', hint: 'meetViews.teacherTalk.askedPerLessonHint' },
  { key: 'answered_share', label: 'meet.talkPanel.answered', hint: 'meetViews.teacherTalk.answeredHint' },
  { key: 'student_questions_per_lesson', label: 'meetViews.teacherTalk.studentsAskedPerLesson', hint: 'meetViews.teacherTalk.studentsAskedPerLessonHint' },
  { key: 'silent_per_lesson', label: 'meetViews.teacherTalk.silentPerLesson', hint: 'meetViews.teacherTalk.silentPerLessonHint' },
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
  const t = useT();
  const [sort, setSort] = useState<{ key: TeacherSort; direction: 'asc' | 'desc' }>({ key: 'teacher_share', direction: 'desc' });
  const rows = useMemo(() => sortTeachers(data.teachers, sort.key, sort.direction), [data, sort]);
  const onSort = (key: TeacherSort) => setSort((s) => nextSort(s, key, ['name']));
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
        {t('meetViews.teacherTalk.empty')}
      </div>
    );
  }
  return (
    <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label={t('meetViews.teacherTalk.teachers')}>
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <SortHeader label={t('meet.talkPanel.teacher')} column="name" sort={sort} onSort={onSort} align="left" className="pl-4" />
            {METRICS.map((m) => <SortHeader key={m.key} label={t(m.label)} hint={m.hint && t(m.hint)} column={m.key} sort={sort} onSort={onSort} />)}
            <th className="w-10 px-2 py-2.5" aria-label={t('meetViews.shared.open')} />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr
              key={r.teacher_id}
              onClick={() => onPick(r.teacher_id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(r.teacher_id); } }}
              tabIndex={0}
              aria-label={t('meetViews.shared.openNamed', { name: r.name })}
              className="cursor-pointer transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <td className="min-w-[11rem] py-2.5 pl-4 pr-3">
                <div className="font-medium text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">{t('common.groups', { count: r.groups })}</div>
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
  const tr = useT();
  const t = data.teacher;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @2xl:grid-cols-3 @5xl:grid-cols-5">
        <SplitCard
          className="sm:col-span-2"
          teacherSeconds={t.teacher_seconds}
          studentSeconds={t.student_seconds}
          teacherShare={t.teacher_share}
          studentsShare={t.students_share}
          note={[
            tr('common.lessons', { count: t.lessons }),
            tr('common.groups', { count: t.groups }),
            tr('meetViews.teacherTalk.longestAvg', { duration: formatDuration(t.longest_stretch_seconds) }),
          ].join(' · ')}
        />
        <QuestionCards questions={t.questions} lessons={t.lessons} />
        <Card
          label={tr('meet.talkPanel.didntSpeak')}
          hint={tr('meetViews.teacherTalk.silentHint')}
          value={tr('meetViews.talkParts.perLesson', { value: t.silent_per_lesson })}
          tone={t.silent_per_lesson ? 'warn' : undefined}
          sub={tr('meetViews.teacherTalk.ofInRoom', { count: t.students_in_room_per_lesson })}
        />
      </div>

      <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label={tr('meetViews.teacherTalk.groups')}>
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="py-2.5 pl-4 pr-3 text-left">{tr('meetViews.shared.group')}</th>
              {METRICS.map((m) => <th key={m.key} className="px-3 py-2.5 text-right" title={m.hint && tr(m.hint)}>{tr(m.label)}</th>)}
              <th className="w-24 px-2 py-2.5" aria-label={tr('meetViews.shared.open')} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.groups.map((g) => (
              <tr key={g.group_id ?? 'none'}>
                <td className="min-w-[11rem] py-2.5 pl-4 pr-3 font-medium text-foreground">{g.name ?? tr('meetViews.teacherTalk.noGroup')}</td>
                <MetricCells row={g} />
                <td className="px-2 py-2.5 text-right">
                  {g.group_id != null && (
                    <button type="button" onClick={() => onOpenGroup(g.group_id as number)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
                      {tr('meet.talkPanel.students')} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
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
  const t = useT();
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
          <span className="text-sm font-medium text-foreground">{t('meetViews.teacherTalk.everyTeacher')}</span>
        ) : (
          <>
            <button type="button" onClick={() => setTeacherId(null)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <ArrowLeft className="h-4 w-4" aria-hidden /> {t('meetViews.shared.allTeachers')}
            </button>
            <span className="text-sm font-semibold text-foreground">{pickedName ?? t('meet.talkPanel.teacher')}</span>
          </>
        )}
        <span className="text-xs text-muted-foreground">
          {[t('meetViews.shared.lastDays', { count: periodDays }), t('meetViews.teacherTalk.allTheirGroups'), t('meetViews.shared.timesAlmaty')].join(' · ')}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!canExport}
          title={t(teacherId == null ? 'meetViews.teacherTalk.exportAll' : 'meetViews.teacherTalk.exportOne')}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> {t('meetViews.shared.exportCsv')}
        </button>
      </div>

      {teacherId == null ? (
        <States load={all} onRetry={retryAll} loadingText={t('meetViews.teacherTalk.loadingTeachers')} failedText={t('meetViews.teacherTalk.failedTeachers')}>
          {(data) => <TeachersTable data={data} onPick={setTeacherId} />}
        </States>
      ) : (
        <States load={one} onRetry={retryOne} loadingText={t('meetViews.teacherTalk.loadingTeacher')} failedText={t('meetViews.teacherTalk.failedTeacher')}>
          {(data) => <TeacherDetail data={data} onOpenLesson={onOpenLesson} onOpenGroup={onOpenGroup} />}
        </States>
      )}
    </div>
  );
}
