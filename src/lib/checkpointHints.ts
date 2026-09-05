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

/** A checkpoint the student can act on right now. */
export function isOpen(item: Pick<StudentCheckpointItem, 'status'>): boolean {
  return item.status === 'available' || item.status === 'reopened';
}

/**
 * Mirrors the backend's ordinal gate (blocked_unit_lesson_ids_for_student): a checkpoint
 * counts as cleared once it is completed or has lapsed to overdue, or when the group
 * skipped it via its start number. Everything else — never opened, open, reopened —
 * still holds every later block back.
 */
export function isCleared(item: Pick<StudentCheckpointItem, 'status' | 'skipped'>): boolean {
  return item.status === 'completed' || item.status === 'overdue' || Boolean(item.skipped);
}

/**
 * The earlier checkpoint (same group) that still holds this unit back, or null when the
 * unit is not bound to a checkpoint or every earlier checkpoint is cleared. Used only to
 * explain a lock the server already imposed — the server stays the authority.
 */
export function blockingCheckpointForUnit(hints: CheckpointHints, unitLessonId: number): StudentCheckpointItem | null {
  const own = hints.unitToCheckpoint.get(unitLessonId);
  if (!own) return null;
  return hints.items.find((i) => i.group_id === own.group_id && i.number < own.number && !isCleared(i)) || null;
}
