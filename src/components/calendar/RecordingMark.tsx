import { Hourglass, Play, VideoOff } from 'lucide-react';
import type { Event } from '../../types';
import type { RecordingStatusEntry } from '../../services/api/recordings';
import { recordingMark } from '../../lib/calendarRecordingStatus';
import type { Locale } from '../../lib/recordings';
import { cn } from '../../lib/utils';
import BrandMark from '../BrandMark';

interface Props {
  event: Event;
  role?: string | null;
  /** The live status, where the day is open; the calendar's cached summary otherwise. */
  live?: RecordingStatusEntry | null;
  locale?: Locale;
  /** Sizing, and the colour of «recorded» (the other states bring their own). */
  className?: string;
  /** Turn the mark while a recording is being prepared — for a single row, not a month of chips. */
  spinning?: boolean;
  /** Spacing around the mark; nothing is rendered (and so no gap) when there is no mark. */
  wrapperClassName?: string;
}

const KIND_COLOUR = {
  processing: 'text-sky-600 dark:text-sky-400',
  waiting: 'text-sky-600 dark:text-sky-400',
  failed: 'text-rose-600 dark:text-rose-400',
  removed: 'text-muted-foreground/70',
} as const;

/**
 * A lesson's recording, as a mark beside it (2026-09-15): ▶ recorded (everyone); for staff also the
 * Master Education mark while it is being prepared, an hourglass while it waits on Google Meet, and a
 * crossed-out video when it failed (rose) or was retired (muted). The label says which, with the
 * percent or place in line when the day is open.
 */
export default function RecordingMark({ event, role, live, locale = 'en', className, spinning = false, wrapperClassName }: Props) {
  const mark = recordingMark(event, role, live, locale);
  if (!mark) return null;
  const icon = mark.kind === 'ready' ? <Play aria-hidden className={cn('fill-current', className)} />
    : mark.kind === 'processing' ? <BrandMark spinning={spinning} className={cn(className, KIND_COLOUR.processing)} />
      : mark.kind === 'waiting' ? <Hourglass aria-hidden className={cn(className, KIND_COLOUR.waiting)} />
        : <VideoOff aria-hidden className={cn(className, KIND_COLOUR[mark.kind])} />;
  return (
    <span role="img" aria-label={mark.label} title={mark.label} className={cn('inline-flex flex-none items-center', wrapperClassName)}>
      {icon}
    </span>
  );
}
