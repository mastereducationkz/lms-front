import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { groupTalkCsv, marksSummary, percent, sortGroupStudents, spokeInText, type GroupStudentSort } from '../../lib/meetTalk';
import { getGroupTalk, TalkSwitchedOff, type GroupTalk } from '../../services/api/meetTalk';
import { SearchableSelect, type SearchableOption } from '../ui/searchable-select';
import {
  Card,
  DotsLegend,
  LessonDots,
  QuestionCards,
  ShareBar,
  SortHeader,
  SplitCard,
  TalkLessonsTable,
  nextSort,
  spokeFor,
} from './TalkReportParts';

const DAY = 24 * 60 * 60 * 1000;

interface Props {
  /** The groups the viewer's lessons belong to. */
  groups: SearchableOption[];
  periodDays: number;
  /** The group shown; the page keeps it so «By teacher» can open a group here. */
  groupId: string | null;
  onGroupChange: (groupId: string | null) => void;
  /** The admin switch; while off (and nothing saved), the view says so. */
  talkEnabled: boolean;
  /** Open one lesson's talk time. */
  onOpenLesson: (eventId: number) => void;
}

const COLUMNS: { key: GroupStudentSort; label: string; hint?: string; left?: boolean }[] = [
  { key: 'name', label: 'Student', left: true },
  { key: 'lessons_spoke', label: 'Lessons', hint: 'One dot per lesson with talk time, oldest first; sorted by how many they spoke in', left: true },
  { key: 'total_seconds', label: 'Spoke, total' },
  { key: 'avg_seconds', label: 'Avg / lesson', hint: 'Average over the lessons they were in the room for' },
  { key: 'share_of_student_talk', label: 'Share', hint: 'Of all the students’ talk in these lessons' },
  { key: 'questions', label: 'Asked', hint: 'Questions they asked in class (lines ending in a question mark). Needs transcripts.' },
  { key: 'answers', label: 'Answered', hint: 'Teacher questions they answered first, within 20 seconds. Needs transcripts.' },
];

/**
 * One group's talk time over the period: who speaks in its lessons and who doesn't, lesson by
 * lesson; how much of the talking is the teacher's; and the questions — the teacher's, how many
 * a student answered, and the students' own.
 */
export function GroupTalkView({ groups, periodDays, groupId, onGroupChange, talkEnabled, onOpenLesson }: Props) {
  const [data, setData] = useState<GroupTalk | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<'off' | 'failed' | null>(null);
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState<{ key: GroupStudentSort; direction: 'asc' | 'desc' }>({ key: 'total_seconds', direction: 'desc' });

  // One group only: nothing to choose.
  useEffect(() => {
    if (!groupId && groups.length === 1) onGroupChange(groups[0].value);
  }, [groupId, groups, onGroupChange]);

  useEffect(() => {
    setData(null);
    setError(null);
    if (!groupId) return;
    let cancelled = false;
    setLoading(true);
    getGroupTalk(Number(groupId), { date_from: new Date(Date.now() - periodDays * DAY).toISOString() })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e instanceof TalkSwitchedOff ? 'off' : 'failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupId, periodDays, retry]);

  const students = useMemo(() => (data ? sortGroupStudents(data.students, sort.key, sort.direction) : []), [data, sort]);
  const onSort = (key: GroupStudentSort) => setSort((s) => nextSort(s, key, ['name']));

  const silentTimes = students.reduce((n, s) => n + s.silent_lessons, 0);
  const silentStudents = students.filter((s) => s.silent_lessons > 0).length;
  const voices = data?.lessons.filter((l) => l.source === 'voices').length ?? 0;

  const exportCsv = () => {
    if (!data) return;
    const blob = new Blob([groupTalkCsv(data)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const safe = data.group.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    link.download = `talk-time_${safe}_${periodDays}d_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchableSelect options={groups} value={groupId} onChange={onGroupChange} placeholder="Choose a group"
          searchPlaceholder="Search groups…" emptyText="No group matches" className="h-9 w-64 text-sm" />
        <span className="text-xs text-muted-foreground">
          Last {periodDays} days{data ? ` · ${data.totals.lessons} lesson${data.totals.lessons === 1 ? '' : 's'}` : ''} · times are Almaty
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!data || data.lessons.length === 0}
          title="This group’s talk time, as a spreadsheet"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </button>
      </div>

      {!groupId && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
          {groups.length === 0
            ? 'No groups with lessons in LMS Meet rooms in this period.'
            : 'Choose a group to see who speaks in its lessons, who doesn’t, how much of each lesson is the teacher, and the questions asked.'}
        </div>
      )}

      {groupId && loading && (
        <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading talk time…
        </div>
      )}

      {groupId && error === 'off' && (
        <p className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
          Talk time is switched off.
        </p>
      )}

      {groupId && error === 'failed' && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the group&apos;s talk time.</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
        </div>
      )}

      {groupId && !loading && !error && data === null && (
        <p className="px-1 py-6 text-sm text-muted-foreground">This group&apos;s talk time isn&apos;t available to you.</p>
      )}

      {data && data.lessons.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center text-sm text-muted-foreground">
          {talkEnabled
            ? `No lessons of ${data.group.name} with talk time in the last ${periodDays} days. Talk time appears about half an hour after each lesson.`
            : 'Talk time is switched off, and nothing was saved for this group in this period.'}
        </div>
      )}

      {data && data.lessons.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <SplitCard
              className="sm:col-span-2"
              teacherSeconds={data.totals.teacher_seconds}
              studentSeconds={data.totals.student_seconds}
              teacherShare={data.teacher.avg_share}
              studentsShare={data.teacher.avg_share == null ? null : 1 - data.teacher.avg_share}
              note={`${data.totals.lessons} lesson${data.totals.lessons === 1 ? '' : 's'}${voices ? ` · ${voices} named by voice` : ''}`}
            />
            <QuestionCards questions={data.questions} lessons={data.totals.lessons} />
            <Card
              label="Didn’t speak"
              hint="Times a student was in the room 10+ minutes and never spoke."
              value={silentTimes ? `${silentTimes} time${silentTimes === 1 ? '' : 's'}` : 'Nobody'}
              tone={silentTimes ? 'warn' : undefined}
              sub={silentTimes ? `${silentStudents} of ${students.length} students, at least once` : 'Every student in the room said something'}
            />
          </div>

          <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label="Students">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {COLUMNS.map((c) => (
                    <SortHeader key={c.key} label={c.label} hint={c.hint} column={c.key} sort={sort} onSort={onSort}
                      align={c.left ? 'left' : 'right'} className={c.key === 'name' ? 'pl-4' : undefined} />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => {
                  const marks = s.lessons ?? [];
                  const neverSpoke = s.lessons_spoke === 0 && s.lessons_in_room > 0;
                  const neverThere = s.lessons_in_room === 0;
                  return (
                    <tr key={s.user_id} className={cn(neverSpoke && 'bg-amber-50/50 dark:bg-amber-950/10')}>
                      <td className="py-2 pl-4 pr-3">
                        <span className="font-medium text-foreground">{s.name}</span>
                        {neverSpoke && (
                          <span className="ml-2 rounded-full bg-amber-100 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                            Silent
                          </span>
                        )}
                        {neverThere && (
                          <span className="ml-2 rounded-full bg-muted px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Not in the room
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2" title={marks.length ? marksSummary(marks) : undefined}>
                        {marks.length > 0 ? (
                          <div className="flex flex-col gap-0.5">
                            <LessonDots marks={marks} />
                            <span className="text-[11px] text-muted-foreground">{spokeInText(marks)}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">spoke in {s.lessons_spoke} of {s.lessons_in_room}</span>
                        )}
                      </td>
                      <td className={cn('px-3 py-2 text-right tabular-nums', s.total_seconds ? 'font-semibold text-foreground' : 'text-muted-foreground/60')}>
                        {spokeFor(s.total_seconds)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{spokeFor(s.avg_seconds)}</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {s.total_seconds ? <ShareBar share={s.share_of_student_talk} tone="student" /> : <span className="text-muted-foreground/60">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.questions ? s.questions : <span className="text-muted-foreground/60">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.answers ? s.answers : <span className="text-muted-foreground/60">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
          <DotsLegend />
          {data.questions == null && (
            <p className="px-1 text-[11px] text-muted-foreground">
              Asked and Answered need lesson transcripts; none of these lessons has one yet.
            </p>
          )}

          <TalkLessonsTable lessons={data.lessons} onOpenLesson={onOpenLesson} show="teacher" />
          <p className="px-1 text-[11px] text-muted-foreground">
            Teacher&apos;s share is of all speech in the lesson ({percent(data.teacher.avg_share)} on average here).
            Answered: a student spoke within 20 seconds of the teacher&apos;s question.
          </p>
        </>
      )}
    </div>
  );
}
