import { todayInAlmaty } from '../../lib/datetime';
import type { ExamResultRow } from '../../services/api/exams';

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * «Дата прошла, нет результата»: the planned date is behind us and the sitting has neither a result nor
 * a «не сдаёт / не хочет делиться / не связались» mark. Not the same as the `overdue` triage, which waits
 * until planned + 13 days. The server sends the verdict; an older API without it is judged here.
 */
export function datePassedNoResult(row: ExamResultRow, today: string = isoDay(todayInAlmaty())): boolean {
  if (typeof row.date_passed_no_result === 'boolean') return row.date_passed_no_result;
  const outcome = row.triage_status === 'declined' || row.triage_status === 'not_taking' || row.triage_status === 'unreachable';
  return !!row.planned_test_date && row.planned_test_date < today && !row.sitting_has_result && !outcome;
}
