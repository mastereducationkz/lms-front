import { useState } from 'react';
import { Loader2, Maximize2, UsersRound } from 'lucide-react';
import MeetAttendanceDialog from '../meetAttendance/MeetAttendanceDialog';
import { MeetRecordView, recordStateText, useMeetRecord } from '../meetAttendance/MeetRecordView';
import type { Event } from '../../types';

/** Who may read a lesson's Meet record — the backend's rule, so the card doesn't ask in vain. */
const RECORD_ROLES = new Set(['admin', 'head_curator', 'head_teacher', 'teacher', 'curator']);

interface Props {
  event: Event;
  role: string | undefined;
}

function isMeetLesson(event: Event): boolean {
  return event.event_type === 'class' && /meet\.google\.com\//i.test(event.meeting_url ?? '');
}

function hasFinished(event: Event): boolean {
  const end = new Date(event.end_datetime ?? event.start_datetime).getTime();
  return Number.isFinite(end) && end < Date.now();
}

/**
 * The lesson card's "Attendance in Meet": the compact record, and a way into the full one.
 *
 * Asks nothing for students, for lessons without a Meet room, or for lessons not over yet —
 * most of a calendar is exactly those. A 404 (not this viewer's lesson) renders nothing.
 */
export default function MeetAttendanceSection({ event, role }: Props) {
  const wanted = RECORD_ROLES.has(role ?? '') && isMeetLesson(event) && hasFinished(event);
  const { record, loading, busyId, confirm, reload } = useMeetRecord(event.id, wanted);
  const [expanded, setExpanded] = useState(false);

  if (!wanted) return null;
  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 flex-none animate-spin" />
        <span>Checking who joined…</span>
      </div>
    );
  }
  if (!record || !['ready', 'waiting', 'none'].includes(record.state)) return null;
  const stateText = recordStateText(record);

  return (
    <section className="mt-4 border-t border-border pt-4" aria-label="Attendance in Meet">
      <div className="mb-3 flex items-center gap-2">
        <UsersRound className="h-4 w-4 flex-none text-muted-foreground/70" aria-hidden />
        <h3 className="text-sm font-semibold">Attendance in Meet</h3>
        {record.state === 'ready' && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            Full record
          </button>
        )}
      </div>
      {stateText && <p className="text-sm text-muted-foreground">{stateText}</p>}
      {record.state === 'ready' && <MeetRecordView record={record} busyId={busyId} onConfirm={confirm} compact />}
      <MeetAttendanceDialog
        eventId={event.id}
        open={expanded}
        onOpenChange={(open) => {
          setExpanded(open);
          if (!open) reload(); // corrections made in the full record show here too
        }}
      />
    </section>
  );
}
