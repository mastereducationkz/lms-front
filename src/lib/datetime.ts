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
