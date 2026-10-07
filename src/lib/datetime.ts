/**
 * Datetime utilities with explicit timezone handling.
 * All API datetimes are stored/transmitted in UTC (ISO 8601 with Z).
 * Display uses Asia/Almaty timezone.
 */

export const APP_TIMEZONE = 'Asia/Almaty';

/**
 * Parses ISO string as UTC. If no Z or offset (+05:00) — appends Z.
 */
export function parseAsUTC(s: string): Date {
  // "…+00:00Z" is an offset-aware datetime that also got a Z appended by the serializer; the
  // offset is the truth, and the Z alone would make the string unparseable.
  const cleaned = /[+-]\d{2}:\d{2}Z$/.test(s) ? s.slice(0, -1) : s;
  const hasTz = cleaned.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(cleaned);
  return new Date(hasTz ? cleaned : cleaned + 'Z');
}

/**
 * Formats date in KZ timezone for display.
 */
export function formatInKZ(
  d: Date | string,
  format: Intl.DateTimeFormatOptions
): string {
  const date = typeof d === 'string' ? parseAsUTC(d) : d;
  return date.toLocaleString('en-US', { ...format, timeZone: APP_TIMEZONE });
}

/**
 * Converts UTC datetime to KZ "YYYY-MM-DDTHH:mm" for datetime-local input.
 * Use when displaying API datetimes (UTC with Z) in forms. Always uses Asia/Almaty.
 */
export function toDatetimeLocal(d: Date | string): string {
  const date = typeof d === 'string' ? parseAsUTC(d) : d;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** KZ offset in ms (UTC+5) */
const KZ_OFFSET_MS = 5 * 60 * 60 * 1000;

/**
 * Converts "YYYY-MM-DDTHH:mm" from form (interpreted as KZ time) to UTC ISO string.
 * Use when submitting event forms so backend receives UTC.
 */
export function fromDatetimeLocalKZ(localStr: string): string {
  const [datePart, timePart] = localStr.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  const utcMs = Date.UTC(y, m - 1, d, h, min || 0, 0) - KZ_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

// --- School time everywhere ---------------------------------------------------------------

const CIVIL_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * The Almaty calendar date of an instant, as a "civil date": a Date at local midnight whose
 * year/month/day fields ARE the Almaty date. The calendar's day arithmetic (getDate, setDate,
 * getDay) works on these unchanged, whatever zone the laptop is in.
 */
export function almatyCivilDate(instant: Date | string = new Date()): Date {
  const d = typeof instant === 'string' ? parseAsUTC(instant) : instant;
  // Never throw inside a render: Intl throws on an invalid Date, and one malformed event would
  // take the whole calendar down. An Invalid Date compares false with everything, so the event
  // simply falls out of every day — as it did before.
  if (!d || Number.isNaN(d.getTime())) return new Date(NaN);
  const [y, m, day] = CIVIL_DAY.format(d).split('-').map(Number);
  return new Date(y, m - 1, day);
}

/** Today in Kazakhstan, as a civil date. */
export function todayInAlmaty(): Date {
  return almatyCivilDate(new Date());
}

/**
 * A Date sitting exactly on local midnight is a calendar DATE (a day cell, a picked date), not
 * a moment. Converting it to another zone could move it to the day before — for anyone east of
 * Kazakhstan — so it keeps its own zone. A real moment that happens to fall on the viewer's
 * local midnight is the rare case this gives up, and it then reads exactly as it did before.
 */
export function isCivilDate(d: Date): boolean {
  return !Number.isNaN(d.getTime())
    && d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0;
}

type LocaleFormatter = (this: Date, locales?: string | string[], options?: Intl.DateTimeFormatOptions) => string;
const ORIGINAL = {
  toLocaleString: Date.prototype.toLocaleString as LocaleFormatter,
  toLocaleDateString: Date.prototype.toLocaleDateString as LocaleFormatter,
  toLocaleTimeString: Date.prototype.toLocaleTimeString as LocaleFormatter,
};

/**
 * Make every date the app shows read in Kazakhstan time, whatever zone the viewer's laptop is
 * set to. The school runs on Almaty time — a lesson "at 19:00" is 19:00 in Almaty — but the
 * browser formats dates in its own zone, so a teacher travelling in Europe saw lessons, times
 * and the calendar's "now" three hours off (2026-09-10: 20:18 on screen, 23:18 in Almaty).
 *
 * About a hundred screens format with toLocale*String and no zone. Rather than touch each one
 * (and miss the next one someone writes), the three formatters default to Asia/Almaty when the
 * caller did not choose a zone. An explicit `timeZone` is always respected, and calendar dates
 * (see isCivilDate) keep their own zone. Installed once, before the app renders.
 */
export function installAppTimeZone(): void {
  const withSchoolZone = (original: LocaleFormatter): LocaleFormatter =>
    function (this: Date, locales, options) {
      if (options?.timeZone || isCivilDate(this)) return original.call(this, locales, options);
      return original.call(this, locales, { ...options, timeZone: APP_TIMEZONE });
    };
  Date.prototype.toLocaleString = withSchoolZone(ORIGINAL.toLocaleString) as Date['toLocaleString'];
  Date.prototype.toLocaleDateString = withSchoolZone(ORIGINAL.toLocaleDateString) as Date['toLocaleDateString'];
  Date.prototype.toLocaleTimeString = withSchoolZone(ORIGINAL.toLocaleTimeString) as Date['toLocaleTimeString'];
}

/** Undo installAppTimeZone — for tests. */
export function uninstallAppTimeZone(): void {
  Date.prototype.toLocaleString = ORIGINAL.toLocaleString as Date['toLocaleString'];
  Date.prototype.toLocaleDateString = ORIGINAL.toLocaleDateString as Date['toLocaleDateString'];
  Date.prototype.toLocaleTimeString = ORIGINAL.toLocaleTimeString as Date['toLocaleTimeString'];
}
