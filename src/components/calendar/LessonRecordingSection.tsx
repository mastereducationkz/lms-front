import { useEffect, useState } from 'react';
import { Loader2, Play, Video } from 'lucide-react';
import HlsVideoPlayer from '../HlsVideoPlayer';
import { RecordingStatusCard } from '../recordings/RecordingProgress';
import { getLessonRecording, type LessonRecording } from '../../services/api/recordings';
import type { Event } from '../../types';
import { formatClock, recordingsLocale } from '../../lib/recordings';
import { pollInterval, progressFor } from '../../lib/recordingProgress';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
  event: Event;
}

/** Only lessons that have actually finished can have a recording. */
function hasFinished(event: Event): boolean {
  const end = new Date(event.end_datetime ?? event.start_datetime);
  return Number.isFinite(end.getTime()) && end.getTime() < Date.now();
}

/**
 * The recording of a finished lesson, inside the lesson dialog.
 *
 * Four deliberate choices:
 *
 * **Nothing is requested for a lesson that has not ended.** Opening any future lesson
 * would otherwise fire a request that can only ever answer "missing", on a calendar where
 * most lessons are in the future.
 *
 * **"missing" renders nothing at all.** The backend answers 404 to viewers outside the
 * group and the client maps that to `missing`, so this state means both "never recorded"
 * and "not yours to see". Rendering an empty state would tell a student in another group
 * that a recording exists — the exact thing the 404 exists to prevent.
 *
 * **A recording on its way says where it is, and fills in by itself** (2026-09-15): waiting on
 * Google Meet, in line, which step and how far — asked again at the stage's pace while the
 * dialog is open and the tab in view, until it is ready.
 *
 * **The video only loads once the student asks for it.** The signed URL is already in
 * hand, but mounting a player per dialog open would start fetching HLS segments for
 * anyone who merely clicked a lesson to check its time.
 */
export default function LessonRecordingSection({ event }: Props) {
  const { user } = useAuth();
  const [recording, setRecording] = useState<LessonRecording | null>(null);
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState(false);

  useEffect(() => {
    setRecording(null);
    setWatching(false);
    if (!hasFinished(event)) return;

    let cancelled = false;
    setLoading(true);
    getLessonRecording(event.id)
      .then((data) => {
        if (!cancelled) setRecording(data);
      })
      .catch(() => {
        // A failed lookup is not something a student can act on, and the lesson dialog
        // still has to work. Stay silent rather than showing an error for a feature
        // they may not even have.
        if (!cancelled) setRecording({ status: 'missing', url: null });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [event.id, event.end_datetime]);

  const progress = recording && recording.status !== 'ready' && recording.status !== 'missing'
    ? progressFor(recording.status, recording.progress)
    : null;
  const interval = pollInterval(progress);

  useEffect(() => {
    if (interval == null) return undefined;
    let cancelled = false;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      getLessonRecording(event.id)
        .then((next) => { if (!cancelled) setRecording(next); })
        .catch(() => { /* the next round tries again */ });
    }, interval);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [event.id, interval]);

  if (!hasFinished(event)) return null;

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 flex-none animate-spin" />
        <span>Checking for a recording…</span>
      </div>
    );
  }

  if (!recording || recording.status === 'missing') return null;

  if (progress) {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <RecordingStatusCard progress={progress} locale={recordingsLocale(user?.role)} />
      </div>
    );
  }

  if (!recording.url) {
    return (
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Video className="h-4 w-4 flex-none text-muted-foreground/70" />
          <span>The recording of this lesson is not available.</span>
        </div>
      </div>
    );
  }

  const clock = formatClock(recording.duration_seconds);
  const backend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const poster = recording.poster_url
    ? (recording.poster_url.startsWith('http') ? recording.poster_url : `${backend}${recording.poster_url}`)
    : null;

  return (
    <div className="mt-4 border-t border-border pt-4">
      {watching ? (
        <HlsVideoPlayer url={recording.url} poster={recording.poster_url} title={event.title} autoPlay className="w-full" />
      ) : (
        <button
          type="button"
          onClick={() => setWatching(true)}
          aria-label={`Watch the recording${clock ? `, ${clock}` : ''}`}
          className="group relative block aspect-video w-full overflow-hidden rounded-lg bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {poster ? (
            <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
              <Video className="h-8 w-8 text-white/40" aria-hidden />
            </span>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" aria-hidden />
          <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition group-hover:scale-105">
              <Play className="ml-0.5 h-5 w-5 fill-slate-900 text-slate-900" />
            </span>
          </span>
          <span className="absolute bottom-2.5 left-3 text-[13px] font-semibold text-white drop-shadow">Watch the recording</span>
          {clock && (
            <span className="absolute bottom-2.5 right-3 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
              {clock}
            </span>
          )}
        </button>
      )}
    </div>
  );
}
