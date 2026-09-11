import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Download, Loader2, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { APP_TIMEZONE } from '../../lib/datetime';
import { clock } from '../../lib/meetAttendance';
import { formatDuration, groupTalkCsv, percent, sortGroupStudents, type GroupStudentSort } from '../../lib/meetTalk';
import { getGroupTalk, type GroupTalk } from '../../services/api/meetTalk';
import { SearchableSelect, type SearchableOption } from '../ui/searchable-select';

const DAY = 24 * 60 * 60 * 1000;

interface Props {
  /** The groups the viewer's lessons belong to. */
  groups: SearchableOption[];
  periodDays: number;
  /** The group the lessons list was filtered by, if any. */
  initialGroupId: string | null;
  /** The admin switch; while off (and nothing saved), the view says so. */
  talkEnabled: boolean;
  /** Open one lesson's talk time. */
  onOpenLesson: (eventId: number) => void;
}

const COLUMNS: { key: GroupStudentSort; label: string; hint?: string }[] = [
  { key: 'name', label: 'Student' },
  { key: 'lessons_in_room', label: 'In the room', hint: 'Lessons with talk time the student was in the room for' },
  { key: 'lessons_spoke', label: 'Spoke', hint: 'Lessons in which they said anything' },
  { key: 'silent_lessons', label: 'Silent', hint: 'Lessons in the room without a word' },
  { key: 'total_seconds', label: 'Total' },
  { key: 'avg_seconds', label: 'Per lesson', hint: 'Average per lesson in the room' },
  { key: 'share_of_student_talk', label: 'Share', hint: 'Of all the students’ talk in these lessons' },
  { key: 'questions', label: 'Questions', hint: 'Questions they asked (needs transcripts)' },
];

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: APP_TIMEZONE });
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate text-lg font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function ShareBar({ share, tone }: { share: number | null; tone: 'teacher' | 'student' }) {
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span
          className={cn('block h-full rounded-full', tone === 'teacher' ? 'bg-violet-500 dark:bg-violet-400' : 'bg-emerald-500 dark:bg-emerald-400')}
          style={{ width: `${Math.min(100, (share ?? 0) * 100)}%` }}
        />
      </span>
      <span className="w-9 text-right tabular-nums">{percent(share)}</span>
    </span>
  );
}

/**
 * One group's talk time over the period: who speaks in its lessons and who doesn't, the
 * teacher's share, and each lesson — the totals a head or curator reports on.
 */
export function GroupTalkView({ groups, periodDays, initialGroupId, talkEnabled, onOpenLesson }: Props) {
  const [groupId, setGroupId] = useState<string | null>(initialGroupId ?? (groups.length === 1 ? groups[0].value : null));
  const [data, setData] = useState<GroupTalk | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sort, setSort] = useState<{ key: GroupStudentSort; direction: 'asc' | 'desc' }>({ key: 'total_seconds', direction: 'desc' });

  useEffect(() => {
    setData(null);
    setError(false);
    if (!groupId) return;
    let cancelled = false;
    setLoading(true);
    getGroupTalk(Number(groupId), { date_from: new Date(Date.now() - periodDays * DAY).toISOString() })
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [groupId, periodDays, retry]);

  const students = useMemo(() => (data ? sortGroupStudents(data.students, sort.key, sort.direction) : []), [data, sort]);

  const pickSort = (key: GroupStudentSort) => setSort((s) => (
    s.key === key ? { key, direction: s.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: key === 'name' ? 'asc' : 'desc' }
  ));

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
        <SearchableSelect options={groups} value={groupId} onChange={setGroupId} placeholder="Choose a group"
          searchPlaceholder="Search groups…" emptyText="No group matches" className="h-9 w-64 text-sm" />
        <span className="text-xs text-muted-foreground">Last {periodDays} days · times are Almaty</span>
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
            : 'Choose a group to see who speaks in its lessons, who doesn’t, and how much of each lesson is the teacher.'}
        </div>
      )}

      {groupId && loading && (
        <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading talk time…
        </div>
      )}

      {groupId && error && (
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Lessons" value={String(data.totals.lessons)} />
            <Tile label="Teacher’s share, on average" value={percent(data.teacher.avg_share)} />
            <Tile label="Teacher spoke" value={formatDuration(data.totals.teacher_seconds)} />
            <Tile label="Students spoke" value={formatDuration(data.totals.student_seconds)} />
          </div>

          <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label="Students">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {COLUMNS.map((c) => {
                    const active = sort.key === c.key;
                    return (
                      <th key={c.key} className={cn('px-3 py-2.5', c.key === 'name' ? 'pl-4 text-left' : 'text-right')}
                        aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button type="button" onClick={() => pickSort(c.key)} title={c.hint}
                          className={cn('inline-flex items-center gap-1 uppercase tracking-wide hover:text-foreground', active && 'text-foreground')}>
                          {c.label}
                          {active && (sort.direction === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />)}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => (
                  <tr key={s.user_id} className={cn(s.lessons_spoke === 0 && s.lessons_in_room > 0 && 'bg-amber-50/50 dark:bg-amber-950/10')}>
                    <td className="py-2 pl-4 pr-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.lessons_in_room}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.lessons_spoke}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', s.silent_lessons > 0 ? 'font-semibold text-amber-700 dark:text-amber-300' : 'text-muted-foreground/60')}>
                      {s.silent_lessons || '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-foreground">{formatDuration(s.total_seconds)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatDuration(s.avg_seconds)}</td>
                    <td className="px-3 py-2 text-right text-xs"><ShareBar share={s.share_of_student_talk} tone="student" /></td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{s.questions ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm" aria-label="Lessons">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Lesson</th>
                  <th className="px-3 py-2.5">Teacher</th>
                  <th className="px-3 py-2.5 text-right">Teacher’s share</th>
                  <th className="px-3 py-2.5 text-right">Speech</th>
                  <th className="px-3 py-2.5 text-right">In the room</th>
                  <th className="px-3 py-2.5 text-right">Didn’t speak</th>
                  <th className="w-10 px-2 py-2.5" aria-label="Open" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.lessons.map((l) => (
                  <tr
                    key={l.event_id}
                    onClick={() => onOpenLesson(l.event_id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenLesson(l.event_id); } }}
                    tabIndex={0}
                    aria-label={`Open the talk time of ${l.title}`}
                    className="cursor-pointer transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                  >
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-foreground">{l.title}</div>
                      <div className="text-xs text-muted-foreground">{dayLabel(l.start)} · {clock(l.start)}</div>
                    </td>
                    <td className="px-3 py-2.5 text-foreground">{l.teacher_name ?? '—'}</td>
                    <td className="px-3 py-2.5 text-right text-xs"><ShareBar share={l.teacher_share} tone="teacher" /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">{formatDuration(l.speech_seconds)}</td>
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
        </>
      )}
    </div>
  );
}
