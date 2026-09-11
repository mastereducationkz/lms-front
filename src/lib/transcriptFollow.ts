import type { TranscriptLine } from '../services/api/meetTalk';

/**
 * A transcript that follows the video: which line is being said now, where the list should scroll
 * to keep it in view, and where a picked block of the "who spoke when" grid plays from.
 *
 * Two clocks meet here. Transcript lines carry `at`/`end` in seconds of the RECORDING (what the
 * video's currentTime counts) and `lesson_at` in seconds from the lesson's scheduled start; the
 * backend's `recording_offset_seconds` joins them: video time = lesson time + offset.
 */

type Timed = Pick<TranscriptLine, 'at' | 'end'>;

/** The line the video is at: the last one begun by `seconds` (recording time), or -1 before the first. */
export function currentLineIndex(lines: Timed[], seconds: number | null | undefined): number {
  if (seconds == null || !Number.isFinite(seconds) || lines.length === 0) return -1;
  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].at <= seconds) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Still being said: from its start to a moment after its end (a pause is not a new line). */
export function isSpeaking(line: Timed | undefined, seconds: number | null | undefined, grace = 1.5): boolean {
  if (!line || seconds == null) return false;
  return line.at <= seconds && seconds <= Math.max(line.end, line.at) + grace;
}

/**
 * Where to scroll a list so an item sits comfortably in view — a third of the way down — or null
 * when it already does (between 15% and 70% of the visible height). Pixels, relative to the list.
 */
export function revealScrollTop(
  view: { top: number; height: number },
  item: { top: number; height: number },
): number | null {
  const comfortableFrom = view.top + view.height * 0.15;
  const comfortableTo = view.top + view.height * 0.7;
  if (item.top >= comfortableFrom && item.top + item.height <= comfortableTo) return null;
  return Math.max(0, Math.round(item.top - view.height * 0.3));
}

/** Lesson seconds for a video time; null when the recording's offset is unknown. */
export function lessonAt(recordingSeconds: number | null | undefined, offset: number | null | undefined): number | null {
  if (recordingSeconds == null || offset == null) return null;
  return recordingSeconds - offset;
}

/** Video seconds for a lesson time; null when the recording's offset is unknown. */
export function recordingAt(lessonSeconds: number, offset: number | null | undefined): number | null {
  if (offset == null) return null;
  return Math.max(0, lessonSeconds + offset);
}

/**
 * Where a block picked in the grid plays from: the first thing that person said in it — never
 * earlier than the block itself, when a long turn began before it — or else the block's start.
 * Null when neither can be placed on the video.
 */
export function blockSeekTarget(
  lines: Pick<TranscriptLine, 'at' | 'end' | 'lesson_at' | 'speaker_key'>[],
  focus: { key: string | null; from: number; to: number },
  offset: number | null | undefined,
): number | null {
  const blockStart = recordingAt(focus.from, offset);
  const line = lines.find((l) => (focus.key === null || l.speaker_key === focus.key)
    && l.lesson_at < focus.to && l.lesson_at + Math.max(0, l.end - l.at) > focus.from);
  if (line) return blockStart == null ? line.at : Math.max(line.at, blockStart);
  return blockStart;
}

/** The grid column (0-based) the playhead is in, or -1 outside every column. */
export function columnAt(columns: { from: number; to: number }[], lessonSeconds: number | null | undefined): number {
  if (lessonSeconds == null) return -1;
  return columns.findIndex((c) => c.from <= lessonSeconds && lessonSeconds < c.to);
}
