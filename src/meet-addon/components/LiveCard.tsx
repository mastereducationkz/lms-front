import { useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import LiveControls from '../../components/live-lesson/LiveControls';
import { useCountdown, useLiveLesson } from '../../lib/liveLesson/useLiveLesson';
import { SessionLost } from '../api';
import { panelLive, panelSocket, presenterUrl } from '../live';

/** «Live lesson» in the Meet side panel: polls, word clouds, pop-checks, the timer and the picker. */
export default function LiveCard({ lessonId, onSessionLost }: { lessonId: number; onSessionLost: () => void }) {
  const socket = useMemo(() => panelSocket(), []);
  const { state, error, now, act } = useLiveLesson({
    eventId: lessonId, api: panelLive, socket,
    onLost: (e) => { if (e instanceof SessionLost) { onSessionLost(); return true; } return false; },
  });
  const seconds = useCountdown(state, now);
  if (!state) {
    return error ? <p className="text-xs text-rose-700">{error}</p>
      : <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>;
  }
  return <LiveControls state={state} api={panelLive} seconds={seconds} act={act} presenterUrl={presenterUrl(lessonId)} socket={socket} />;
}
