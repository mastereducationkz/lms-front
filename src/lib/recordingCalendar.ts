import { almatyDayKey, type Locale } from './recordings';

/**
 * The Recordings date picker's month, as plain "YYYY-MM-DD" day keys — Almaty civil dates, the
 * same keys the server counts recordings by (`GET /recordings/days`). Built from Date.UTC
 * arithmetic only, so neither the viewer's time zone nor the app's Almaty default can shift a day.
 */

export interface CalendarCell {
  key: string;
  day: number;
  /** False for the neighbouring months' days that fill the first and last week. */
  inMonth: boolean;
}

const WEEKDAYS: Record<Locale, string[]> = {
  en: ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
};

/** The column heads, Monday first, as the school's week runs. */
export function weekdayNames(locale: Locale = 'en'): string[] {
  return WEEKDAYS[locale];
}

/** "2026-09" for this moment in Almaty. */
export function thisMonth(now: Date = new Date()): string {
  return almatyDayKey(now).slice(0, 7);
}

/** The month `delta` months away: shiftMonth('2026-12', 1) → '2027-01'. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** The month as whole weeks, Monday first. */
export function monthWeeks(month: string): CalendarCell[][] {
  const [y, m] = month.split('-').map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < Math.ceil((lead + length) / 7) * 7; i += 1) {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i));
    if (i % 7 === 0) weeks.push([]);
    weeks[weeks.length - 1].push({
      key: d.toISOString().slice(0, 10),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === m - 1,
    });
  }
  return weeks;
}

/** "September 2026" / "Сентябрь 2026". */
export function monthTitle(month: string, locale: Locale = 'en'): string {
  const [y, m] = month.split('-').map(Number);
  const name = new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'en-GB', { month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, 15)));
  return `${name[0].toLocaleUpperCase()}${name.slice(1)} ${y}`;
}
