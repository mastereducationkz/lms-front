/**
 * Half-point homework grades (owner rule 2026-10-27): a teacher grades in steps of 0.5 (7, 7.5, 8)
 * on any homework, whatever its max_score. The backend enforces the same rule
 * (lms-backend src/assignments/scores.py) and answers `grade_half_step` / `grade_out_of_range`.
 *
 * Grade inputs are text fields with a decimal keyboard rather than `type="number"`: a number field
 * in an English-locale browser drops «7,5» to an empty value, and the comma must work.
 */
import type { MessageKey } from '@/lib/i18n';
import '@/lib/i18n/catalogs/homeworkStaff';

export const GRADE_STEP = 0.5;

/** A grade for people: «8», «7.5» — never «8.0». Empty for no grade. */
export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return String(Math.round(value * 100) / 100);
}

/** What a teacher typed, as a number: «7,5» and «7.5» are both 7.5; anything else is null. */
export function parseGradeInput(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const text = (raw ?? '').trim().replace(',', '.');
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/**
 * Keeps what may still become a grade while it is typed: digits and one separator («7,» on the way
 * to «7,5»). Anything else typed is dropped, so the field never holds letters or a second dot.
 */
export function sanitizeGradeTyping(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '');
  const at = cleaned.search(/[.,]/);
  if (at === -1) return cleaned;
  return cleaned.slice(0, at + 1) + cleaned.slice(at + 1).replace(/[.,]/g, '');
}

export type GradeProblem = 'empty' | 'notNumber' | 'halfStep' | 'range';

/** Why a typed grade cannot be saved, or null when it can (0 ≤ grade ≤ max, steps of 0.5). */
export function gradeProblem(raw: string | number | null | undefined, maxScore: number): GradeProblem | null {
  if (raw === null || raw === undefined || String(raw).trim() === '') return 'empty';
  const value = parseGradeInput(raw);
  if (value === null) return 'notNumber';
  if (!Number.isInteger(value * 2)) return 'halfStep';
  if (value < 0 || value > maxScore) return 'range';
  return null;
}

/** The i18n key (homeworkStaff catalog) that explains a problem to the teacher. */
export function gradeProblemKey(problem: GradeProblem): MessageKey {
  return problem === 'empty' ? 'homeworkStaff.grade.enterScore'
    : problem === 'range' ? 'homeworkStaff.grade.outOfRange'
      : 'homeworkStaff.grade.halfStep';
}

/** One step up or down (±0.5 by default) from what is typed, kept within 0..max. */
export function stepGrade(raw: string | number | null | undefined, maxScore: number, delta: number = GRADE_STEP): number {
  const current = parseGradeInput(raw) ?? 0;
  const snapped = Math.round(current / GRADE_STEP) * GRADE_STEP;
  return Math.max(0, Math.min(maxScore, snapped + delta));
}
