import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { clock } from '../../lib/meetAttendance';
import { APP_TIMEZONE } from '../../lib/datetime';
import { useAuth } from '../../contexts/AuthContext';
import { MeetRecordView, recordStateText, useMeetRecord } from './MeetRecordView';
import TalkPanel, { useLessonTalk } from './TalkPanel';

export type MeetDialogTab = 'attendance' | 'talk';

interface Props {
  eventId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which tab the dialog opens on (the lesson card's «Talk time» opens the second). */
  initialTab?: MeetDialogTab;
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: APP_TIMEZONE });
}

/**
 * The full record of one lesson, wide enough for the timeline — with account chips to correct
 * mistakes — and, beside it, who spoke and for how long.
 */
export default function MeetAttendanceDialog({ eventId, open, onOpenChange, initialTab = 'attendance' }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<MeetDialogTab>(initialTab);
  useEffect(() => { if (open) setTab(initialTab); }, [open, eventId, initialTab]);

  const { record, loading, failed, busyId, confirm, confirmMany, reviewing } = useMeetRecord(eventId, open);
  const { talk, loading: talkLoading, failed: talkFailed } = useLessonTalk(eventId, open);
  const stateText = recordStateText(record);
  // A switched-off feature is only news to the admin who can switch it on.
  const showTalk = tab === 'talk' || (talk !== null && (talk.state !== 'off' || isAdmin));
  const start = record?.start ?? talk?.start;
  const end = record?.end ?? talk?.end;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="flex-none space-y-1 border-b border-border px-6 pb-3 pt-4 text-left">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Lesson in Meet</div>
          <DialogTitle className="text-lg font-bold leading-snug">{record?.title ?? talk?.title ?? 'Lesson'}</DialogTitle>
          <DialogDescription>
            {start && end ? `${dateLabel(start)} · ${clock(start)}–${clock(end)} (Almaty)` : ' '}
          </DialogDescription>
          {showTalk && (
            <Tabs value={tab} onValueChange={(v) => setTab(v as MeetDialogTab)} className="pt-2">
              <TabsList className="h-9">
                <TabsTrigger value="attendance" className="text-[13px]">Attendance</TabsTrigger>
                <TabsTrigger value="talk" className="text-[13px]">Talk time</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </DialogHeader>
        <div className="overflow-y-auto px-6 py-5">
          {tab === 'attendance' ? (
            <>
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
                <MeetRecordView record={record} busyId={busyId} onConfirm={confirm} onConfirmMany={confirmMany} reviewing={reviewing} />
              )}
            </>
          ) : (
            <>
              {talkLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading talk time…
                </div>
              )}
              {talkFailed && <p className="text-sm text-rose-600 dark:text-rose-400">Couldn&apos;t load the talk time. Try again in a moment.</p>}
              {!talkLoading && !talkFailed && talk === null && eventId != null && (
                <p className="text-sm text-muted-foreground">This lesson&apos;s talk time isn&apos;t available to you.</p>
              )}
              {talk && <TalkPanel talk={talk} variant="full" showErrors={isAdmin} />}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
