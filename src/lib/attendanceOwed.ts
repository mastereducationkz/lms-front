import { lessonPath } from './lessonLinks';
import type { AttendanceOwed, OwedItem } from '../services/api/attendanceOwed';

/**
 * What a teacher still owes (owner, 2026-10-17), as the /attendance list and the dashboard card show it:
 * registers Meet could not take, and activity scores. One lesson per item; each opens its lesson page.
 */

/** How many lessons a list shows before «Показать все». */
export const OWED_PREVIEW = 5;

/** The owed lessons by what they need, each oldest first (the server's order is kept). */
export function owedByKind(owed: AttendanceOwed | null | undefined): { scores: OwedItem[]; register: OwedItem[] } {
  const items = owed?.items ?? [];
  return { scores: items.filter((i) => i.kind === 'scores'), register: items.filter((i) => i.kind === 'register') };
}

export function previewOwed<T>(items: T[], expanded: boolean, limit: number = OWED_PREVIEW): T[] {
  return expanded ? items : items.slice(0, limit);
}

/** The lesson's page, at its register, where both kinds of debt are paid. */
export function owedLink(item: Pick<OwedItem, 'event_id'>): string {
  return lessonPath(item.event_id, 'register');
}

/** Lessons Meet handed back: the figure the server counted, or what the list holds when it sent none. */
export function registersOwed(owed: AttendanceOwed | null | undefined): number {
  if (!owed) return 0;
  return Number.isFinite(owed.registers) ? owed.registers : owedByKind(owed).register.length;
}

/** Lessons with a present student still unscored. */
export function scoresOwed(owed: AttendanceOwed | null | undefined): number {
  if (!owed) return 0;
  return Number.isFinite(owed.scores) ? owed.scores : owedByKind(owed).scores.length;
}
