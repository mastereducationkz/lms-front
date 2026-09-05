import type { StudentCheckpointItem } from '../services/api/checkpoints';

// Small pure helpers shared by LessonPage and CourseOverviewPage to render
// "this unit feeds Checkpoint N" cues from a /checkpoints/me response.

export interface CheckpointHints {
  /** unit lesson_id -> the checkpoint it is required by */
  unitToCheckpoint: Map<number, StudentCheckpointItem>;
  /** checkpoint quiz lesson_id -> the checkpoint itself */
  byQuizLesson: Map<number, StudentCheckpointItem>;
  /** every item, in number order, for the ordinal gate below */
  items: StudentCheckpointItem[];
}

export function buildCheckpointHints(items: StudentCheckpointItem[] | undefined | null): CheckpointHints {
  const unitToCheckpoint = new Map<number, StudentCheckpointItem>();
  const byQuizLesson = new Map<number, StudentCheckpointItem>();

  for (const item of items || []) {
    for (const unit of item.covers || []) {
      unitToCheckpoint.set(unit.lesson_id, item);
    }
    if (item.quiz) {
      byQuizLesson.set(item.quiz.lesson_id, item);
    }
  }

  const sorted = [...(items || [])].sort((a, b) => a.number - b.number);
  return { unitToCheckpoint, byQuizLesson, items: sorted };
}

/** A checkpoint the student can act on right now. The deadline is soft, so an overdue
 *  checkpoint is still answerable (the submission is marked late). */
export function isOpen(item: Pick<StudentCheckpointItem, 'status'>): boolean {
  return item.status === 'available' || item.status === 'reopened' || item.status === 'overdue';
}

/**
 * Mirrors the backend gate (blocked_unit_lesson_ids_for_student): only a checkpoint that has
 * opened and is not yet submitted — available, reopened or overdue — pauses the course; the
 * units of every later block wait for it. Completed, skipped and never-opened checkpoints hold
 * nothing back.
 */
export function isPending(item: Pick<StudentCheckpointItem, 'status'>): boolean {
  return isOpen(item);
}

/**
 * The earlier checkpoint (same group) that holds this unit back, or null when the unit is not
 * bound to a checkpoint or no earlier checkpoint is pending. Used only to explain a lock the
 * server already imposed — the server stays the authority.
 */
export function blockingCheckpointForUnit(hints: CheckpointHints, unitLessonId: number): StudentCheckpointItem | null {
  const own = hints.unitToCheckpoint.get(unitLessonId);
  if (!own) return null;
  return hints.items.find((i) => i.group_id === own.group_id && i.number < own.number && isPending(i)) || null;
}
