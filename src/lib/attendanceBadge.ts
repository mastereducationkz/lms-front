export interface AttendanceDue {
  /** Registers this person still owes. */
  total: number;
  /** How many of those Google Meet has not handed the call over for yet — or Meet is about to mark. */
  waiting: number;
  /** Meet-marked lessons with a present student and no балл за активность yet (2026-09-23; absent from an older server). */
  scores?: number;
}

export type AttendanceBadgeTone = 'none' | 'waiting' | 'action';

/**
 * What the Attendance nav item should show.
 *
 * The tone is the point of the badge, not the number. A teacher who has just finished a lesson and
 * is waiting on Meet gets `waiting` — muted, because there is nothing they could do yet. Once Meet
 * takes the register (2026-09-23) the badge also counts lessons whose present students still owe an
 * activity score, which is always something to do now. `title` says what the number is made of.
 *
 * `waiting` exceeding `total` should not happen, but if the two counts are ever read a moment apart
 * the quiet answer is the safe one: never invent urgency out of a rounding race.
 */
export function attendanceBadge(due?: AttendanceDue): { count: number; tone: AttendanceBadgeTone; title: string | null } {
  const total = Math.max(0, due?.total ?? 0);
  const scores = Math.max(0, due?.scores ?? 0);
  if (total + scores <= 0) return { count: 0, tone: 'none', title: null };
  const waiting = Math.min(Math.max(0, due?.waiting ?? 0), total);
  const toMark = total - waiting;
  const title = [
    toMark > 0 ? `${toMark} to mark` : null,
    waiting > 0 ? `${waiting} waiting on Meet` : null,
    scores > 0 ? `${scores} need activity scores` : null,
  ].filter(Boolean).join(' · ');
  return { count: total + scores, tone: toMark === 0 && scores === 0 ? 'waiting' : 'action', title };
}
