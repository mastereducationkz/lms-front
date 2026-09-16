import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { buildAxis, canMark, clock, isMismatch, rulesText } from '../../lib/meetAttendance';
import { useAuth } from '../../contexts/AuthContext';
import {
  applyMeetVerdicts,
  confirmMeetAccount,
  getMeetRecord,
  type MeetIdentity,
  type MeetPerson,
  type MeetRecord,
} from '../../services/api/meetAttendance';
import { lessonReviewing, type FlagReviewing } from './FlagReview';
import { MeetTimeline, type TimelineRow } from './MeetTimeline';
import { WhoIsThis } from './WhoIsThis';

/** Loads a lesson's record and saves confirmations and reviews; shared by the lesson card and the review dialog. */
export function useMeetRecord(eventId: number | null, enabled = true) {
  const { user } = useAuth();
  const [record, setRecord] = useState<MeetRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    setRecord(null);
    setFailed(false);
    if (eventId == null || !enabled) return;
    let cancelled = false;
    setLoading(true);
    getMeetRecord(eventId)
      .then((r) => { if (!cancelled) setRecord(r); })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId, enabled, generation]);

  const reload = useCallback(() => setGeneration((g) => g + 1), []);

  // A lesson waiting on Google Meet fills in by itself: look again every minute while the tab is in view.
  const waiting = record?.state === 'waiting';
  useEffect(() => {
    if (eventId == null || !enabled || !waiting) return;
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      getMeetRecord(eventId)
        .then((next) => { if (next && next.event_id === eventId) setRecord(next); })
        .catch(() => { /* the next minute tries again */ });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [eventId, enabled, waiting]);

  /** Confirm several accounts one after another (never in parallel: each is a write). */
  const confirmMany = useCallback(async (items: { participantId: number; identity: MeetIdentity }[]) => {
    if (items.length === 0) return;
    setBusyId(items[0].participantId);
    let saved = 0;
    try {
      for (const item of items) {
        setRecord(await confirmMeetAccount(item.participantId, item.identity));
        saved += 1;
      }
      toast.success(`Saved ${saved}`, { description: 'Recognised from now on in every lesson they join.' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save who this is', {
        description: saved ? `${saved} of ${items.length} were saved.` : undefined,
      });
    } finally {
      setBusyId(null);
    }
  }, []);

  const confirm = useCallback(async (participantId: number, identity: MeetIdentity) => {
    setBusyId(participantId);
    try {
      const next = await confirmMeetAccount(participantId, identity);
      setRecord(next);
      if (identity.user_id) toast.success('Saved', { description: 'Recognised from now on in every lesson it joins.' });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save who this is');
    } finally {
      setBusyId(null);
    }
  }, []);

  const options = record?.review_options;
  const reviewing = useMemo(
    () => (eventId == null ? undefined : lessonReviewing(eventId, user?.role, options, setRecord)),
    [eventId, user?.role, options],
  );

  // Meet's verdicts for the students nobody has marked — pressed by a person, never by itself.
  const [applying, setApplying] = useState(false);
  const applyVerdicts = useMemo(() => {
    if (eventId == null || !canMark(user?.role)) return undefined;
    return async () => {
      setApplying(true);
      try {
        const next = await applyMeetVerdicts(eventId);
        setRecord(next);
        toast.success('Marks saved from Meet', { description: 'Only students who had no mark. Change any of them in the journal.' });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not apply Meet’s verdicts');
      } finally {
        setApplying(false);
      }
    };
  }, [eventId, user?.role]);

  return { record, loading, failed, busyId, confirm, confirmMany, reload, reviewing, applyVerdicts, applying };
}

function personRow(p: MeetPerson, kind: TimelineRow['kind'], note?: string): TimelineRow {
  return {
    key: `u${p.user_id}`, userId: p.user_id, name: p.name, kind, mark: p.mark, presence: p, flags: p.flags,
    accounts: p.accounts, note, verdict: p.verdict,
  };
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' | 'warn' }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn(
        'truncate text-sm font-semibold tabular-nums',
        tone === 'bad' && 'text-rose-600 dark:text-rose-400',
        tone === 'warn' && 'text-amber-700 dark:text-amber-300',
      )}>
        {value}
      </div>
    </div>
  );
}

interface Props {
  record: MeetRecord;
  busyId: number | null;
  onConfirm: (participantId: number, identity: MeetIdentity) => void;
  onConfirmMany: (items: { participantId: number; identity: MeetIdentity }[]) => void;
  compact?: boolean;
  /** Flags the viewer may answer open a review form (from `useMeetRecord`). */
  reviewing?: FlagReviewing;
  /** Writes Meet's verdicts for unmarked students; only for viewers who may mark (from `useMeetRecord`). */
  onApplyVerdicts?: () => void;
  applying?: boolean;
}

/** "This lesson: 19:04–19:52, 36 of 48 min needed" — what the verdicts below were judged on. */
function clockText(record: MeetRecord): string | null {
  const c = record.clock;
  if (!c) return null;
  const how = c.follows_teacher ? '' : ' — by the timetable, the teacher wasn’t in the lesson';
  return `This lesson: ${clock(c.start)}–${clock(c.end)}, ${c.required_minutes} of ${c.held_minutes} min needed${how}.`;
}

/** A finished lesson's Meet record: the headline numbers, the accounts to confirm, the timeline. */
export function MeetRecordView({ record, busyId, onConfirm, onConfirmMany, compact = false, reviewing, onApplyVerdicts, applying = false }: Props) {
  const [showHidden, setShowHidden] = useState(false);
  const students = useMemo(() => record.students ?? [], [record.students]);
  const joined = students.filter((s) => s.sessions.length > 0).length;
  const teacher = record.teacher ?? null;
  const unknown = record.unknown ?? [];
  const notTracked = record.not_tracked ?? [];

  const rows: TimelineRow[] = useMemo(() => [
    ...(teacher ? [personRow(teacher, 'teacher')] : []),
    ...students.map((s) => personRow(s, 'student')),
    // Unconfirmed accounts are still real time in the room: shown, marked "?", until named.
    ...unknown.map((u): TimelineRow => ({
      key: `p${u.participant_id}`, name: u.display_name || 'No name shown', kind: 'unknown',
      presence: u, flags: [], accounts: [], note: u.kind === 'signed_in' ? 'Google account, not confirmed' : 'Guest, not confirmed',
    })),
    ...(record.others ?? []).map((o) => personRow(o, 'other', o.role === 'student' ? 'Student of another group' : o.role.replace('_', ' '))),
  ], [teacher, students, unknown, record.others]);
  const hiddenRows: TimelineRow[] = notTracked.map((n) => ({
    key: `p${n.participant_id}`, name: n.display_name || 'No name shown', kind: 'not_tracked',
    presence: n, flags: [], accounts: [n], note: 'Not a student',
  }));
  const axis = useMemo(
    () => buildAxis(record, [...rows.map((r) => r.presence), ...notTracked]),
    [record, rows, notTracked],
  );

  // Disagreements someone answered, apart from the open ones (a reviewed late is not one of them).
  const answered = (record.flags ?? []).filter((f) => f.review && isMismatch(f.code)).length;

  const teacherValue = teacher?.first_join
    ? `${clock(teacher.first_join)} → ${clock(teacher.last_leave)}`
    : record.held_back ? 'Not confirmed yet' : 'Not in the room';

  // Unmarked students Meet can already judge: what «Apply» would write, counted by verdict.
  const applicable = students.filter((s) => s.mark == null && s.verdict?.verdict);
  const applyCounts = (['present', 'late', 'absent'] as const)
    .map((v) => [v, applicable.filter((s) => s.verdict?.verdict === v).length] as const)
    .filter(([, n]) => n > 0)
    .map(([v, n]) => `${n} ${v}`)
    .join(', ');
  const legend = compact ? null : [rulesText(record.rules), clockText(record)].filter(Boolean).join(' ');

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        <Stat label="Teacher" value={teacherValue}
          tone={teacher && !teacher.first_join ? (record.held_back ? 'warn' : 'bad') : undefined} />
        <Stat label="Students in the room" value={`${joined} of ${students.length}${unknown.length ? ' confirmed' : ''}`} />
        <Stat label="Marks disagree"
          value={`${record.mismatches ?? 0}${answered ? ` · ${answered} answered` : ''}`}
          tone={record.mismatches ? 'bad' : undefined} />
        <Stat label="To confirm" value={String(unknown.length)} tone={unknown.length ? 'warn' : undefined} />
      </div>

      {record.held_back && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          Someone in the room isn&apos;t confirmed yet, so nobody is flagged as &ldquo;never joined&rdquo;, and Meet&apos;s
          &ldquo;absent&rdquo; and &ldquo;late&rdquo; wait, until they are.
        </p>
      )}
      {record.partial && (
        <p className="text-xs text-muted-foreground">Part of this lesson hasn&apos;t come through from Google yet; more may appear.</p>
      )}
      {legend && <p className="text-xs text-muted-foreground">{legend}</p>}
      {onApplyVerdicts && applicable.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
          <span className="min-w-0 flex-1">
            {applicable.length} {applicable.length === 1 ? 'student has' : 'students have'} no mark yet — Meet says {applyCounts}.
          </span>
          <button
            type="button"
            onClick={onApplyVerdicts}
            disabled={applying}
            title="Writes these marks into the journal. Students who already have a mark are left alone."
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-2.5 py-1 font-medium text-sky-900 transition hover:bg-sky-100 disabled:opacity-60 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-100 dark:hover:bg-sky-900"
          >
            {applying && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Apply Meet&apos;s verdicts ({applicable.length})
          </button>
        </div>
      )}

      <WhoIsThis accounts={unknown} candidates={record.candidates ?? []} busyId={busyId}
        onConfirm={onConfirm} onConfirmMany={onConfirmMany} />

      <MeetTimeline
        axis={axis}
        rows={showHidden ? [...rows, ...hiddenRows] : rows}
        compact={compact}
        onUnlink={compact ? undefined : (id) => onConfirm(id, {})}
        busy={busyId !== null}
        heldBack={Boolean(record.held_back)}
        reviewing={reviewing}
      />
      {notTracked.length > 0 && (
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          className="w-fit text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {showHidden ? 'Hide' : 'Show'} {notTracked.length} not a student
        </button>
      )}
    </div>
  );
}

/** What to say instead of a record: the lesson has not finished, or there is nothing to show. */
export function recordStateText(record: MeetRecord | null): string | null {
  if (!record) return null;
  switch (record.state) {
    case 'waiting': return 'Waiting for Google Meet to hand over the lesson’s call.';
    case 'none': return 'No one joined this lesson’s Meet room, or it wasn’t held in an LMS Meet room.';
    default: return null;
  }
}
