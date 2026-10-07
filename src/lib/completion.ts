// The course-completion number is computed once, on the backend
// (lms-backend src/progress/services/completion_metrics.py): required steps done ÷ required
// steps over the course's unit lessons — checkpoints and optional steps never count. Screens
// only DISPLAY it; never recompute a percentage here. These helpers format the two lines shown
// beside it, in the reader's language: "12 of 30 lessons" / «12 из 30 уроков» and
// "Checkpoints: 3 of 4 · average 72%" / «Чекпоинты: 3 из 4 · средний балл 72%».
import { activeLocale, t, type Locale } from './i18n';

/** Checkpoint line payload: taken of opened, average score of the taken ones. */
export interface CheckpointSummary {
  opened: number;
  taken: number;
  average: number | null;
}

/** Fields every completion payload carries next to `completion_percentage`. */
export interface CompletionCounts {
  lessons_done?: number;
  lessons_total?: number;
  checkpoints?: CheckpointSummary | null;
}

/**
 * Floored mean of whole-number percentages — how the backend averages a roster
 * (completion_metrics.mean_pct). Pass current (active) students only.
 */
export function meanPct(values: number[]): number {
  if (!values.length) return 0;
  return Math.floor(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** "12 of 30 lessons" / «12 из 30 уроков» (the plural follows the total: «из 21 урока»);
 *  empty string when the course has no counted lessons. */
export function lessonsLabel(done: number | null | undefined, total: number | null | undefined, locale: Locale = activeLocale()): string {
  const all = Math.max(0, Math.trunc(total ?? 0));
  if (all === 0) return '';
  const d = Math.min(all, Math.max(0, Math.trunc(done ?? 0)));
  return t('learning.completion.lessons', { done: d, count: all }, locale);
}

/** "Checkpoints: 3 of 4 · average 72%"; empty string when nothing was ever opened. */
export function checkpointLabel(cp: CheckpointSummary | null | undefined, locale: Locale = activeLocale()): string {
  if (!cp || !cp.opened) return '';
  const counts = { taken: cp.taken, opened: cp.opened };
  return cp.average === null || cp.average === undefined
    ? t('learning.completion.checkpoints', counts, locale)
    : t('learning.completion.checkpointsWithAverage', { ...counts, average: cp.average }, locale);
}
