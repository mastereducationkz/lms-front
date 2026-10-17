import type { ActivityGapTeacher, OwedLesson } from '../services/api/head-teacher';
import { lessonPath } from './lessonLinks';

/**
 * The head teacher's «Activity» tab (2026-10-17): per teacher, the lessons still owed activity
 * scores and the registers Meet handed back. The backend is built in step with this screen, so the
 * rows are read defensively — a count that is missing is counted from the items, a teacher with
 * nothing owed is dropped, and a malformed item never reaches the table.
 */
export interface ActivityRow {
  teacher_id: number;
  teacher_name: string;
  /** Lessons where a present student still has no activity score. */
  scores: number;
  /** Lessons Meet could not mark and nobody has marked yet. */
  register: number;
  items: OwedLesson[];
}

const wholeCount = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;

/** Teachers with something owed, the one with most scores outstanding first. */
export function activityRows(teachers: ActivityGapTeacher[] | null | undefined): ActivityRow[] {
  return (teachers ?? [])
    .map((teacher): ActivityRow => {
      const items = (teacher.items ?? []).filter((item) => typeof item?.event_id === 'number');
      return {
        teacher_id: teacher.teacher_id,
        teacher_name: teacher.teacher_name ?? '',
        scores: wholeCount(teacher.scores_lessons, items.filter((i) => i.kind === 'scores').length),
        register: wholeCount(teacher.register_lessons, items.filter((i) => i.kind === 'register').length),
        items,
      };
    })
    .filter((row) => row.scores + row.register > 0)
    .sort((a, b) => b.scores - a.scores || b.register - a.register || a.teacher_name.localeCompare(b.teacher_name));
}

export function activityTotals(rows: ActivityRow[]): { scores: number; register: number } {
  return rows.reduce((sum, row) => ({ scores: sum.scores + row.scores, register: sum.register + row.register }), { scores: 0, register: 0 });
}

/** Every owed lesson, on every head screen, opens the lesson's own page. */
export const owedLessonPath = (item: Pick<OwedLesson, 'event_id'>): string => lessonPath(item.event_id);
