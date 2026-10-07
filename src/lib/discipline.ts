// What a cell of the head teachers' register says, and how it is written.
//
// The grid is dense on purpose — 28 teachers against 15 days — so a cell shows the day's worst
// news in as few characters as possible, and says the rest on hover. A day the LMS could not watch
// gets its own mark: it is not a clean day, and must never read like one.

import { activeLocale, t, type Locale } from './i18n';
import '@/lib/i18n/catalogs/teacherInsights';

/** The day the rule took effect; the register never goes further back. */
export const RULE_START = '2026-09-16';

export type DisciplineCell = {
  late_minutes: number;
  early_minutes: number;
  misses: number;
  fine: number;
  unpriced: number;
  /** Of `late_minutes`, the ones given back by staying past the end. Never reduces the fine. */
  made_up_minutes?: number;
  lessons: number;
  measured: number;
  unmeasurable: number;
  decided: number;
  state: string;
};

export type CellTone = 'late' | 'made_up' | 'miss' | 'early' | 'clear' | 'unmeasurable' | 'none';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/**
 * The cell's figures. A lesson never taught and minutes given back are drawn by the page as
 * icons (see cellMark), so this returns '' for a miss and no «↩» after the late figure.
 */
export function cellText(cell: DisciplineCell): string {
  if (cell.misses > 0) return '';
  const parts: string[] = [];
  if (cell.late_minutes > 0) parts.push(`${cell.late_minutes}′`);
  if (cell.early_minutes > 0) parts.push(`−${cell.early_minutes}′`);
  if (parts.length) return parts.join(' / ');
  if (cell.unmeasurable > 0) return '·';
  return '';
}

/** How many of the day's late minutes came back. */
/**
 * The icon a cell carries: a cross for a lesson never taught, or the «gave it back» mark for
 * minutes the teacher made up by staying past the end. The mark rides beside the late figure
 * rather than replacing it, because the minutes were still missed at the start.
 */
export function cellMark(cell: DisciplineCell): 'miss' | 'made_up' | null {
  if (cell.misses > 0) return 'miss';
  return cell.late_minutes > 0 && madeUp(cell) > 0 ? 'made_up' : null;
}

export function madeUp(cell: DisciplineCell): number {
  return Math.min(cell.made_up_minutes || 0, cell.late_minutes);
}

export function cellTone(cell: DisciplineCell): CellTone {
  if (cell.misses > 0) return 'miss';
  // A day whose lateness was entirely worked off gets its own colour, not the warning one:
  // that is the single thing a head teacher is looking for when deciding whether to waive.
  // Partly made up still reads as late — some of those minutes never came back.
  if (cell.late_minutes > 0) {
    return madeUp(cell) >= cell.late_minutes && cell.early_minutes === 0 ? 'made_up' : 'late';
  }
  if (cell.early_minutes > 0) return 'early';
  if (cell.unmeasurable > 0) return 'unmeasurable';
  return cell.lessons > 0 ? 'clear' : 'none';
}

/** The sentence behind a cell, for the tooltip: lessons, what happened, and what it costs. */
export function cellTitle(cell: DisciplineCell, locale: Locale = activeLocale()): string {
  if (!cell.lessons) return t('teacherInsights.discipline.cell.noLessons', undefined, locale);
  const parts = [t('common.lessons', { count: cell.lessons }, locale)];
  if (cell.misses) parts.push(t('teacherInsights.discipline.cell.missed', { count: cell.misses }, locale));
  if (cell.late_minutes) {
    const back = madeUp(cell);
    const minutes = cell.late_minutes;
    parts.push(back >= cell.late_minutes
      ? t('teacherInsights.discipline.cell.lateMadeUpFull', { minutes }, locale)
      : back > 0 ? t('teacherInsights.discipline.cell.latePartlyMadeUp', { minutes, back }, locale)
        : t('teacherInsights.discipline.cell.late', { minutes }, locale));
  }
  if (cell.early_minutes) parts.push(t('teacherInsights.discipline.cell.short', { minutes: cell.early_minutes }, locale));
  if (cell.unmeasurable && !cell.measured) parts.push(t('teacherInsights.discipline.cell.noRoom', undefined, locale));
  if (cell.unpriced) parts.push(t('teacherInsights.discipline.cell.notPriced', undefined, locale));
  else if (cell.fine) parts.push(money(cell.fine));
  return parts.join(' · ');
}

/** Whole tenge, spaced as the office writes them; nothing owed reads as a dash. */
export function money(tenge: number): string {
  if (!tenge) return '—';
  return `${Math.round(tenge).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₸`;
}

/** «16–30 September 2026» — the half-month payroll runs on. */
export function periodLabel(start: string, end: string): string {
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  return `${from.getUTCDate()}–${to.getUTCDate()} ${MONTHS[from.getUTCMonth()]} ${from.getUTCFullYear()}`;
}

/** Whether to show the programme filter row.
 *
 * The tabs must never disappear because of the choice made in them: a chosen programme leaves one
 * name on screen, and hiding the row then took «All» with it, trapping the reader in that filter.
 */
export function showsProgramTabs(programs: string[] | undefined, chosen: string): boolean {
  if (chosen) return true;
  return (programs?.length || 0) > 1;
}
