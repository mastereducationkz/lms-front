import { useT } from '../../lib/i18n/react';
import { changeParts, initialScoreParts, type InitialScore } from '../../lib/examInitial';
import '@/lib/i18n/catalogs/exams';

/**
 * The "Initial" cell of the exam-results grid: where the student started in Assignment Zero. SAT shows the
 * Bluebook baseline with Verbal and Math under it, IELTS the platform diagnostic with its bands; both keep
 * what the student wrote about an earlier official attempt. NUET has no initial score.
 */
export function InitialScoreCell({ initial, examType }: { initial?: InitialScore | null; examType: string }) {
  const t = useT();
  const { main, detail, previous } = initialScoreParts(initial, examType);
  if (main === null && previous === null) {
    return <span className="text-muted-foreground" title={examType === 'nuet' ? t('exams.initial.nuetNone') : undefined}>—</span>;
  }
  return (
    <span className="flex flex-col items-center leading-tight">
      {main !== null && <span data-line className="font-medium">{main}</span>}
      {detail && <span data-line className="text-[10px] tabular-nums text-muted-foreground">{detail}</span>}
      {previous && (
        <span data-line title={previous} className="max-w-[12rem] truncate text-[10px] text-muted-foreground">{previous}</span>
      )}
    </span>
  );
}

/** The move from the initial total to the current attempt, as a small signed chip. */
export function ScoreChange({ change, examType, title }: { change?: string | null; examType: string; title?: string }) {
  const t = useT();
  const parts = changeParts(change, examType);
  if (!parts) return null;
  const tone = parts.tone === 'up'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    : parts.tone === 'down'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      : 'bg-muted text-muted-foreground';
  return (
    <span title={title ?? t('exams.initial.changeTitle')} className={`ml-1.5 inline-block rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums ${tone}`}>
      {parts.text}
    </span>
  );
}
