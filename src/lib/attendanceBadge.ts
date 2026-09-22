export interface AttendanceDue {
  /** Registers this person still owes. */
  total: number;
  /** How many of those Google Meet has not handed the call over for yet. */
  waiting: number;
}

export type AttendanceBadgeTone = 'none' | 'waiting' | 'action';

/**
 * What the Attendance nav item should show.
 *
 * The tone is the point of the badge, not the number. A teacher who has just finished a
 * lesson and is waiting on Meet gets `waiting` — muted, because there is nothing they could
 * do yet and a red pill would only teach them to ignore it. The moment Meet's data lands the
 * same badge turns `action`, which is how they learn the wait is over without sitting on the
 * Meet attendance page.
 *
 * `waiting` exceeding `total` should not happen, but if the two counts are ever read a moment
 * apart the quiet answer is the safe one: never invent urgency out of a rounding race.
 */
export function attendanceBadge(due?: AttendanceDue): { count: number; tone: AttendanceBadgeTone } {
  const total = due?.total ?? 0;
  if (total <= 0) return { count: 0, tone: 'none' };
  const waiting = due?.waiting ?? 0;
  return { count: total, tone: waiting >= total ? 'waiting' : 'action' };
}
