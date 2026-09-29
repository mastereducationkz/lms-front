import { useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import PresenterStage from '../components/live-lesson/PresenterStage';
import { useCountdown, useLiveLesson } from '../lib/liveLesson/useLiveLesson';
import { live } from '../services/api/liveLesson';
import { connectSocket } from '../services/socket';

/**
 * `/live/present/:eventId` (owner, 2026-09-29): the full-screen view a teacher opens from the Meet
 * panel and shares in Meet. Staff only; it never names who answered what.
 */
export default function LivePresenterPage() {
  const { eventId } = useParams();
  const id = Number(eventId);
  const socket = useMemo(() => connectSocket(), []);
  const { state, error, now } = useLiveLesson({ eventId: Number.isFinite(id) ? id : null, api: live, socket });
  const seconds = useCountdown(state, now);
  useEffect(() => { document.title = state ? `Presenting · ${state.lesson.title}` : 'Presenter view'; }, [state]);
  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        {error ? <p className="max-w-md text-center text-lg">{error}</p> : <Loader2 className="h-6 w-6 animate-spin" />}
      </div>
    );
  }
  return <PresenterStage state={state} seconds={seconds} />;
}
