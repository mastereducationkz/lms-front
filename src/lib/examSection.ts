/** A NUET section's scaled score is out of this. */
export const NUET_SECTION_MAX = 120;

export interface ExamSectionInput {
  correct?: number | null;
  total?: number | null;
  /** NUET only: the scaled score (out of 120), sent next to the counts. */
  scaled?: number | null;
}

/**
 * What one Math / Verbal cell of the curator leaderboard shows. Correct / total leads; the NUET score
 * out of 120 is the second figure. A result without a total is a NUET score the platform sent
 * without counts: the server puts it in `correct`, and it is shown alone, as before.
 */
export function examSectionParts({ correct, total, scaled }: ExamSectionInput): { primary: string | null; secondary: string | null } {
  if (correct == null) return { primary: null, secondary: null };
  if (total != null && total > 0) {
    return { primary: `${correct}/${total}`, secondary: scaled != null ? `${scaled}/${NUET_SECTION_MAX}` : null };
  }
  return { primary: `${correct}`, secondary: null };
}
