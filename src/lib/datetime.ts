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
  const hasTz = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  return new Date(hasTz ? s : s + 'Z');
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
