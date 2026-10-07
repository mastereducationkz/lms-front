import { APP_TIMEZONE, isCivilDate, parseAsUTC } from '../datetime';
import { activeLocale, intlLocale, type Locale } from './locale';

/**
 * Dates, times and numbers in the user's language, always on Almaty time (the school's clock,
 * wherever the viewer's laptop is). The only place the app picks an Intl locale for display;
 * everything else calls these instead of toLocale*String.
 *
 * A Date at local midnight is a calendar date (a day cell, a picked day), not a moment, and is
 * shown as that date — the same rule as installAppTimeZone. A "YYYY-MM-DD" string is one too.
 * Empty or unparseable input gives ''.
 */

export type DateInput = Date | string | number | null | undefined;

export const DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
export const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
export const DATE_TIME: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

/** "7 Oct 2026" / "7 окт. 2026 г." */
export function formatDate(value: DateInput, options: Intl.DateTimeFormatOptions = DATE, locale: Locale = activeLocale()): string {
  return formatWith(value, options, locale);
}

/** "19:00" */
export function formatTime(value: DateInput, options: Intl.DateTimeFormatOptions = TIME, locale: Locale = activeLocale()): string {
  return formatWith(value, options, locale);
}

/** "7 Oct, 19:00" / "7 окт., 19:00" */
export function formatDateTime(value: DateInput, options: Intl.DateTimeFormatOptions = DATE_TIME, locale: Locale = activeLocale()): string {
  return formatWith(value, options, locale);
}

/** "12,500" / "12 500" */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions, locale: Locale = activeLocale()): string {
  return cached(numberFormats, `${locale}|${JSON.stringify(options ?? {})}`, () => new Intl.NumberFormat(intlLocale(locale), options)).format(value);
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

function cached<T>(cache: Map<string, T>, key: string, make: () => T): T {
  let hit = cache.get(key);
  if (!hit) {
    hit = make();
    cache.set(key, hit);
  }
  return hit;
}

function toDate(value: DateInput): { date: Date; civil: boolean } | null {
  if (value == null || value === '') return null;
  let date: Date;
  let civil = false;
  if (value instanceof Date) {
    date = value;
    civil = isCivilDate(value);
  } else if (typeof value === 'number') {
    date = new Date(value);
  } else {
    const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (day) {
      date = new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
      civil = true;
    } else {
      date = parseAsUTC(value);
    }
  }
  return Number.isNaN(date.getTime()) ? null : { date, civil };
}

function formatWith(value: DateInput, options: Intl.DateTimeFormatOptions, locale: Locale): string {
  const resolved = toDate(value);
  if (!resolved) return '';
  const zone = options.timeZone ?? (resolved.civil ? undefined : APP_TIMEZONE);
  const full = zone ? { ...options, timeZone: zone } : options;
  return cached(dateFormats, `${locale}|${JSON.stringify(full)}`, () => new Intl.DateTimeFormat(intlLocale(locale), full)).format(resolved.date);
}
