import { APP_TIMEZONE } from './datetime';
import type {
  MeetFlag,
  MeetFlagCode,
  MeetLessonFlag,
  MeetLessonSummary,
  MeetMark,
  MeetPresence,
  MeetRecord,
  MeetSpan,
} from '../services/api/meetAttendance';

const MINUTE = 60_000;
const MIN_BAR = 0.6; // percent

/** "18:54" on the Almaty clock, whatever the viewer's own time zone. */
export function clock(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: APP_TIMEZONE });
}

export interface Axis {
  from: number;
  to: number;
  lessonStart: number;
  lessonEnd: number;
  ticks: { at: number; label: string }[];
}

/**
 * The timeline's time range: the lesson with a little air either side, stretched to whoever
 * came early or stayed late — but never further than the 30 minutes the record itself counts.
 */
export function buildAxis(record: Pick<MeetRecord, 'start' | 'end'>, rows: MeetPresence[]): Axis {
  const lessonStart = new Date(record.start).getTime();
  const lessonEnd = new Date(record.end).getTime();
  let from = lessonStart - 10 * MINUTE;
  let to = lessonEnd + 10 * MINUTE;
  for (const row of rows) {
    for (const span of row.sessions) {
      from = Math.min(from, new Date(span.joined_at).getTime());
      if (span.left_at) to = Math.max(to, new Date(span.left_at).getTime());
    }
  }
  from = Math.max(from, lessonStart - 30 * MINUTE);
  to = Math.min(to, lessonEnd + 30 * MINUTE);
  from = Math.floor(from / (5 * MINUTE)) * 5 * MINUTE;
  to = Math.ceil(to / (5 * MINUTE)) * 5 * MINUTE;

  // Almaty is a whole number of hours from UTC, so quarter hours line up in both.
  const step = (to - from) > 150 * MINUTE ? 30 * MINUTE : 15 * MINUTE;
  const ticks = [];
  for (let at = Math.ceil(from / step) * step; at <= to; at += step) {
    ticks.push({ at, label: clock(new Date(at).toISOString()) });
  }
  return { from, to, lessonStart, lessonEnd, ticks };
}

/** Where a moment sits on the axis, 0–100, clamped. */
export function position(axis: Axis, at: number): number {
  const span = axis.to - axis.from;
  if (span <= 0) return 0;
  return Math.min(100, Math.max(0, ((at - axis.from) / span) * 100));
}

/** A session as a bar: left and width in percent. An open session runs to `now` (or the axis end). */
export function barFor(axis: Axis, span: MeetSpan, now: number = Date.now()): { left: number; width: number } | null {
  const a = new Date(span.joined_at).getTime();
  const b = span.left_at ? new Date(span.left_at).getTime() : Math.min(now, axis.to);
  if (!(b > a)) return null;
  // A few seconds in the room still shows as a sliver rather than vanishing.
  const width = Math.max(MIN_BAR, position(axis, b) - position(axis, a));
  return { left: Math.min(position(axis, a), 100 - MIN_BAR), width };
}

const MISMATCH: ReadonlySet<MeetFlagCode> = new Set([
  'marked_present_not_joined',
  'marked_absent_was_in_room',
  'teacher_not_joined',
]);

export function isMismatch(code: MeetFlagCode): boolean {
  return MISMATCH.has(code);
}

export type FlagTone = 'mismatch' | 'timing';

export function flagTone(code: MeetFlagCode): FlagTone {
  return isMismatch(code) ? 'mismatch' : 'timing';
}

/** A flag in words, the way the lesson card and the review list both say it. */
export function flagText(flag: MeetFlag): string {
  const m = flag.minutes ?? 0;
  switch (flag.code) {
    case 'late': return `Late ${m} min`;
    case 'left_early': return `Left ${m} min early`;
    case 'marked_present_not_joined': return 'Marked present, never joined';
    case 'marked_absent_was_in_room': return `Marked absent, in the room ${m} min`;
    case 'teacher_late': return `Started ${m} min late`;
    case 'ended_early': return `Ended ${m} min early`;
    case 'teacher_not_joined': return 'Teacher never joined';
    default: return flag.code;
  }
}

export const MARK_LABEL: Record<Exclude<MeetMark, null>, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  removed: 'Removed',
};

/** The review list's one-line reading of a lesson, most serious first. */
export function lessonHeadline(item: Pick<MeetLessonSummary, 'mismatches' | 'unknown' | 'flags'>): string {
  const parts: string[] = [];
  if (item.mismatches) parts.push(`${item.mismatches} mark${item.mismatches === 1 ? '' : 's'} disagree`);
  const teacherTiming = item.flags.filter((f) => f.code === 'teacher_late' || f.code === 'ended_early');
  teacherTiming.forEach((f) => parts.push(flagText(f)));
  const late = item.flags.filter((f) => f.code === 'late').length;
  if (late) parts.push(`${late} late`);
  if (item.unknown) parts.push(`${item.unknown} to confirm`);
  return parts.length ? parts.join(' · ') : 'All clear';
}

/** "eventId:userId" → the disagreeing flags, for the attendance journal's warning dots. */
export function mismatchIndex(items: Pick<MeetLessonSummary, 'event_id' | 'flags'>[]): Map<string, MeetLessonFlag[]> {
  const index = new Map<string, MeetLessonFlag[]>();
  for (const item of items) {
    for (const flag of item.flags) {
      if (!isMismatch(flag.code) || flag.role === 'teacher') continue;
      const key = `${item.event_id}:${flag.user_id}`;
      index.set(key, [...(index.get(key) ?? []), flag]);
    }
  }
  return index;
}
