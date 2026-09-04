import type { StudentCheckpointItem } from '../services/api/checkpoints';

// Small pure helpers shared by LessonPage and CourseOverviewPage to render
// "this unit feeds Checkpoint N" cues from a /checkpoints/me response.

export interface CheckpointHints {
  /** unit lesson_id -> the checkpoint it is required by */
  unitToCheckpoint: Map<number, StudentCheckpointItem>;
  /** checkpoint quiz lesson_id -> the checkpoint itself */
  byQuizLesson: Map<number, StudentCheckpointItem>;
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

  return { unitToCheckpoint, byQuizLesson };
}

/** A checkpoint the student can act on right now. */
export function isOpen(item: Pick<StudentCheckpointItem, 'status'>): boolean {
  return item.status === 'available' || item.status === 'reopened';
}
