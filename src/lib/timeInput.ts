/**
 * What an `<input type="time">` and a date picker can hand us that is not a date.
 *
 * LMS-FRONT-E (2026-10): clearing or half-typing the time box in the homework builder's group
 * deadline gives the input's value "". `parseInt` of the missing minutes is NaN, `setHours(NaN)`
 * makes an Invalid Date, and the page's `date.toISOString()` threw «RangeError: Invalid time value».
 */

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/** "09:30" → 9 h 30 min. "" (cleared), "9:" (half typed) or "25:00" are not a time: null. */
export function parseTimeInput(value: string | null | undefined): { hours: number; minutes: number } | null {
  const match = TIME_RE.exec(value ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? { hours, minutes } : null;
}

/** A copy of `date` at the typed time, or null when there is no valid date or time to apply yet. */
export function withTime(date: Date, value: string | null | undefined): Date | null {
  const time = parseTimeInput(value);
  if (!time || !isValidDate(date)) return null;
  const next = new Date(date);
  next.setHours(time.hours, time.minutes);
  return next;
}
