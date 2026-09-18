// What a cell of the head teachers' register says, and how it is written.
//
// The grid is dense on purpose — 28 teachers against 15 days — so a cell shows the day's worst
// news in as few characters as possible, and says the rest on hover. A day the LMS could not watch
// gets its own mark: it is not a clean day, and must never read like one.

/** The day the rule took effect; the register never goes further back. */
export const RULE_START = '2026-09-16';

export type DisciplineCell = {
  late_minutes: number;
  early_minutes: number;
  misses: number;
  fine: number;
  unpriced: number;
  lessons: number;
  measured: number;
  unmeasurable: number;
  decided: number;
  state: string;
};

export type CellTone = 'late' | 'miss' | 'early' | 'clear' | 'unmeasurable' | 'none';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function cellText(cell: DisciplineCell): string {
  if (cell.misses > 0) return '✗';
  const parts: string[] = [];
  if (cell.late_minutes > 0) parts.push(`${cell.late_minutes}′`);
  if (cell.early_minutes > 0) parts.push(`−${cell.early_minutes}′`);
  if (parts.length) return parts.join(' / ');
  if (cell.unmeasurable > 0) return '·';
  return '';
}

export function cellTone(cell: DisciplineCell): CellTone {
  if (cell.misses > 0) return 'miss';
  if (cell.late_minutes > 0) return 'late';
  if (cell.early_minutes > 0) return 'early';
  if (cell.unmeasurable > 0) return 'unmeasurable';
  return cell.lessons > 0 ? 'clear' : 'none';
}

/** The sentence behind a cell, for the tooltip: lessons, what happened, and what it costs. */
export function cellTitle(cell: DisciplineCell): string {
  if (!cell.lessons) return 'no lessons';
  const parts = [`${cell.lessons} lesson${cell.lessons === 1 ? '' : 's'}`];
  if (cell.misses) parts.push(`${cell.misses} missed`);
  if (cell.late_minutes) parts.push(`${cell.late_minutes} min late`);
  if (cell.early_minutes) parts.push(`${cell.early_minutes} min short`);
  if (cell.unmeasurable && !cell.measured) parts.push('no Meet room, nothing to judge');
  if (cell.unpriced) parts.push('not priced yet');
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
