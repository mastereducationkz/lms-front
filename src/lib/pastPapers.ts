import type { PastPaperSection } from '@/services/api/pastPapers';

/** The homework task type for a SAT past paper (the server fills title and is_partial from the catalog). */
export const PAST_PAPER_TASK_TYPE = 'sat_past_paper_task';

interface TaskLike {
  task_type?: string;
  content?: { paper_id?: number | null } | null;
}

export const isPastPaperTask = (task: TaskLike | null | undefined): boolean => task?.task_type === PAST_PAPER_TASK_TYPE;

export const hasPastPaperTask = (tasks: TaskLike[] | null | undefined): boolean => !!tasks?.some(isPastPaperTask);

/** Every task is a past paper: the server submits it when the paper is finished, there is nothing to hand in. */
export const isPastPaperOnly = (tasks: TaskLike[] | null | undefined): boolean =>
  !!tasks && tasks.length > 0 && tasks.every(isPastPaperTask);

interface DueDateForm {
  due_date?: string;
  due_date_mapping?: Record<number, string>;
  group_ids?: number[];
}

/**
 * SAT needs a deadline for every student (it hides the answer keys until then), so a homework with a
 * past paper cannot be saved without one. A group has a due date when it has its own or the form's shared one.
 */
export function pastPaperDueDateMissing(form: DueDateForm, tasks: TaskLike[] | null | undefined): boolean {
  if (!hasPastPaperTask(tasks)) return false;
  if (form.due_date) return false;
  const groups = form.group_ids ?? [];
  if (groups.length === 0) return true;
  return groups.some((gid) => !form.due_date_mapping?.[gid]);
}

/** Correct and total over the sections the paper has (a partial paper may hold only one). */
export function sectionTotals(rw: PastPaperSection | null, math: PastPaperSection | null): { correct: number; total: number } {
  return [rw, math].reduce(
    (sum, s) => (s ? { correct: sum.correct + s.correct, total: sum.total + s.total } : sum),
    { correct: 0, total: 0 },
  );
}

/** The 1-based number of the first past-paper task with no paper picked, or null when every one has a paper. */
export function firstPastPaperTaskWithoutPaper(tasks: TaskLike[] | null | undefined): number | null {
  const index = (tasks ?? []).findIndex((task) => isPastPaperTask(task) && task.content?.paper_id == null);
  return index === -1 ? null : index + 1;
}
