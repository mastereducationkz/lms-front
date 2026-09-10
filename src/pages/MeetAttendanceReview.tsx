import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronRight, Loader2, MonitorCheck, RotateCcw, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { APP_TIMEZONE } from '../lib/datetime';
import { clock, flagText, isMismatch, lessonHeadline } from '../lib/meetAttendance';
import { SearchableSelect } from '../components/ui/searchable-select';
import { FlagChip } from '../components/meetAttendance/MeetTimeline';
import MeetAttendanceDialog from '../components/meetAttendance/MeetAttendanceDialog';
import { listMeetRecords, type MeetLessonSummary } from '../services/api/meetAttendance';

type Show = 'attention' | 'all';
type Period = 7 | 30;

const DAY = 24 * 60 * 60 * 1000;

function needsAttention(item: MeetLessonSummary): boolean {
  return item.mismatches > 0 || item.unknown > 0 || item.flags.some((f) => f.role === 'teacher');
}

function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: APP_TIMEZONE });
}

function byName(a: { name: string }, b: { name: string }) {
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Lessons held in LMS Meet rooms, read against their marks: where the marks disagree with who
 * was in the room, accounts still to confirm, and teachers who started late or ended early.
 */
export default function MeetAttendanceReview() {
  const [items, setItems] = useState<MeetLessonSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>(30);
  const [show, setShow] = useState<Show>('attention');
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  // `quiet` refreshes in place (after confirming accounts) instead of blanking the list.
  const load = useCallback((quiet = false) => {
    setError(false);
    if (!quiet) setItems(null);
    listMeetRecords({ date_from: new Date(Date.now() - period * DAY).toISOString() })
      .then((r) => setItems(r.items))
      .catch(() => { if (!quiet) setError(true); });
  }, [period]);
  useEffect(() => load(), [load]);

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

  const attentionCount = (items ?? []).filter(needsAttention).length;
  const visible = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return (items ?? []).filter((i) => {
      if (show === 'attention' && !needsAttention(i)) return false;
      if (teacherId && String(i.teacher?.id) !== teacherId) return false;
      if (groupId && !i.groups.some((g) => String(g.id) === groupId)) return false;
      const hay = `${i.title} ${i.teacher?.name ?? ''} ${i.groups.map((g) => g.name).join(' ')} ${i.flags.map((f) => f.name).join(' ')}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [items, show, teacherId, groupId, query]);

  const filtered = Boolean(teacherId || groupId || query);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            <MonitorCheck className="h-7 w-7 text-primary" aria-hidden />
            Meet attendance
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Lessons held in LMS Meet rooms: marks that disagree with who was in the room, accounts still to
            confirm, and teachers who started late or ended early. Times are Almaty.
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
          {([['attention', 'Needs attention', attentionCount], ['all', 'All lessons', items?.length ?? 0]] as const).map(([key, label, n]) => (
            <button
              key={key}
              type="button"
              aria-pressed={show === key}
              onClick={() => setShow(key)}
              className={cn('rounded-md px-2.5 py-1 text-[13px] font-medium transition',
                show === key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {label} <span className="tabular-nums text-muted-foreground">{n}</span>
            </button>
          ))}
        </div>
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
        <SearchableSelect options={teachers} value={teacherId} onChange={setTeacherId} placeholder="All teachers"
          searchPlaceholder="Search teachers…" emptyText="No teacher matches" className="h-9 w-48 text-sm" />
        <SearchableSelect options={groups} value={groupId} onChange={setGroupId} placeholder="All groups"
          searchPlaceholder="Search groups…" emptyText="No group matches" className="h-9 w-56 text-sm" />
        {filtered && (
          <button
            type="button"
            onClick={() => { setTeacherId(null); setGroupId(null); setQuery(''); }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </button>
        )}
      </div>

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
              ? `No lessons with a Meet record in the last ${period} days.`
              : show === 'attention' && !filtered
                ? 'Nothing needs attention: every mark agrees with the room and every account is confirmed.'
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
                  const studentMismatches = item.flags.filter((f) => f.role !== 'teacher' && isMismatch(f.code));
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
                          {item.teacher?.first_join ? `${clock(item.teacher.first_join)} → ${clock(item.teacher.last_leave)}` : 'Not in the room'}
                        </div>
                        {teacherFlags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">{teacherFlags.map((f) => <FlagChip key={f.code} flag={f} />)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className="font-semibold text-foreground">{item.joined}</span>
                        <span className="text-muted-foreground"> / {item.students}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={cn('text-[13px]', needsAttention(item) ? 'text-foreground' : 'text-muted-foreground')}>
                          {lessonHeadline(item)}
                        </div>
                        {studentMismatches.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-rose-700 dark:text-rose-300">
                            {studentMismatches.slice(0, 4).map((f) => (
                              <li key={`${f.user_id}-${f.code}`}>{f.name}: {flagText(f).toLowerCase()}</li>
                            ))}
                            {studentMismatches.length > 4 && <li>and {studentMismatches.length - 4} more</li>}
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
