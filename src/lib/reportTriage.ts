/**
 * Jev's triage of question reports (owner, 2026-09-30; lms-backend `src/content/report_triage.py`).
 * A label is a suggestion for staff: it changes no status. A person's correction wins and is kept.
 */

export type TriageLabel = 'key_wrong' | 'grading_issue' | 'question_broken' | 'student_wrong' | 'cant_tell' | 'junk';

export interface ReportTriage {
  label: TriageLabel | null;
  confidence: number | null;
  corrected_label: TriageLabel | null;
  effective_label: TriageLabel | null;
  facts: string[];
}

export const TRIAGE_LABELS: { key: TriageLabel; name: string; hint: string; tone: string }[] = [
  { key: 'key_wrong', name: 'Key wrong', hint: 'The marked answer is wrong; the student is right',
    tone: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800' },
  { key: 'grading_issue', name: 'Grading issue', hint: 'The answer matches the key but was scored wrong (13,5 vs 13.5)',
    tone: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800' },
  { key: 'question_broken', name: 'Question broken', hint: 'Missing text or figure, no correct option, wrong explanation',
    tone: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800' },
  { key: 'cant_tell', name: "Can't tell", hint: 'Depends on a figure, table or audio the check could not see',
    tone: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800' },
  { key: 'student_wrong', name: 'Student wrong', hint: 'The key is right; the student misread the question',
    tone: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800' },
  { key: 'junk', name: 'Junk', hint: 'Not a real report',
    tone: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
];

export const FACT_TEXT: Record<string, string> = {
  question_missing: 'Question no longer in the quiz',
  no_text: 'No question text',
  has_image: 'Has an image (not checked)',
  no_key: 'No answer marked correct',
  key_conflict: 'Key and «correct» flag disagree',
  key_out_of_range: 'Key points at a missing option',
};

/** How urgent a label is: a wrong key marks every student wrong, junk costs nothing. */
const RANK: Record<string, number> = {
  key_wrong: 0, grading_issue: 1, question_broken: 2, cant_tell: 3, student_wrong: 4, junk: 5,
};

export function labelInfo(label: string | null | undefined) {
  return TRIAGE_LABELS.find((l) => l.key === label) ?? null;
}

export type SortMode = 'newest' | 'urgent';

interface Sortable { id: number; created_at: string | null; triage?: ReportTriage | null }

/** «Most urgent first»: by label rank, then Jev's confidence, then newest. Unlabelled after junk. */
export function sortReports<T extends Sortable>(reports: T[], mode: SortMode): T[] {
  if (mode === 'newest') return reports;
  const rank = (r: T) => RANK[r.triage?.effective_label ?? ''] ?? 6;
  const sure = (r: T) => (r.triage?.corrected_label ? 1 : r.triage?.confidence ?? 0);
  return [...reports].sort((a, b) => rank(a) - rank(b) || sure(b) - sure(a)
    || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')));
}

export function labelCounts(reports: Sortable[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reports) {
    const key = r.triage?.effective_label ?? 'none';
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}
