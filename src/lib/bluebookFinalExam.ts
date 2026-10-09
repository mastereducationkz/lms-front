/** A student's final exam as the Bluebook grid API sends it (see lms-backend `src/exams/final_exam.py`). */
export interface BluebookFinalExam {
  total_score: number | null;
  verbal_score: number | null;
  math_score: number | null;
  /** The day the exam was sat; empty while there is no result. */
  test_date: string | null;
  /** Shown only while there is no result. */
  planned_test_date: string | null;
  /** `verified`, or `reported` for a result nobody has checked against proof yet. */
  status: string | null;
  /** The final total minus the Assignment Zero baseline total. */
  change_vs_baseline: number | null;
}

export type FinalExamView =
  | { kind: 'none' }
  | { kind: 'planned'; date: string }
  | { kind: 'result'; total: string; detail: string | null; date: string; verified: boolean; change: string | null };

/** 2026-10-03 → 03.10.2026; anything else is shown as sent rather than dropped. */
const day = (iso: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
};

/** What the «Final exam» cells show: the result, else the planned test date, else nothing. */
export function finalExamView(final: BluebookFinalExam | null | undefined): FinalExamView {
  if (!final) return { kind: 'none' };
  if (final.total_score == null || !final.test_date) {
    return final.planned_test_date ? { kind: 'planned', date: day(final.planned_test_date) } : { kind: 'none' };
  }
  return {
    kind: 'result',
    total: String(final.total_score),
    detail: final.verbal_score != null && final.math_score != null ? `V ${final.verbal_score} · M ${final.math_score}` : null,
    date: day(final.test_date),
    verified: final.status === 'verified',
    change: final.change_vs_baseline != null ? String(final.change_vs_baseline) : null,
  };
}
