import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, ChevronRight, Download, Loader2, MonitorCheck, RotateCcw, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_TIMEZONE } from '../lib/datetime';
import {
  ISSUES,
  clearedByReview,
  clock,
  hasIssue,
  isMismatch,
  issueCounts,
  lessonHeadline,
  needsAttention,
  reportCsv,
  reviewedCount,
  tallyByTeacher,
  withoutReviewed,
  type IssueKey,
} from '../lib/meetAttendance';
import { SearchableSelect } from '../components/ui/searchable-select';
import { FlagChip, lessonReviewing } from '../components/meetAttendance/FlagReview';
import MeetAttendanceDialog from '../components/meetAttendance/MeetAttendanceDialog';
import { TeacherTallyTable } from '../components/meetAttendance/TeacherTallyTable';
import {
  listMeetRecords,
  type MeetFlagCode,
  type MeetLessonFlag,
  type MeetLessonSummary,
  type MeetRecord,
  type MeetReviewOptions,
} from '../services/api/meetAttendance';
import { useAuth } from '../contexts/AuthContext';

type Show = 'attention' | 'all';
type Period = 7 | 30;

const DAY = 24 * 60 * 60 * 1000;

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: APP_TIMEZONE });
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

// Student timing is listed by name only where it is what the list is filtered by.
const LISTED_TIMING: Partial<Record<IssueKey, MeetFlagCode>> = { students_late: 'late', left_early: 'left_early' };

/** The student flags a row spells out: marks that disagree, and the timing being filtered by. */
function studentFlagsFor(item: MeetLessonSummary, issue: IssueKey | null): MeetLessonFlag[] {
  const timing = issue ? LISTED_TIMING[issue] : undefined;
  return item.flags.filter((f) => f.role !== 'teacher' && (isMismatch(f.code) || f.code === timing));
}

type Audience = 'heads' | 'teacher' | 'curator';

const INTRO: Record<Audience, string> = {
  heads: 'Lessons held in LMS Meet rooms: marks that disagree with who was in the room, accounts still to confirm, and teachers who started late or ended early.',
  teacher: 'Your lessons held in LMS Meet rooms: who was in the room and when, marks that disagree with it, and students’ Google accounts to confirm — once each, then they’re recognised in every lesson.',
  curator: 'Your groups’ lessons held in LMS Meet rooms: who was in the room and when, marks that disagree with it, and students’ Google accounts to confirm — once each, then they’re recognised in every lesson.',
};

const EMPTY: Record<Audience, (days: number) => string> = {
  heads: (days) => `No lessons with a Meet record in the last ${days} days.`,
  teacher: (days) => `None of your lessons in the last ${days} days were held in an LMS Meet room. They appear here once they are.`,
  curator: (days) => `None of your groups’ lessons in the last ${days} days were held in an LMS Meet room. They appear here once they are.`,
};

/**
 * Lessons held in LMS Meet rooms, read against their marks: where the marks disagree with who
 * was in the room, accounts still to confirm, and teachers who started late or ended early.
 *
 * One page for everyone who may read the record; the backend decides which lessons each viewer
 * gets (heads: all; teachers: taught + own groups; curators: their groups). Teachers see their
 * own punctuality exactly as heads do — owner's decision, 2026-09-11.
 */
export default function MeetAttendanceReview() {
  const { user } = useAuth();
  const audience: Audience = user?.role === 'teacher' ? 'teacher' : user?.role === 'curator' ? 'curator' : 'heads';
  const [items, setItems] = useState<MeetLessonSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>(30);
  const [show, setShow] = useState<Show>('attention');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [issue, setIssue] = useState<IssueKey | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  // Reviewed flags are out of the list until asked for (owner, 2026-09-11).
  const [showReviewed, setShowReviewed] = useState(false);
  const [options, setOptions] = useState<MeetReviewOptions | undefined>(undefined);

  // `quiet` refreshes in place (after confirming accounts) instead of blanking the list.
  const load = useCallback((quiet = false) => {
    setError(false);
    if (!quiet) setItems(null);
    listMeetRecords({ date_from: new Date(Date.now() - period * DAY).toISOString() })
      .then((r) => { setItems(r.items); setOptions(r.review_options); })
      .catch(() => { if (!quiet) setError(true); });
  }, [period]);
  useEffect(() => load(), [load]);

  // A review saved from the list returns the lesson's record: its row takes the new flags.
  const applyRecord = useCallback((record: MeetRecord) => {
    setItems((prev) => prev?.map((i) => (i.event_id !== record.event_id ? i : {
      ...i,
      flags: record.flags ?? [],
      mismatches: record.mismatches ?? 0,
      reviewed: record.reviewed ?? 0,
      unknown: record.unknown?.length ?? i.unknown,
    })) ?? prev);
  }, []);
  const reviewingFor = useCallback(
    (eventId: number) => lessonReviewing(eventId, user?.role, options, applyRecord),
    [user?.role, options, applyRecord],
  );

  const teachers = useMemo(() => {
    const seen = new Map<number, string>();
    (items ?? []).forEach((i) => { if (i.teacher) seen.set(i.teacher.id, i.teacher.name); });
    return [...seen].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => byName({ name: a.label }, { name: b.label }));
  }, [items]);
  const groups = useMemo(() => {
    const seen = new Map<number, string>();
    (items ?? []).forEach((i) => i.groups.forEach((g) => seen.set(g.id, g.name)));
    return [...seen].map(([id, name]) => ({ value: String(id), label: name })).sort((a, b) => byName({ name: a.label }, { name: b.label }));
  }, [items]);

  // Group and search narrow everything, the by-teacher summary included; the teacher filter and
  // the issue narrow the list below it (the summary is how you pick those).
  const base = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (items ?? []).filter((i) => {
      if (groupId && !i.groups.some((g) => String(g.id) === groupId)) return false;
      const hay = `${i.title} ${i.teacher?.name ?? ''} ${i.groups.map((g) => g.name).join(' ')} ${i.flags.map((f) => f.name).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, groupId, query]);
  const scoped = useMemo(
    () => (teacherId ? base.filter((i) => String(i.teacher?.id) === teacherId) : base),
    [base, teacherId],
  );
  // Everything below reads the lessons without their reviewed flags, unless «Show reviewed» is on.
  const listed = useMemo(() => (showReviewed ? scoped : scoped.map(withoutReviewed)), [scoped, showReviewed]);
  const tally = useMemo(() => tallyByTeacher(showReviewed ? base : base.map(withoutReviewed)), [base, showReviewed]);
  const counts = useMemo(() => issueCounts(listed), [listed]);
  const reviewedTotal = useMemo(() => reviewedCount(scoped), [scoped]);
  const inAttention = useCallback(
    (i: MeetLessonSummary) => needsAttention(i) || (showReviewed && clearedByReview(i)),
    [showReviewed],
  );
  const attentionCount = listed.filter(inAttention).length;
  // An issue picked is its own view; otherwise "needs attention" or everything.
  const visible = useMemo(() => listed.filter((i) => (
    issue ? hasIssue(i, issue) : show === 'all' || inAttention(i)
  )), [listed, issue, show, inAttention]);

  const filtered = Boolean(teacherId || groupId || query || issue);

  const exportCsv = () => {
    const blob = new Blob([reportCsv(visible)], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const today = new Date().toISOString().slice(0, 10);
    link.download = `meet-attendance_${period}d_${today}${issue ? `_${issue}` : ''}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <MonitorCheck className="h-7 w-7 text-primary" aria-hidden />
            Meet attendance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {INTRO[audience]} Click a flag to answer it: with its reason it leaves Needs attention. Times are Almaty.
          </p>
        </div>
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Period">
          {([7, 30] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={cn('rounded-md px-3 py-1.5 text-[13px] font-medium transition',
                period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              Last {p} days
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Show">
          {([['attention', 'Needs attention', attentionCount], ['all', 'All lessons', scoped.length]] as const).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              aria-pressed={!issue && show === key}
              onClick={() => { setShow(key); setIssue(null); }}
              className={cn('rounded-md px-2.5 py-1 text-[13px] font-medium transition',
                !issue && show === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {label} <span className="tabular-nums text-muted-foreground">{n}</span>
            </button>
          ))}
        </div>
        {(reviewedTotal > 0 || showReviewed) && (
          <button
            type="button"
            aria-pressed={showReviewed}
            onClick={() => setShowReviewed((v) => !v)}
            title="Flags someone has already answered, with their reasons"
            className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-medium transition',
              showReviewed
                ? 'border-slate-400 bg-slate-100 text-slate-800 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground')}
          >
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            {showReviewed ? 'Showing reviewed' : 'Show reviewed'}
            <span className="tabular-nums opacity-70">{reviewedTotal}</span>
          </button>
        )}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="meet-attendance-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lessons, groups, students"
            aria-label="Search lessons, groups, students"
            className="h-9 w-full rounded-md border border-border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {/* A teacher's own list usually has one teacher in it; the filter only earns its place
            when substitutes covered some of their groups' lessons. */}
        {teachers.length > 1 && (
          <SearchableSelect options={teachers} value={teacherId} onChange={setTeacherId} placeholder="All teachers"
            searchPlaceholder="Search teachers…" emptyText="No teacher matches" className="h-9 w-48 text-sm" />
        )}
        <SearchableSelect options={groups} value={groupId} onChange={setGroupId} placeholder="All groups"
          searchPlaceholder="Search groups…" emptyText="No group matches" className="h-9 w-56 text-sm" />
        {filtered && (
          <button
            type="button"
            onClick={() => { setTeacherId(null); setGroupId(null); setQuery(''); setIssue(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

      {items !== null && items.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by issue">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Issue</span>
          {ISSUES.map(({ key, label, hint }) => {
            const active = issue === key;
            const none = counts[key] === 0;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                title={hint}
                disabled={none && !active}
                onClick={() => setIssue(active ? null : key)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-muted',
                  none && !active && 'cursor-default opacity-40 hover:bg-card',
                )}
              >
                {label} <span className={cn('tabular-nums', active ? 'opacity-80' : 'text-muted-foreground')}>{counts[key]}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={exportCsv}
            disabled={visible.length === 0}
            title="The lessons listed below, as a spreadsheet"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
          </button>
        </div>
      )}

      {audience !== 'teacher' && items !== null && (
        <TeacherTallyTable
          rows={tally}
          onPick={(id, pick) => { setTeacherId(String(id)); setIssue(pick); if (!pick) setShow('all'); }}
        />
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-14 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Couldn&apos;t load the lessons.</p>
          <button type="button" onClick={() => load()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
        </div>
      )}

      {!error && items === null && (
        <div className="flex items-center gap-2 px-1 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading lessons…
        </div>
      )}

      {!error && items !== null && (
        visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? EMPTY[audience](period)
              : show === 'attention' && !filtered
                ? reviewedTotal > 0 && !showReviewed
                  ? `Nothing needs attention. ${reviewedTotal} reviewed ${reviewedTotal === 1 ? 'flag is' : 'flags are'} hidden; «Show reviewed» brings them back.`
                  : 'Nothing needs attention: every mark agrees with the room and every account is confirmed.'
                : issue
                  ? `No lessons with “${ISSUES.find((i) => i.key === issue)?.label}” here.`
                  : 'No lessons match.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5">Lesson</th>
                  <th className="px-4 py-2.5">Teacher in the room</th>
                  <th className="px-4 py-2.5 text-right">Students</th>
                  <th className="px-4 py-2.5">What stands out</th>
                  <th className="w-10 px-2 py-2.5" aria-label="Open" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((item) => {
                  const teacherFlags = item.flags.filter((f) => f.role === 'teacher');
                  const studentFlags = studentFlagsFor(item, issue);
                  const reviewing = reviewingFor(item.event_id);
                  return (
                    <tr
                      key={item.event_id}
                      onClick={() => setOpenId(item.event_id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(item.event_id); } }}
                      tabIndex={0}
                      aria-label={`Open ${item.title}`}
                      className="cursor-pointer align-top transition hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{item.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {dayLabel(item.start)} · {clock(item.start)}–{clock(item.end)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-foreground">{item.teacher?.name ?? '—'}</div>
                        <div className="text-xs tabular-nums text-muted-foreground">
                          {item.teacher?.first_join
                            ? `${clock(item.teacher.first_join)} → ${clock(item.teacher.last_leave)}`
                            : item.held_back ? 'Account not confirmed yet' : 'Not in the room'}
                        </div>
                        {teacherFlags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {teacherFlags.map((f) => (
                              <FlagChip key={f.code} flag={f} userId={f.user_id} personName={f.name} reviewing={reviewing} />
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-semibold text-foreground">{item.joined}</span>
                        <span className="text-muted-foreground"> / {item.students}</span>
                        {item.unknown > 0 && (
                          <div className="text-xs text-amber-700 dark:text-amber-300">+{item.unknown} unconfirmed</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className={cn('text-[13px]', needsAttention(item) ? 'text-foreground' : 'text-muted-foreground')}>
                          {lessonHeadline(item)}
                        </div>
                        {studentFlags.length > 0 && (
                          <ul className="mt-1.5 space-y-1 text-xs">
                            {studentFlags.slice(0, 6).map((f) => (
                              <li key={`${f.user_id}-${f.code}`} className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
                                <span className="text-foreground">{f.name}</span>
                                <FlagChip flag={f} userId={f.user_id} personName={f.name} reviewing={reviewing}
                                  lateToo={item.flags.some((g) => g.user_id === f.user_id && g.code === 'late')} />
                              </li>
                            ))}
                            {studentFlags.length > 6 && (
                              <li className="text-muted-foreground">and {studentFlags.length - 6} more: open the lesson</li>
                            )}
                          </ul>
                        )}
                      </td>
                      <td className="px-2 py-3 text-muted-foreground"><ChevronRight className="h-4 w-4" aria-hidden /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      <MeetAttendanceDialog
        eventId={openId}
        open={openId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setOpenId(null);
            load(true); // confirmations inside change this list
          }
        }}
      />
    </div>
  );
}
