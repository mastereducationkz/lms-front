import type { ExamResultDetail } from '../../services/api/exams';

/** Every recorded attempt, newest first, one per line — for a tooltip or a compact list. */
export function attemptsSummary(attempts: ExamResultDetail[]): string {
  return attempts.map((a) => {
    const sections = a.verbal_score != null && a.math_score != null
      ? ` (V ${a.verbal_score} · M ${a.math_score})` : '';
    return `${a.test_date} — ${Number(a.total_score)}${sections}`;
  }).join('\n');
}
