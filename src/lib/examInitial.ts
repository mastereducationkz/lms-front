/** Where a student started, as the exam-results API sends it (see lms-backend `src/exams/initial.py`). */
export interface InitialScore {
  total: string | null;
  verbal: number | null;
  math: number | null;
  listening: string | null;
  reading: string | null;
  writing: string | null;
  /** What the student wrote about an earlier official attempt in Assignment Zero, verbatim. */
  previous_text: string | null;
  /** The current attempt's total minus `total`; present only when both exist. */
  change: string | null;
}

const band = (value: string): string => Number(value).toFixed(1);

/**
 * What the "Initial" cell shows. SAT: the Bluebook baseline total with Verbal and Math under it. IELTS:
 * the platform diagnostic overall with the bands it covers. Both keep the student's own written text.
 * NUET has no initial score (Assignment Zero asks for none).
 */
export function initialScoreParts(initial: InitialScore | null | undefined, examType: string): { main: string | null; detail: string | null; previous: string | null } {
  const none = { main: null, detail: null, previous: null };
  if (!initial || (examType !== 'sat' && examType !== 'ielts')) return none;
  const previous = initial.previous_text?.trim() || null;
  if (examType === 'sat') {
    const detail = initial.verbal != null && initial.math != null ? `V ${initial.verbal} · M ${initial.math}` : null;
    return { main: initial.total != null ? String(Number(initial.total)) : null, detail, previous };
  }
  const bands = [
    ['L', initial.listening], ['R', initial.reading], ['W', initial.writing],
  ].filter((entry): entry is [string, string] => entry[1] != null).map(([label, value]) => `${label} ${band(value)}`);
  return { main: initial.total != null ? band(initial.total) : null, detail: bands.length ? bands.join(' · ') : null, previous };
}

/** The sign and size of the move from the initial total to the current attempt, or null when unknown. */
export function changeParts(change: string | null | undefined, examType: string): { text: string; tone: 'up' | 'down' | 'flat' } | null {
  if (change == null) return null;
  const value = Number(change);
  if (!Number.isFinite(value)) return null;
  const size = examType === 'ielts' ? Math.abs(value).toFixed(1) : String(Math.abs(Math.round(value)));
  if (value === 0 || Number(size) === 0) return { text: '0', tone: 'flat' };
  return value > 0 ? { text: `+${size}`, tone: 'up' } : { text: `−${size}`, tone: 'down' };
}
