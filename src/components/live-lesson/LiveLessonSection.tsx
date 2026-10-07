import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { useCountdown, useLiveLesson } from '../../lib/liveLesson/useLiveLesson';
import type { LessonView } from '../../services/api/classLessons';
import { live } from '../../services/api/liveLesson';
import { connectSocket } from '../../services/socket';
import LiveControls from './LiveControls';
import LiveRecordList from './LiveRecordList';
import { StarOfWeekDialog } from '../achievements/StarOfWeekDialog';

/**
 * «Activities» on `/lessons/:id`: while the lesson is on, whoever may run it gets the same controls as
 * the Meet panel; everyone else, and everyone afterwards, gets the record.
 */
export default function LiveLessonSection({ view }: { view: LessonView }) {
  if (view.live_lesson?.can_drive) return <Driver eventId={view.id} />;
  return <LiveRecordList eventId={view.id} api={live} />;
}

function Driver({ eventId }: { eventId: number }) {
  const socket = useMemo(() => connectSocket(), []);
  const { state, error, now, act } = useLiveLesson({ eventId, api: live, socket });
  const seconds = useCountdown(state, now);
  if (!state) {
    return error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
      : <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  return (
    <div className="space-y-4">
      <LiveControls state={state} api={live} seconds={seconds} act={act} presenterUrl={`/live/present/${eventId}`} socket={socket}
        renderStar={(student, groupId, close) => (
          <StarOfWeekDialog groupId={groupId} onClose={close} initialStudentId={student.user_id}
            students={(state.room ?? [student]).map((p) => ({ id: p.user_id, name: p.name ?? '' }))} />
        )} />
      <details className="rounded-xl border border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">Everything in this lesson so far</summary>
        <div className="mt-3"><LiveRecordList eventId={eventId} api={live} refreshKey={state.version} /></div>
      </details>
    </div>
  );
}
