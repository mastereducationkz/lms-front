// The course-completion number is computed once, on the backend
// (lms-backend src/progress/services/completion_metrics.py): required steps done ÷ required
// steps over the course's unit lessons — checkpoints and optional steps never count. Screens
// only DISPLAY it; never recompute a percentage here. These helpers format the two lines shown
// beside it: «12 из 30 уроков» and «Чекпоинты: 3 из 4 · средний балл 72%».

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

/** Russian genitive after «из N»: «из 1 урока», «из 21 урока», but «из 2 уроков», «из 11 уроков». */
function lessonsWord(total: number): string {
  const mod10 = total % 10;
  const mod100 = total % 100;
  return mod10 === 1 && mod100 !== 11 ? 'урока' : 'уроков';
}

/** «12 из 30 уроков»; empty string when the course has no counted lessons. */
export function lessonsLabel(done: number | null | undefined, total: number | null | undefined): string {
  const t = Math.max(0, Math.trunc(total ?? 0));
  if (t === 0) return '';
  const d = Math.min(t, Math.max(0, Math.trunc(done ?? 0)));
  return `${d} из ${t} ${lessonsWord(t)}`;
}

/** «Чекпоинты: 3 из 4 · средний балл 72%»; empty string when nothing was ever opened. */
export function checkpointLabel(cp: CheckpointSummary | null | undefined): string {
  if (!cp || !cp.opened) return '';
  const base = `Чекпоинты: ${cp.taken} из ${cp.opened}`;
  return cp.average === null || cp.average === undefined ? base : `${base} · средний балл ${cp.average}%`;
}
