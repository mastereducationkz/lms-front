import { Play, VideoOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { formatDurationWords } from '../../lib/recordings';
import { progressFor } from '../../lib/recordingProgress';
import { RecordingStatusInline } from '../recordings/RecordingProgress';
import type { RecordingMeta } from '../recordings/RecordingPlayerDialog';
import type { MeetLessonSummary } from '../../services/api/meetAttendance';
import type { LessonRecordingStatus, RecordingProgress } from '../../services/api/recordings';

/** What the player shows about a Meet attendance lesson before its video loads. */
export function recordingMeta(item: MeetLessonSummary, durationSeconds?: number | null): RecordingMeta {
  return {
    eventId: item.event_id,
    title: item.title,
    start: item.start,
    end: item.end,
    groups: item.groups,
    teacher: item.teacher?.name ?? null,
    durationSeconds: durationSeconds ?? item.recording?.duration_seconds ?? null,
  };
}

interface WatchProps {
  durationSeconds?: number | null;
  onWatch: () => void;
  label?: string;
  className?: string;
}

/**
 * «▶ Watch 58 min». It sits inside rows and headers that open something themselves on a click or a
 * key, so it keeps both to itself.
 */
export function WatchRecordingButton({ durationSeconds, onWatch, label = 'Watch', className }: WatchProps) {
  const length = formatDurationWords(durationSeconds);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onWatch(); }}
      onKeyDown={(e) => e.stopPropagation()}
      title="Watch the lesson’s recording"
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Play className="h-3.5 w-3.5 fill-current text-primary" aria-hidden />
      {label}
      {length && <span className="tabular-nums text-muted-foreground">{length}</span>}
    </button>
  );
}

interface Props {
  status: LessonRecordingStatus;
  durationSeconds?: number | null;
  /** Live news for a recording still on its way (the page asks for those in one batch). */
  progress?: RecordingProgress | null;
  onWatch: () => void;
  className?: string;
}

/**
 * A lesson's recording in one row of Meet attendance: a play button once it can be watched, the
 * stage while it is on its way, and a quiet word when there is none.
 */
export function LessonRecordingCell({ status, durationSeconds, progress, onWatch, className }: Props) {
  if (status === 'ready') return <WatchRecordingButton durationSeconds={durationSeconds} onWatch={onWatch} className={className} />;
  const live = progressFor(status, progress);
  if (live) return <RecordingStatusInline progress={live} locale="en" className={cn('items-start', className)} />;
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted-foreground', className)}>
      <VideoOff className="h-3.5 w-3.5" aria-hidden /> No recording
    </span>
  );
}

export default LessonRecordingCell;
