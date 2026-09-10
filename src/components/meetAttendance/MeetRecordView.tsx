import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { buildAxis, clock } from '../../lib/meetAttendance';
import {
  confirmMeetAccount,
  getMeetRecord,
  type MeetIdentity,
  type MeetPerson,
  type MeetRecord,
} from '../../services/api/meetAttendance';
import { MeetTimeline, type TimelineRow } from './MeetTimeline';
import { WhoIsThis } from './WhoIsThis';

/** Loads a lesson's record and saves confirmations; shared by the lesson card and the review dialog. */
export function useMeetRecord(eventId: number | null, enabled = true) {
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

  return { record, loading, failed, busyId, confirm, reload };
}

function personRow(p: MeetPerson, kind: TimelineRow['kind'], note?: string): TimelineRow {
  return { key: `u${p.user_id}`, name: p.name, kind, mark: p.mark, presence: p, flags: p.flags, accounts: p.accounts, note };
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
  compact?: boolean;
}

/** A finished lesson's Meet record: the headline numbers, the accounts to confirm, the timeline. */
export function MeetRecordView({ record, busyId, onConfirm, compact = false }: Props) {
  const [showHidden, setShowHidden] = useState(false);
  const students = useMemo(() => record.students ?? [], [record.students]);
  const joined = students.filter((s) => s.sessions.length > 0).length;
  const teacher = record.teacher ?? null;
  const unknown = record.unknown ?? [];
  const notTracked = record.not_tracked ?? [];

  const rows: TimelineRow[] = useMemo(() => [
    ...(teacher ? [personRow(teacher, 'teacher')] : []),
    ...students.map((s) => personRow(s, 'student')),
    ...(record.others ?? []).map((o) => personRow(o, 'other', o.role === 'student' ? 'Student of another group' : o.role.replace('_', ' '))),
  ], [teacher, students, record.others]);
  const hiddenRows: TimelineRow[] = notTracked.map((n) => ({
    key: `p${n.participant_id}`, name: n.display_name || 'No name shown', kind: 'not_tracked',
    presence: n, flags: [], accounts: [n], note: 'Not a student',
  }));
  const axis = useMemo(
    () => buildAxis(record, [...rows.map((r) => r.presence), ...unknown, ...notTracked]),
    [record, rows, unknown, notTracked],
  );

  const teacherValue = teacher?.first_join ? `${clock(teacher.first_join)} → ${clock(teacher.last_leave)}` : 'Not in the room';

  return (
    <div className="flex flex-col gap-4">
      <div className={cn('grid gap-3', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        <Stat label="Teacher" value={teacherValue} tone={teacher && !teacher.first_join && !record.held_back ? 'bad' : undefined} />
        <Stat label="Students joined" value={`${joined} of ${students.length}`} />
        <Stat label="Marks disagree" value={String(record.mismatches ?? 0)} tone={record.mismatches ? 'bad' : undefined} />
        <Stat label="To confirm" value={String(unknown.length)} tone={unknown.length ? 'warn' : undefined} />
      </div>

      {record.held_back && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          Someone in the room isn&apos;t confirmed yet, so nobody is flagged as &ldquo;never joined&rdquo; until they are.
        </p>
      )}
      {record.partial && (
        <p className="text-xs text-muted-foreground">Part of this lesson hasn&apos;t come through from Google yet; more may appear.</p>
      )}

      <WhoIsThis accounts={unknown} candidates={record.candidates ?? []} busyId={busyId} onConfirm={onConfirm} />

      <MeetTimeline
        axis={axis}
        rows={showHidden ? [...rows, ...hiddenRows] : rows}
        compact={compact}
        onUnlink={compact ? undefined : (id) => onConfirm(id, {})}
        busy={busyId !== null}
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
    case 'waiting': return 'Who joined appears here about 20 minutes after the lesson ends.';
    case 'none': return 'No one joined this lesson’s Meet room, or it wasn’t held in an LMS Meet room.';
    default: return null;
  }
}
