export function formatAssignmentTaskLabel(title: string | null | undefined, index: number): string {
  const normalizedTitle = title?.trim();
  return normalizedTitle || `Task ${index + 1}`;
}

/** The server-side unit gate, as the assignment status endpoint returns it. */
export interface UnitGate {
  ready: boolean;
  missing: Array<{ lesson_id: number; title: string }>;
  /**
   * The lessons the server actually gates on. It excludes checkpoint quiz lessons: those are
   * assessments rather than units, and a student outside the checkpoints pilot can never open
   * one, so counting a checkpoint would leave the homework unsubmittable for ever.
   */
  lesson_ids?: number[];
}

/**
 * Which of a course-unit task's lesson ids count towards its progress.
 *
 * Falls back to every id on the task when the server did not send `lesson_ids` (older backend),
 * so the display degrades to its previous behaviour rather than silently counting nothing.
 */
export function gatedLessonIds(
  taskLessonIds: number[] | null | undefined,
  unitGate?: UnitGate | null,
): number[] {
  const ids = taskLessonIds || [];
  if (!unitGate || !Array.isArray(unitGate.lesson_ids)) return ids;
  const counted = new Set(unitGate.lesson_ids);
  return ids.filter((id) => counted.has(id));
}
