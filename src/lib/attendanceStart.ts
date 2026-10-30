import { APP_TIMEZONE, parseAsUTC } from './datetime';
import { activeLocale, t, type Locale } from './i18n';
import '@/lib/i18n/catalogs/attendance';

/**
 * No attendance mark before the lesson starts (owner, 2026-10-30; CRM audit W3-001, live in the CRM
 * since crm-master #233). A «Был» on tomorrow's lesson is real data: once the date passes, the CRM's
 * attendance→billing sync charges the student and teacher pay counts the lesson. The server refuses it
 * (409, the same words as `notStartedHint`); the screens close the controls so nobody gets that far.
 *
 * The stored start and now are compared as instants (lesson times are naive UTC); only the words show
 * Almaty time. The start minute itself is open, a second before it is not. Kept pure so it is tested.
 */

/**
 * An excused absence («уважительная причина») may be recorded before the lesson starts (owner, confirmed
 * 2026-10-29): a parent rings the day before, the curator notes it. Only Был / Опоздал / Н/Б wait for
 * the start. Set to false to close the advance excuse as well.
 */
export const EXCUSE_BEFORE_START = true;

/** Stored statuses that are marks; «registered», «removed», cancelled and unknown ones are not. */
const MARKS = new Set(['attended', 'late', 'missed', 'absent']);

// `hourCycle: 'h23'`: with `hour12: false` some engines write Almaty midnight as «24:30».
const ALMATY_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function almatyParts(instant: Date): { day: string; time: string } {
  const parts = ALMATY_PARTS.formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { day: `${get('day')}.${get('month')}.${get('year')}`, time: `${get('hour')}:${get('minute')}` };
}

/** The instant marks open: the start's own minute (ms since epoch), NaN without a readable start. */
function opensAt(start: string | null | undefined): number {
  const ms = start ? parseAsUTC(start).getTime() : NaN;
  return Math.floor(ms / 60_000) * 60_000;
}

/** Whether marks are open for a lesson starting at `start`. A lesson without a readable start is left to the server. */
export function attendanceOpen(start: string | null | undefined, now: Date = new Date()): boolean {
  const opens = opensAt(start);
  return Number.isNaN(opens) || opens <= now.getTime();
}

/** Milliseconds until marks open; null when they already are. */
export function msUntilOpen(start: string | null | undefined, now: Date = new Date()): number | null {
  return attendanceOpen(start, now) ? null : opensAt(start) - now.getTime();
}

/** Whether writing `status` (with its excuse) before the start would be refused: a mark is, an advance excuse is not. */
export function isMarkWrite(status: string, excused = false): boolean {
  if (!MARKS.has(status)) return false;
  return !(EXCUSE_BEFORE_START && excused && (status === 'missed' || status === 'absent'));
}

/** Whether this write may happen now. */
export function writeAllowed(start: string | null | undefined, status: string, excused = false, now: Date = new Date()): boolean {
  return attendanceOpen(start, now) || !isMarkWrite(status, excused);
}

/**
 * «Урок ещё не начался — отметить посещаемость можно с 19:00» (+ « 31.10.2026» when the start is on
 * another Almaty day than now): the server's own words. Null once marks are open.
 */
export function notStartedHint(start: string | null | undefined, now: Date = new Date(), locale: Locale = activeLocale()): string | null {
  if (attendanceOpen(start, now)) return null;
  const opens = almatyParts(parseAsUTC(start!));
  if (opens.day === almatyParts(now).day) return t('attendance.notStarted.hint', { time: opens.time }, locale);
  return t('attendance.notStarted.hintOn', { time: opens.time, date: opens.day }, locale);
}
