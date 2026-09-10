import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { clock } from '../../lib/meetAttendance';
import { APP_TIMEZONE } from '../../lib/datetime';
import { MeetRecordView, recordStateText, useMeetRecord } from './MeetRecordView';

interface Props {
  eventId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: APP_TIMEZONE });
}

/** The full record of one lesson, wide enough for the timeline — with account chips to correct mistakes. */
export default function MeetAttendanceDialog({ eventId, open, onOpenChange }: Props) {
  const { record, loading, failed, busyId, confirm, confirmMany } = useMeetRecord(eventId, open);
  const stateText = recordStateText(record);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-none space-y-1 border-b border-border px-6 py-4 text-left">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Attendance in Meet</div>
          <DialogTitle className="text-lg font-bold leading-snug">{record?.title ?? 'Lesson'}</DialogTitle>
          <DialogDescription>
            {record ? `${dateLabel(record.start)} · ${clock(record.start)}–${clock(record.end)} (Almaty)` : ' '}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading who joined…
            </div>
          )}
          {failed && <p className="text-sm text-rose-600 dark:text-rose-400">Couldn&apos;t load the record. Try again in a moment.</p>}
          {!loading && !failed && record === null && eventId != null && (
            <p className="text-sm text-muted-foreground">This lesson&apos;s record isn&apos;t available to you.</p>
          )}
          {stateText && <p className="text-sm text-muted-foreground">{stateText}</p>}
          {record?.state === 'ready' && (
            <MeetRecordView record={record} busyId={busyId} onConfirm={confirm} onConfirmMany={confirmMany} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
